// MY KEIBA LAB v49 - 押した時だけ最新オッズ取得（軽量フロント）
// 自動取得先が接続された場合のみ通信。15秒キャッシュ、最小フィールドだけを既存v12取込へ渡す。
(() => {
  if (window.__MYKEIBA_ODDS_LIVE_V49__) return;
  window.__MYKEIBA_ODDS_LIVE_V49__ = true;

  const ENDPOINT_KEY = 'my-keiba-live-odds-endpoint-v1';
  const CACHE_MS = 15000;
  const memoryCache = new Map();

  function clean(v = '') { return String(v ?? '').trim(); }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    const id = first.dataset.v4Expand;
    return races.find(r => (r.horses || []).some(h => h.id === id)) || null;
  }

  function endpoint() {
    return clean(window.MYKEIBA_ODDS_ENDPOINT || localStorage.getItem(ENDPOINT_KEY) || '');
  }

  function cacheKey(race) {
    return `${clean(race?.v3DateLabel)}|${clean(race?.track)}|${clean(race?.raceNo)}|${clean(race?.raceName)}`;
  }

  function fmtTime(value) {
    const d = value ? new Date(value) : null;
    if (!d || !Number.isFinite(d.getTime())) return clean(value) || '—';
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function normalizeResponse(data, race) {
    const src = data?.horses || data?.data || data?.odds || [];
    if (!Array.isArray(src)) throw new Error('取得データの形式が不正です');
    const horses = src.map(h => ({
      number: h.number ?? h.horseNumber ?? h.馬番 ?? '',
      name: h.name ?? h.horseName ?? h.馬名 ?? '',
      odds: h.odds ?? h.winOdds ?? h.単勝 ?? h.単勝オッズ ?? '',
      popularity: h.popularity ?? h.rank ?? h.人気 ?? h.人気順 ?? ''
    })).filter(h => clean(h.number) || clean(h.name));
    return {
      track: data?.track || data?.開催場 || race.track,
      raceNo: data?.raceNo || data?.race || data?.R || race.raceNo,
      updatedAt: data?.updatedAt || data?.sourceUpdatedAt || data?.jraUpdatedAt || '',
      raceDate: data?.raceDate || data?.date || '',
      fetchedAt: new Date().toISOString(),
      horses
    };
  }

  // Experimental fail-closed guard. A partial or mismatched response must never
  // overwrite existing odds. Keep this on the experiment branch until verified.
  function normHorseName(value = '') {
    return clean(value).replace(/[\\s　・･]/g, '').toLowerCase();
  }

  function dateParts(value = '') {
    const text = clean(value);
    // Supported: YYYY-MM-DD, YYYY/MM/DD, M/D, M月D日.
    let m = text.match(/(?:^|\\D)(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})(?:日|\\D|$)/);
    if (m) return { year:Number(m[1]), month:Number(m[2]), day:Number(m[3]) };
    m = text.match(/(?:^|\\D)(\\d{1,2})[/.月](\\d{1,2})(?:日|\\D|$)/);
    return m ? { year:null, month:Number(m[1]), day:Number(m[2]) } : null;
  }

  function validateSnapshot(data, race) {
    if (clean(data.track) !== clean(race.track) ||
        Number(data.raceNo) !== Number(race.raceNo)) {
      throw new Error('取得先の競馬場・レース番号が一致しません');
    }

    const wantedDate = dateParts(race.v3DateLabel);
    const actualDate = dateParts(data.raceDate);
    if (!wantedDate || !actualDate || wantedDate.month !== actualDate.month ||
        wantedDate.day !== actualDate.day ||
        (wantedDate.year && actualDate.year && wantedDate.year !== actualDate.year)) {
      throw new Error('開催日の照合ができません。反映を中止しました');
    }

    const existing = race.horses || [];
    if (!existing.length || data.horses.length !== existing.length) {
      throw new Error('全出走馬のオッズが取得できていません');
    }
    const seenNumbers = new Set();
    const seenRanks = new Set();
    for (const incoming of data.horses) {
      const number = Number(incoming.number);
      const odds = Number(incoming.odds);
      const popularity = Number(incoming.popularity);
      if (!Number.isInteger(number) || number < 1 || number > 18 ||
          seenNumbers.has(number)) throw new Error('馬番に重複・欠落があります');
      seenNumbers.add(number);

      const existingHorse = existing.find(h => Number(h.number) === number);
      if (!existingHorse || !normHorseName(incoming.name) ||
          normHorseName(incoming.name) !== normHorseName(existingHorse.name)) {
        throw new Error(number + '番の馬名が一致しません');
      }
      if (!Number.isFinite(odds) || odds <= 0 || !Number.isInteger(popularity) ||
          popularity < 1 || popularity > existing.length || seenRanks.has(popularity)) {
        throw new Error(number + '番の単勝オッズ・人気が不正です');
      }
      seenRanks.add(popularity);
    }
    if (seenRanks.size !== existing.length) throw new Error('人気順に欠落があります');
    return data;
  }

  async function requestOdds(race, force = false) {
    const ep = endpoint();
    if (!ep) throw Object.assign(new Error('AUTO_ENDPOINT_MISSING'), { code:'AUTO_ENDPOINT_MISSING' });

    const key = cacheKey(race);
    const cached = memoryCache.get(key);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return { ...cached.value, cached:true };

    const url = new URL(ep, location.href);
    url.searchParams.set('track', clean(race.track));
    url.searchParams.set('raceNo', clean(race.raceNo));
    if (race.raceName) url.searchParams.set('raceName', clean(race.raceName));
    if (race.v3DateLabel) url.searchParams.set('dateLabel', clean(race.v3DateLabel));

    const res = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`取得先エラー HTTP ${res.status}`);
    const value = validateSnapshot(normalizeResponse(await res.json(), race), race);
    memoryCache.set(key, { at:Date.now(), value });
    return value;
  }

  function toV12Text(data) {
    return [
      'MYKEIBA_ODDS_V1',
      `${data.track}${data.raceNo}R`,
      '馬番|馬名|単勝オッズ|人気',
      ...data.horses.map(h => `${clean(h.number)}|${clean(h.name)}|${clean(h.odds)}|${clean(h.popularity)}`)
    ].join('\n');
  }

  function applyToRace(data, race) {
    const api = window.MyKeibaLatestOdds;
    if (!api?.applyOdds) return { ok:false, message:'オッズ取込機能(v12)の準備ができていません。' };
    const result = api.applyOdds(toV12Text(data), race);
    if (result.ok) {
      race.oddsSourceUpdatedAt = data.updatedAt || '';
      race.oddsFetchedAt = data.fetchedAt || new Date().toISOString();
      race.oddsFetchMode = 'auto';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
      if (typeof render === 'function') render();
      window.dispatchEvent(new CustomEvent('mykeiba:odds-updated', { detail:{ raceId:race.id } }));
    }
    return result;
  }

  function statusHost(body) {
    let host = body?.querySelector('#v49OddsStatus');
    if (host) return host;
    const bar = body?.querySelector('.v4-edit-bar');
    if (!body || !bar) return null;
    host = document.createElement('div');
    host.id = 'v49OddsStatus';
    host.className = 'v49-status';
    host.hidden = true;
    bar.insertAdjacentElement('beforebegin', host);
    return host;
  }

  function showStatus(body, text, kind = 'info') {
    const host = statusHost(body);
    if (!host) return;
    host.hidden = false;
    host.className = `v49-status ${kind}`;
    host.textContent = text;
  }

  function openManualFallback(body) {
    const manual = body?.querySelector('#v12OddsImport');
    if (manual) {
      showStatus(body, '自動取得先はまだ未接続です。従来の手動取込を開きます。', 'warn');
      setTimeout(() => manual.click(), 120);
      return;
    }
    showStatus(body, '自動取得先はまだ未接続です。', 'warn');
  }

  async function handleFetch(btn, race, body) {
    if (!race || btn.disabled) return;
    if (!endpoint()) { openManualFallback(body); return; }

    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '取得中…';
    showStatus(body, '最新オッズを取得しています…', 'info');
    try {
      const data = await requestOdds(race, false);
      if (!data.horses.length) throw new Error('取得できるオッズがありません');
      const result = applyToRace(data, race);
      if (!result.ok) throw new Error(result.message);
      const source = data.updatedAt ? `提供元更新 ${fmtTime(data.updatedAt)} / ` : '';
      showStatus(body, `${result.message} ${source}取得 ${fmtTime(data.fetchedAt)}${data.cached ? '（15秒キャッシュ）' : ''}`, 'ok');
    } catch (err) {
      if (err?.code === 'AUTO_ENDPOINT_MISSING' || err?.message === 'AUTO_ENDPOINT_MISSING') openManualFallback(body);
      else showStatus(body, `自動取得できませんでした：${err?.message || '通信エラー'}。手動取込はそのまま使えます。`, 'ng');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
      decorate();
    }
  }

  function decorate() {
    const body = document.querySelector('#v4DetailBody');
    const bar = body?.querySelector('.v4-edit-bar');
    const race = currentRace();
    if (!body || !bar || !race) return false;

    let btn = body.querySelector('#v49OddsFetch');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'v49OddsFetch';
      btn.className = 'v4-primary v49-fetch';
      const manual = body.querySelector('#v12OddsImport');
      if (manual) bar.insertBefore(btn, manual);
      else bar.insertBefore(btn, bar.firstChild);
    }
    const stamp = race.oddsSourceUpdatedAt || race.oddsFetchedAt || '';
    btn.innerHTML = stamp
      ? `最新オッズ取得 <span class="v49-stamp">${fmtTime(stamp)}</span>`
      : '最新オッズ取得';
    btn.title = endpoint()
      ? '押した時だけ取得します。同一レースは15秒キャッシュ。'
      : '自動取得先は未接続。押すと手動取込へフォールバックします。';
    btn.onclick = () => handleFetch(btn, race, body);

    const manual = body.querySelector('#v12OddsImport');
    if (manual) {
      manual.textContent = '手動オッズ取込';
      manual.title = 'スクショ等から作ったMYKEIBA_ODDS_V1テキストを貼り付ける従来方式';
    }
    return true;
  }

  function setEndpoint(url) {
    const value = clean(url);
    if (value) localStorage.setItem(ENDPOINT_KEY, value);
    else localStorage.removeItem(ENDPOINT_KEY);
    return endpoint();
  }

  const style = document.createElement('style');
  style.textContent = `
    #v49OddsFetch{border-color:#4f8f6a;background:#1f7a4c;color:#fff}
    #v49OddsFetch:disabled{opacity:.62}
    .v49-stamp{font-size:9px;opacity:.85;margin-left:5px;white-space:nowrap}
    .v49-status{margin:8px 0 10px;padding:9px 11px;border-radius:11px;font-size:10px;line-height:1.5}
    .v49-status.info{background:#eef5ff;color:#2d5f91}.v49-status.ok{background:#eaf8ef;color:#17613d}.v49-status.warn{background:#fff5df;color:#8a6118}.v49-status.ng{background:#fff0ef;color:#99352d}
  `;
  document.head.appendChild(style);

  let timer = null;
  function schedule(ms = 180) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { try { decorate(); } catch {} }), ms);
  }
  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')) schedule(220);
  }, true);
  window.addEventListener('mykeiba:resume', () => schedule(100), { passive:true });
  window.addEventListener('pageshow', () => schedule(120), { passive:true });
  window.addEventListener('mykeiba:modules-ready', () => schedule(100));
  schedule(300);

  window.MyKeibaLiveOddsV49 = { requestOdds, applyToRace, normalizeResponse, validateSnapshot, setEndpoint, endpoint, cacheMs:CACHE_MS };
})();