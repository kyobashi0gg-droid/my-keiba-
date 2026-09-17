// MY KEIBA LAB v44 - DB LABの評価結果をレース別保存から本体へ反映
(() => {
  if (window.__MYKEIBA_DB_RESULT_BRIDGE_V44__) return;
  window.__MYKEIBA_DB_RESULT_BRIDGE_V44__ = true;

  const LEGACY_KEY = 'my-keiba-db-result-v2';
  const LEGACY_AT_KEY = 'my-keiba-db-result-v2-at';
  const ARCHIVE_KEY = 'my-keiba-db-results-v3';
  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();
  const compact = v => String(v ?? '').normalize('NFKC').replace(/[\s　・･]/g, '').trim();

  function raceKey(race) {
    return `${compact(race?.track)}|${String(Number(race?.raceNo || 0))}|${compact(race?.raceName)}`;
  }

  function parseSaved(text, at = '') {
    const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines[0] !== 'MYKEIBA_DB_RESULT_V2' || !lines[1]) return null;
    const head = lines[1].split('|');
    const m = (head[0] || '').match(/^(.+?)\s+(\d{1,2})R$/);
    if (!m) return null;
    const race = {
      track: m[1].trim(), raceNo: String(Number(m[2])), raceName: head[1] || '',
      surface: head[2] || '', distance: head[3] || '', going: head[4] || '', avg33: head[5] || ''
    };
    const horses = lines.slice(2).map(line => {
      const c = line.split('|');
      return {
        no: c[0] || '', name: c[1] || '', mark: c[2] || '—', label: c[3] || '',
        zone: c[4] || '—', basis: c[5] || '', gap: c[6] || '', excluded: c[7] || '0',
        signalCode: c[8] || '', signalDetail: c[9] || '', allZone: c[10] || '—', ability: c[11] || ''
      };
    }).filter(h => h.name);
    return { race, horses, at };
  }

  function readArchive() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || 'null');
      if (parsed && parsed.items && typeof parsed.items === 'object') return parsed;
    } catch {}
    return null;
  }

  function sameRace(a, b) {
    if (!a || !b) return false;
    if (compact(a.track) !== compact(b.track)) return false;
    if (String(Number(a.raceNo || 0)) !== String(Number(b.raceNo || 0))) return false;
    const an = compact(a.raceName), bn = compact(b.raceName);
    return !an || !bn || an === bn;
  }

  function archivedFor(race) {
    const store = readArchive();
    if (!store) return null;
    const exact = store.items?.[raceKey(race)];
    if (exact?.text) return parseSaved(exact.text, exact.at || '');

    const candidates = Object.values(store.items || {})
      .filter(x => x?.text)
      .map(x => parseSaved(x.text, x.at || ''))
      .filter(x => x && sameRace(x.race, race))
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return candidates[0] || null;
  }

  function legacyFor(race) {
    try {
      const data = parseSaved(localStorage.getItem(LEGACY_KEY), localStorage.getItem(LEGACY_AT_KEY) || '');
      return data && sameRace(data.race, race) ? data : null;
    } catch { return null; }
  }

  function savedFor(race) {
    return archivedFor(race) || legacyFor(race);
  }

  function currentRace() {
    const body = document.querySelector('#v4DetailBody');
    const first = body?.querySelector('[data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    const id = first.dataset.v4Expand;
    return races.find(r => (r.horses || []).some(h => h.id === id)) || null;
  }

  function cls(mark) {
    if (mark === '◎') return 'perfect';
    if (mark === '○') return 'possible';
    if (mark === '逆◎') return 'reverse';
    if (mark === '▲') return 'hidden';
    if (mark === '⚠') return 'warn';
    if (mark === '◇') return 'ability';
    return 'mid';
  }

  function label(h) {
    if (h.label) return `${h.mark} ${h.label}`.trim();
    if (h.mark === '◎') return '◎ コア一致';
    if (h.mark === '○') return '○ 好走可能';
    if (h.mark === '逆◎') return '逆◎ 全く逆';
    return '— 中間';
  }

  function clearDecorations(body) {
    body?.querySelector('#v38DbLabSummary')?.remove();
    body?.querySelectorAll('.v38-dbtag').forEach(x => x.remove());
  }

  function decorate() {
    const race = currentRace();
    const body = document.querySelector('#v4DetailBody');
    const data = race ? savedFor(race) : null;
    if (!data || !race || !body) {
      clearDecorations(body);
      return;
    }

    const byName = new Map(data.horses.map(h => [norm(h.name), h]));
    let matched = 0;
    body.querySelectorAll('tbody > tr').forEach(tr => {
      if (tr.classList.contains('v4-horse-detail-row')) return;
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      const nameCell = tr.children?.[1];
      if (!horse || !nameCell) return;
      nameCell.querySelector('.v38-dbtag')?.remove();
      const hit = byName.get(norm(horse.name));
      if (!hit) return;
      matched++;
      const tag = document.createElement('span');
      tag.className = `v38-dbtag ${cls(hit.mark)}`;
      tag.textContent = label(hit);
      tag.title = `${hit.basis || '条件未取得'} / コア33 ${hit.zone || '—'}${hit.allZone&&hit.allZone!=='—'?` / 全好走33 ${hit.allZone}`:''}${hit.signalDetail?` / ${hit.signalDetail}`:''}${hit.gap ? ` / 差${hit.gap}` : ''}`;
      nameCell.appendChild(tag);
    });

    let box = body.querySelector('#v38DbLabSummary');
    if (!box) {
      box = document.createElement('section');
      box.id = 'v38DbLabSummary';
      box.className = 'v38-summary';
      const table = body.querySelector('.v4-table-wrap') || body.querySelector('.v4-table');
      if (table) table.insertAdjacentElement('beforebegin', box);
    }
    const counts = {};
    data.horses.forEach(h => { counts[h.mark] = (counts[h.mark] || 0) + 1; });
    box.innerHTML = `<div class="v38-head"><div><small>DB LAB RESULT</small><strong>DB33 外部評価</strong></div><span>${matched}/${(race.horses||[]).length}頭</span></div>
      <div class="v38-counts"><b class="perfect">◎ ${counts['◎']||0}</b><b class="possible">○ ${counts['○']||0}</b><b class="hidden">▲ ${counts['▲']||0}</b><b class="warn">⚠ ${counts['⚠']||0}</b><b class="reverse">逆◎ ${counts['逆◎']||0}</b><b class="ability">◇ ${counts['◇']||0}</b></div>
      <p>DB LABで保存した評価をレースごとに保持して表示しています。別レースを保存してもこの評価は消えません。</p>`;
  }

  let timer = null;
  function schedule(ms=60) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { try { decorate(); } catch {} }), ms);
  }

  const style = document.createElement('style');
  style.textContent = `
    .v38-dbtag{display:inline-flex;margin-top:4px;margin-left:4px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:950;white-space:nowrap}
    .v38-dbtag.perfect,.v38-counts .perfect{background:#dff4e7;color:#17613a}
    .v38-dbtag.possible,.v38-counts .possible{background:#fff2cd;color:#805d11}
    .v38-dbtag.reverse,.v38-counts .reverse{background:#f5dfe3;color:#8e3442}
    .v38-dbtag.hidden,.v38-counts .hidden{background:#e8e0ff;color:#6542a0}
    .v38-dbtag.warn,.v38-counts .warn{background:#ffe3dc;color:#a44534}
    .v38-dbtag.ability,.v38-counts .ability{background:#e3edf8;color:#365e87}
    .v38-dbtag.mid{background:#edf1ef;color:#69776f}
    .v38-summary{margin:12px 0;padding:13px 14px;border:1px solid #d8e8de;border-radius:18px;background:#fbfdfb}
    .v38-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.v38-head small{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;color:#278154}.v38-head strong{display:block;margin-top:2px;font-size:18px;color:#173d2b}.v38-head>span{font-size:10px;font-weight:900;color:#547064}.v38-counts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v38-counts b{padding:4px 8px;border-radius:999px;font-size:10px}.v38-summary p{margin:7px 0 0;font-size:10px;color:#718078;line-height:1.5}`;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')) schedule(100);
  }, true);
  window.addEventListener('storage', e => {
    if (e.key === ARCHIVE_KEY || e.key === LEGACY_KEY) schedule(20);
  });
  window.addEventListener('pageshow', () => schedule(80), { passive:true });
  window.addEventListener('mykeiba:resume', () => schedule(80), { passive:true });
  window.addEventListener('mykeiba:modules-ready', () => schedule(80));
  schedule(250);

  window.MyKeibaDbResultBridgeV44 = { parseSaved, savedFor, readArchive, raceKey, decorate, schedule };
})();
