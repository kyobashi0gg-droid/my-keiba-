// MY KEIBA LAB v34 - 機能を減らさず後処理を1本化する軽量安定化版
// v45 tuning: 詳細用/DB用タイマーを個別に1本化し、連打・復帰時の予約処理を溜めない。
(() => {
  if (window.__MYKEIBA_STABILITY_COORDINATOR_V34__) return;
  window.__MYKEIBA_STABILITY_COORDINATOR_V34__ = true;

  let detailTimer = null;
  let detailRaf = 0;
  let dbTimer = null;
  let dbRaf = 0;
  let detailToken = 0;

  function cancelDetail() {
    if (detailTimer) clearTimeout(detailTimer);
    detailTimer = null;
    if (detailRaf) cancelAnimationFrame(detailRaf);
    detailRaf = 0;
  }

  function cancelDb() {
    if (dbTimer) clearTimeout(dbTimer);
    dbTimer = null;
    if (dbRaf) cancelAnimationFrame(dbRaf);
    dbRaf = 0;
  }

  function cancelPending() {
    cancelDetail();
    cancelDb();
  }

  function runDetailPass(token = detailToken) {
    if (document.hidden || token !== detailToken) return;
    const detail = document.querySelector('#v4Detail');
    if (!detail || detail.hidden) return;
    try { window.MyKeibaRaceUIV17?.decorate?.(); } catch {}
    try { window.MyKeibaDbRankUIV31?.bindRankSort?.(); } catch {}
    try { window.MyKeibaRankCellV32?.syncRankCells?.(); } catch {}
  }

  function scheduleDetail(delay = 50) {
    cancelDetail();
    const token = ++detailToken;
    detailTimer = setTimeout(() => {
      detailTimer = null;
      if (document.hidden || token !== detailToken) return;
      detailRaf = requestAnimationFrame(() => {
        detailRaf = 0;
        runDetailPass(token);
      });
    }, delay);
  }

  function scheduleDb(delay = 50) {
    cancelDb();
    dbTimer = setTimeout(() => {
      dbTimer = null;
      if (document.hidden) return;
      dbRaf = requestAnimationFrame(() => {
        dbRaf = 0;
        try { window.MyKeibaDbRankUIV31?.ensureDbImportButton?.(); } catch {}
      });
    }, delay);
  }

  function releaseClosedDetail() {
    setTimeout(() => {
      const detail = document.querySelector('#v4Detail');
      if (!detail?.hidden) return;
      cancelDetail();
      detailToken++;
      const body = document.querySelector('#v4DetailBody');
      if (body) body.replaceChildren();
    }, 0);
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-v4-race],.v4-race-card')) scheduleDetail(40);
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"]')) scheduleDb(40);
    if (e.target?.closest?.('#v4CloseDetail,#v4CloseBottom') || e.target?.id === 'v4Detail') releaseClosedDetail();
  }, true);

  ['mykeiba:race-number-repaired','mykeiba:horse-db-updated','mykeiba:race-going-updated','mykeiba:lapdata-repaired'].forEach(name => {
    window.addEventListener(name, () => scheduleDetail(40), { passive:true });
  });

  window.addEventListener('mykeiba:modules-ready', () => {
    try { window.MyKeibaNakayama11RepairV33?.repair?.(); } catch {}
    scheduleDb(30);
    scheduleDetail(70);
  }, { once:true });

  window.addEventListener('mykeiba:resume', () => {
    scheduleDb(30);
    scheduleDetail(50);
  }, { passive:true });

  window.addEventListener('pagehide', cancelPending, { passive:true });
  window.addEventListener('freeze', cancelPending, { passive:true });

  window.MyKeibaStabilityV34 = { scheduleDetail, scheduleDb, runDetailPass, cancelPending };
})();
