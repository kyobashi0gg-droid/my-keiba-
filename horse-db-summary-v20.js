// MY KEIBA LAB v20 - 馬DB軽量サマリー
// v36: レース詳細の全馬「馬DBサマリー」生成を廃止。DB一覧/個別モーダルだけに限定し、常時MutationObserverも廃止。
(() => {
  if (window.__MYKEIBA_HORSE_DB_SUMMARY_V20__) return;
  window.__MYKEIBA_HORSE_DB_SUMMARY_V20__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function n(v) {
    if (v == null || v === '' || String(v).trim() === '—') return null;
    const m = String(v).replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const x = Number(m[0]);
    return Number.isFinite(x) ? x : null;
  }

  function finishNo(v) {
    const x = n(v);
    return x != null && x > 0 ? x : null;
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  function summarizeRuns(runs = []) {
    const valid = runs.map(r => ({ run:r, lap:n(r.lap33), finish:finishNo(r.finish) })).filter(x => x.lap != null);
    const good = valid.filter(x => x.finish != null && x.finish <= 3);
    const basis = good.length >= 2 ? good : valid;
    if (!basis.length) return {
      runCount:runs.length, lapCount:0, goodCount:good.length,
      zoneMin:null, zoneMax:null, avg:null, confidence:'none', basis:'none'
    };
    const values = basis.map(x => x.lap).sort((a,b) => a-b);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    return {
      runCount:runs.length,
      lapCount:valid.length,
      goodCount:good.length,
      zoneMin:round1(values[0]),
      zoneMax:round1(values.at(-1)),
      avg:round1(avg),
      confidence:good.length >= 4 ? 'high' : good.length >= 2 ? 'medium' : valid.length >= 3 ? 'low' : 'very-low',
      basis:good.length >= 2 ? 'good' : 'all'
    };
  }

  function zoneText(s) {
    if (s.zoneMin == null) return '好走33帯 —';
    return s.zoneMin === s.zoneMax ? `好走33帯 ${s.zoneMin}` : `好走33帯 ${s.zoneMin}〜${s.zoneMax}`;
  }

  function confidenceText(c) {
    return c === 'high' ? '信頼度 高' : c === 'medium' ? '信頼度 中' : c === 'low' ? '参考' : c === 'very-low' ? '参考少' : '未算出';
  }

  let allCache = null;
  let allPromise = null;
  async function allSummaries() {
    if (allCache) return allCache;
    if (allPromise) return allPromise;
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses || !api?.getRuns) return [];
    allPromise = (async () => {
      const horses = await api.listHorses();
      const out = [];
      for (const horse of horses) {
        const runs = await api.getRuns(horse.key);
        out.push({ horse, runs, summary:summarizeRuns(runs) });
      }
      allCache = out;
      return out;
    })();
    try { return await allPromise; }
    finally { allPromise = null; }
  }

  function clearCache() { allCache = null; allPromise = null; }

  async function decorateDbCards() {
    const api = window.MyKeibaHorseDBV18;
    if (!api?.getRuns) return;
    const view = document.querySelector('[data-view="horses"]');
    if (view?.hidden) return;
    const cards = [...document.querySelectorAll('[data-v18-horse-key]')];
    for (const card of cards) {
      if (card.dataset.v20 === '1') continue;
      const key = card.dataset.v18HorseKey;
      if (!key) continue;
      try {
        const runs = await api.getRuns(key);
        const s = summarizeRuns(runs);
        const div = card.querySelector('div');
        if (!div) continue;
        const line = document.createElement('small');
        line.className = 'v20-db-summary-line';
        line.textContent = `${zoneText(s)} ・ 好走${s.goodCount}走 ・ ${confidenceText(s.confidence)}`;
        div.appendChild(line);
        card.dataset.v20 = '1';
      } catch {}
    }
  }

  async function decorateHorseModal() {
    const modal = document.querySelector('#v18DbModal');
    if (!modal || modal.hidden) return;
    const title = modal.querySelector('#v18Title')?.textContent?.trim();
    if (!title || /取込|登録|解析|エラー/.test(title)) return;
    const body = modal.querySelector('#v18Body');
    if (!body || body.querySelector('.v20-summary-box')) return;
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses || !api?.getRuns) return;
    try {
      const horses = await api.listHorses();
      const horse = horses.find(h => norm(h.name) === norm(title));
      if (!horse) return;
      const runs = await api.getRuns(horse.key);
      const s = summarizeRuns(runs);
      const box = document.createElement('div');
      box.className = 'v20-summary-box';
      box.innerHTML = `<strong>${zoneText(s)}</strong><span>対象 ${s.lapCount}走 / 3着以内 ${s.goodCount}走 / ${confidenceText(s.confidence)}</span><small>${s.basis === 'good' ? '3着以内のDB内33値から暫定算出' : '好走データ不足のため全取得走から参考算出'}</small>`;
      body.prepend(box);
    } catch {}
  }

  // 旧版で残ったレース全馬サマリーがあれば即削除する。
  function removeRaceSummary() {
    document.querySelectorAll('.v20-race-db-note').forEach(el => el.remove());
  }

  const style = document.createElement('style');
  style.textContent = `
    .v20-db-summary-line{color:#2e7650!important;font-weight:800!important}
    .v20-summary-box{display:grid;gap:5px;padding:12px;margin:2px 0 12px;border:1px solid #cfe5d7;border-radius:14px;background:#f2faf5}
    .v20-summary-box strong{font-size:16px;color:#1d6240}.v20-summary-box span{font-size:12px;color:#425f50}.v20-summary-box small{font-size:10px;color:#74847b}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      removeRaceSummary();
      await decorateDbCards();
      await decorateHorseModal();
    });
  }

  // v36: DOM全体監視はしない。必要な操作時だけ更新。
  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"],[data-v18-horse-key],#v18HorseDbImport,#v31DbImportHere')) {
      setTimeout(schedule, 30);
    }
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', () => { clearCache(); schedule(); });
  window.addEventListener('mykeiba:modules-ready', schedule, { once:true });
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });
  schedule();

  window.MyKeibaHorseDBSummaryV20 = { summarizeRuns, allSummaries, schedule, clearCache, zoneText, confidenceText };
})();