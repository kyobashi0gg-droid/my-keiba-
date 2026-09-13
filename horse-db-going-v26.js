// MY KEIBA LAB v26.1 - 良馬場 / 道悪 分離
// DB過去走を「良」と「道悪（稍重・重・不良）」に分け、条件別33帯の補助判定へ使う。
// v26.1: 条件API読込順と表示タイミングに依存しないようにし、馬場データが無い場合も理由を明示する。
(() => {
  if (window.__MYKEIBA_HORSE_DB_GOING_V26__) return;
  window.__MYKEIBA_HORSE_DB_GOING_V26__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function goingClass(v) {
    const s = String(v || '').replace(/[\s　]/g, '');
    if (!s || /^(未設定|不明|—|-)$/.test(s)) return '';
    if (/稍重|稍|重馬場|不良|道悪|重/.test(s)) return '道悪';
    if (/良/.test(s)) return '良';
    return '';
  }

  function raceGoing(race) {
    const candidates = [
      race?.going, race?.v3Going, race?.trackGoing, race?.condition,
      race?.trackCondition, race?.raceGoing, race?.paceMemo
    ];
    for (const v of candidates) {
      const g = goingClass(v);
      if (g) return g;
    }
    return '';
  }

  function runGoing(run) {
    const candidates = [
      run?.going, run?.trackGoing, run?.condition, run?.trackCondition,
      run?.raceGoing, run?.['馬場'], run?.['馬場状態']
    ];
    for (const v of candidates) {
      const g = goingClass(v);
      if (g) return g;
    }
    return '';
  }

  function summarizeRuns(runs) {
    return window.MyKeibaHorseDBSummaryV20?.summarizeRuns?.(runs || []) || null;
  }

  function groupedGoingRows(runs = []) {
    const cond = window.MyKeibaHorseDBConditionV23;
    const ex = window.MyKeibaHorseDBExcuseV25;
    if (!cond?.runCondition) return { rows: [], recognized: 0, total: runs.length, waiting: true };

    const usable = ex?.filterUsableRuns ? ex.filterUsableRuns(runs) : runs;
    const groups = new Map();
    let recognized = 0;
    for (const run of usable) {
      const c = cond.runCondition(run);
      const g = runGoing(run);
      if (g) recognized++;
      if (!c.surface || !c.band || !g) continue;
      const key = `${c.surface}|${c.band}|${g}`;
      if (!groups.has(key)) groups.set(key, { surface:c.surface, band:c.band, going:g, runs:[] });
      groups.get(key).runs.push(run);
    }
    const orderS = {芝:0, ダート:1};
    const orderB = {'短距離':0,'マイル〜中距離':1,'中長距離':2};
    const orderG = {良:0, 道悪:1};
    const rows = [...groups.values()].map(x => ({...x, summary:summarizeRuns(x.runs)}))
      .filter(x => x.summary?.lapCount > 0)
      .sort((a,b) => (orderS[a.surface]??9)-(orderS[b.surface]??9)
        || (orderB[a.band]??9)-(orderB[b.band]??9)
        || (orderG[a.going]??9)-(orderG[b.going]??9));
    return { rows, recognized, total: usable.length, waiting: false };
  }

  function fmtZone(s) {
    if (!s || s.zoneMin == null || s.zoneMax == null) return '—';
    return s.zoneMin === s.zoneMax ? `${s.zoneMin}` : `${s.zoneMin}〜${s.zoneMax}`;
  }

  function bandText(band) {
    if (band === '短距離') return '〜1400m';
    if (band === 'マイル〜中距離') return '1500〜2000m';
    if (band === '中長距離') return '2100m〜';
    return band || '距離不明';
  }

  async function currentHorseAndRuns() {
    const modal = document.querySelector('#v18DbModal');
    if (!modal || modal.hidden) return null;
    const title = modal.querySelector('#v18Title')?.textContent?.trim();
    if (!title || /取込|登録|解析|エラー/.test(title)) return null;
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses || !api?.getRuns) return null;
    const horses = await api.listHorses();
    const horse = horses.find(h => norm(h.name) === norm(title));
    if (!horse) return null;
    return { modal, horse, runs: await api.getRuns(horse.key) };
  }

  async function decorateHorseModal() {
    const ctx = await currentHorseAndRuns();
    if (!ctx) return;
    const body = ctx.modal.querySelector('#v18Body');
    if (!body) return;

    // 条件APIの読込待ちなら後でもう一度試す。
    const result = groupedGoingRows(ctx.runs);
    if (result.waiting) {
      setTimeout(schedule, 120);
      return;
    }

    let box = body.querySelector('.v26-going-zones');
    if (box) box.remove();
    box = document.createElement('section');
    box.className = 'v26-going-zones';

    const coverage = `馬場状態取得 ${result.recognized}/${result.total}走`;
    const listHtml = result.rows.length
      ? `<div class="v26-list">${result.rows.map(x => `<div class="v26-row">
          <div><b>${x.surface}・${bandText(x.band)}・${x.going}</b><small>対象 ${x.summary.lapCount}走 / 3着以内 ${x.summary.goodCount}走</small></div>
          <strong>${fmtZone(x.summary)}</strong>
          <em class="${x.summary.goodCount >= 2 ? 'ok' : 'ref'}">${x.summary.goodCount >= 2 ? '採用候補' : '参考'}</em>
        </div>`).join('')}</div>`
      : `<div class="v26-empty">馬場状態を認識できる過去走がありません。MHT内の「馬場状態」取得を確認してください。</div>`;

    box.innerHTML = `
      <div class="v26-head"><div><strong>良馬場 / 道悪 33帯</strong><small>${coverage}・度外視候補は除外済み</small></div></div>
      ${listHtml}
      <p>良と道悪を分離。今回馬場が未設定なら、馬場状態では絞らず芝/ダート＋距離帯を優先します。</p>`;

    const anchor = body.querySelector('.v24-condition-zones') || body.querySelector('.v20-summary-box');
    if (anchor) anchor.insertAdjacentElement('afterend', box); else body.prepend(box);
  }

  const style = document.createElement('style');
  style.textContent = `
    .v26-going-zones{margin:0 0 14px;padding:12px;border:1px solid #d9e8df;border-radius:16px;background:#fcfdfc}
    .v26-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.v26-head>div{display:grid;gap:2px}.v26-head strong{font-size:15px;color:#245f3f}.v26-head small{font-size:9px;color:#78857e}
    .v26-list{display:grid;gap:6px}.v26-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #e8f0eb}.v26-row:first-child{border-top:0}.v26-row>div{display:grid;gap:2px}.v26-row b{font-size:11px;color:#304a3c}.v26-row small{font-size:9px;color:#7b8780}.v26-row>strong{font-size:13px;color:#1f6742;white-space:nowrap}.v26-row em{font-style:normal;font-size:9px;font-weight:900;padding:3px 6px;border-radius:999px}.v26-row em.ok{background:#e0f3e7;color:#256443}.v26-row em.ref{background:#f1f2f1;color:#707b75}
    .v26-empty{padding:10px;border-radius:10px;background:#fff8ed;color:#7b6a50;font-size:10px;line-height:1.6}
    .v26-going-zones p{margin:8px 0 0;font-size:9px;line-height:1.5;color:#78857e}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => { queued = false; try { await decorateHorseModal(); } catch {} });
  }
  document.addEventListener('click', e => { if (e.target?.closest?.('[data-v18-horse-key]')) setTimeout(schedule, 0); }, true);
  window.addEventListener('mykeiba:horse-db-updated', schedule);
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });
  window.addEventListener('load', () => setTimeout(schedule, 80), { once:true });
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {childList:true, subtree:true});
  schedule();

  window.MyKeibaHorseDBGoingV26 = { goingClass, raceGoing, runGoing, groupedGoingRows, schedule };
})();
