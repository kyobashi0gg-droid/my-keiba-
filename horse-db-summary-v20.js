// MY KEIBA LAB v20 - 馬DB軽量サマリー
// 好走時のDB内33値を要約して表示。新聞側の平均33とは尺度確認前のため自動適合判定はまだ行わない。
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
    const valid = runs.map(r => ({ run: r, lap: n(r.lap33), finish: finishNo(r.finish) }))
      .filter(x => x.lap != null);
    const good = valid.filter(x => x.finish != null && x.finish <= 3);
    const basis = good.length >= 2 ? good : valid;
    if (!basis.length) return {
      runCount: runs.length, lapCount: 0, goodCount: good.length,
      zoneMin: null, zoneMax: null, avg: null, confidence: 'none', basis: 'none'
    };

    const values = basis.map(x => x.lap).sort((a,b) => a-b);
    const min = values[0], max = values.at(-1);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    return {
      runCount: runs.length,
      lapCount: valid.length,
      goodCount: good.length,
      zoneMin: round1(min),
      zoneMax: round1(max),
      avg: round1(avg),
      confidence: good.length >= 4 ? 'high' : good.length >= 2 ? 'medium' : valid.length >= 3 ? 'low' : 'very-low',
      basis: good.length >= 2 ? 'good' : 'all'
    };
  }

  function zoneText(s) {
    if (s.zoneMin == null) return '好走33帯 —';
    if (s.zoneMin === s.zoneMax) return `好走33帯 ${s.zoneMin}`;
    return `好走33帯 ${s.zoneMin}〜${s.zoneMax}`;
  }

  function confidenceText(c) {
    return c === 'high' ? '信頼度 高' : c === 'medium' ? '信頼度 中' : c === 'low' ? '参考' : c === 'very-low' ? '参考少' : '未算出';
  }

  async function allSummaries() {
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses || !api?.getRuns) return [];
    const horses = await api.listHorses();
    const out = [];
    for (const horse of horses) {
      const runs = await api.getRuns(horse.key);
      out.push({ horse, runs, summary: summarizeRuns(runs) });
    }
    return out;
  }

  async function decorateDbCards() {
    const api = window.MyKeibaHorseDBV18;
    if (!api?.getRuns) return;
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

  async function decorateRaceDetail() {
    const body = document.querySelector('#v4DetailBody');
    if (!body || body.querySelector('.v20-race-db-note')) return;
    const first = body.querySelector('[data-v4-expand]');
    if (!first) return;
    const horseId = first.dataset.v4Expand;
    const race = (window.state?.races || (typeof state !== 'undefined' ? state.races : []) || [])
      .find(r => (r.horses || []).some(h => h.id === horseId));
    if (!race) return;
    const summaries = await allSummaries();
    if (!summaries.length) return;
    const matched = (race.horses || []).map(h => {
      const x = summaries.find(s => norm(s.horse.name) === norm(h.name));
      return x ? { h, ...x } : null;
    }).filter(Boolean);
    if (!matched.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'v20-race-db-note';
    wrap.innerHTML = `<div class="v20-race-db-head"><strong>馬DBサマリー</strong><small>${matched.length}頭照合</small></div>${matched.map(x => `<div class="v20-race-db-row"><b>${x.h.number || '—'} ${x.h.name}</b><span>${zoneText(x.summary)} / 好走${x.summary.goodCount}走</span></div>`).join('')}<p>※新聞の「平均33」とDB内の33値は現在尺度を確認中のため、ゾーン内◎などの自動判定はまだ行いません。</p>`;
    const sortBar = body.querySelector('#v17SortBar');
    if (sortBar) sortBar.insertAdjacentElement('beforebegin', wrap);
    else body.prepend(wrap);
  }

  const style = document.createElement('style');
  style.textContent = `
    .v20-db-summary-line{color:#2e7650!important;font-weight:800!important}
    .v20-summary-box{display:grid;gap:5px;padding:12px;margin:2px 0 12px;border:1px solid #cfe5d7;border-radius:14px;background:#f2faf5}
    .v20-summary-box strong{font-size:16px;color:#1d6240}.v20-summary-box span{font-size:12px;color:#425f50}.v20-summary-box small{font-size:10px;color:#74847b}
    .v20-race-db-note{margin:10px 0;padding:11px;border:1px solid #d7e8de;border-radius:14px;background:#f7fbf8;display:grid;gap:6px}
    .v20-race-db-head{display:flex;justify-content:space-between;align-items:center}.v20-race-db-head strong{font-size:13px;color:#245d3d}.v20-race-db-head small{font-size:10px;color:#718078}
    .v20-race-db-row{display:flex;justify-content:space-between;gap:10px;font-size:11px;padding-top:5px;border-top:1px solid #e8f0eb}.v20-race-db-row b{white-space:nowrap}.v20-race-db-row span{text-align:right;color:#4e6458}
    .v20-race-db-note p{margin:3px 0 0;font-size:10px;line-height:1.5;color:#7a857f}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      await decorateDbCards();
      await decorateHorseModal();
      await decorateRaceDetail();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('mykeiba:horse-db-updated', schedule);
  window.addEventListener('mykeiba:resume', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
  schedule();

  window.MyKeibaHorseDBSummaryV20 = { summarizeRuns, allSummaries, schedule };
})();