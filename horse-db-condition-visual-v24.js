// MY KEIBA LAB v24 - 条件別33帯の見える化
// 馬DB詳細で「芝/ダート × 距離帯」の33帯を一覧表示。v25では度外視候補を除外して集計する。
(() => {
  if (window.__MYKEIBA_HORSE_DB_CONDITION_VISUAL_V24__) return;
  window.__MYKEIBA_HORSE_DB_CONDITION_VISUAL_V24__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function fmtZone(s) {
    if (!s || s.zoneMin == null || s.zoneMax == null) return '—';
    return s.zoneMin === s.zoneMax ? `${s.zoneMin}` : `${s.zoneMin}〜${s.zoneMax}`;
  }

  function bucketLabel(surface, band) {
    const bandText = band === '短距離' ? '〜1400m'
      : band === 'マイル〜中距離' ? '1500〜2000m'
      : band === '中長距離' ? '2100m〜'
      : band || '距離不明';
    return `${surface || '馬場不明'}・${bandText}`;
  }

  function bucketRows(runs) {
    const cond = window.MyKeibaHorseDBConditionV23;
    const summaryApi = window.MyKeibaHorseDBSummaryV20;
    const exApi = window.MyKeibaHorseDBExcuseV25;
    if (!cond?.runCondition || !summaryApi?.summarizeRuns) return [];

    const groups = new Map();
    for (const run of runs || []) {
      const c = cond.runCondition(run);
      if (!c.surface || !c.band) continue;
      const k = `${c.surface}|${c.band}`;
      if (!groups.has(k)) groups.set(k, { surface:c.surface, band:c.band, runs:[] });
      groups.get(k).runs.push(run);
    }

    const orderSurface = { '芝':0, 'ダート':1 };
    const orderBand = { '短距離':0, 'マイル〜中距離':1, '中長距離':2 };
    return [...groups.values()].map(g => {
      const classified = exApi?.classifyRuns ? exApi.classifyRuns(g.runs) : { usable:g.runs, excluded:[] };
      return {
        ...g,
        usableRuns: classified.usable,
        excluded: classified.excluded,
        summary: summaryApi.summarizeRuns(classified.usable),
      };
    }).filter(g => g.summary?.lapCount > 0)
      .sort((a,b) => (orderSurface[a.surface] ?? 9) - (orderSurface[b.surface] ?? 9)
        || (orderBand[a.band] ?? 9) - (orderBand[b.band] ?? 9));
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
    const runs = await api.getRuns(horse.key);
    return { modal, horse, runs };
  }

  async function decorateHorseModal() {
    const ctx = await currentHorseAndRuns();
    if (!ctx) return;
    const { modal, runs } = ctx;
    const body = modal.querySelector('#v18Body');
    if (!body || body.querySelector('.v24-condition-zones')) return;

    const rows = bucketRows(runs);
    if (!rows.length) return;

    const exApi = window.MyKeibaHorseDBExcuseV25;
    const classified = exApi?.classifyRuns ? exApi.classifyRuns(runs) : { usable:runs, excluded:[] };
    const overall = window.MyKeibaHorseDBSummaryV20?.summarizeRuns?.(classified.usable);
    const box = document.createElement('section');
    box.className = 'v24-condition-zones';
    box.innerHTML = `
      <div class="v24-head">
        <div><strong>条件別33帯</strong><small>芝/ダート × 距離帯${classified.excluded.length ? ` ・ 度外視${classified.excluded.length}走除外` : ''}</small></div>
        <span>全体 ${fmtZone(overall)}</span>
      </div>
      <div class="v24-zone-list">
        ${rows.map(x => `
          <div class="v24-zone-row">
            <div><b>${bucketLabel(x.surface, x.band)}</b><small>対象 ${x.summary.lapCount}走 / 3着以内 ${x.summary.goodCount}走${x.excluded.length ? ` / 度外視${x.excluded.length}` : ''}</small></div>
            <strong>${fmtZone(x.summary)}</strong>
            <em class="${x.summary.goodCount >= 2 ? 'ok' : 'ref'}">${x.summary.goodCount >= 2 ? '採用候補' : '参考'}</em>
          </div>`).join('')}
      </div>
      ${classified.excluded.length ? `<div class="v25-excluded"><strong>度外視候補</strong>${classified.excluded.slice(0,6).map(x => `<span>${String(x.run.date || '').replace(/-/g,'.')} ${x.run.raceName || ''} ・ ${x.reason}</span>`).join('')}</div>` : ''}
      <p>明確な不利・展開不向きの凡走だけを集計から除外。条件別が十分なら優先し、不足時は同一馬場 → 全体へ補完します。</p>`;

    const summaryBox = body.querySelector('.v20-summary-box');
    if (summaryBox) summaryBox.insertAdjacentElement('afterend', box);
    else body.prepend(box);
  }

  const style = document.createElement('style');
  style.textContent = `
    .v24-condition-zones{margin:0 0 14px;padding:12px;border:1px solid #d5e8dc;border-radius:16px;background:#fbfdfb}
    .v24-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}.v24-head>div{display:grid;gap:2px}.v24-head strong{font-size:15px;color:#245f3f}.v24-head small{font-size:10px;color:#77847d}.v24-head>span{font-size:10px;color:#607168;background:#eef6f1;padding:4px 7px;border-radius:999px;white-space:nowrap}
    .v24-zone-list{display:grid;gap:7px}.v24-zone-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #e8f0eb}.v24-zone-row:first-child{border-top:0}.v24-zone-row>div{display:grid;gap:2px}.v24-zone-row b{font-size:12px;color:#2f493b}.v24-zone-row small{font-size:9px;color:#7a867f}.v24-zone-row>strong{font-size:14px;color:#1f6742;white-space:nowrap}.v24-zone-row em{font-style:normal;font-size:9px;font-weight:900;padding:3px 6px;border-radius:999px;white-space:nowrap}.v24-zone-row em.ok{background:#e0f3e7;color:#256443}.v24-zone-row em.ref{background:#f1f2f1;color:#707b75}
    .v25-excluded{display:grid;gap:3px;margin-top:9px;padding:8px;border-radius:10px;background:#fff8ed}.v25-excluded strong{font-size:10px;color:#8a6020}.v25-excluded span{font-size:9px;color:#7b6a50}
    .v24-condition-zones p{margin:8px 0 0;font-size:9px;line-height:1.5;color:#78857e}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      try { await decorateHorseModal(); } catch {}
    });
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-v18-horse-key]')) setTimeout(schedule, 0);
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', schedule);
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });
  schedule();

  window.MyKeibaHorseDBConditionVisualV24 = { bucketRows, schedule };
})();