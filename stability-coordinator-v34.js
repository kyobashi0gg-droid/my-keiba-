// MY KEIBA LAB v34 - 機能を減らさず後処理を1本化する軽量安定化版
(() => {
  if (window.__MYKEIBA_STABILITY_COORDINATOR_V34__) return;
  window.__MYKEIBA_STABILITY_COORDINATOR_V34__ = true;

  let timer = null;
  let raf = 0;
  let detailToken = 0;

  function cancelPending() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function runDetailPass(token = detailToken) {
    if (document.hidden || token !== detailToken) return;
    const detail = document.querySelector('#v4Detail');
    if (!detail || detail.hidden) return;
    try { window.MyKeibaRaceUIV17?.decorate?.(); } catch {}
    try { window.MyKeibaDbRankUIV31?.bindRankSort?.(); } catch {}
    try { window.MyKeibaRankCellV32?.syncRankCells?.(); } catch {}
  }

  function scheduleDetail(delay = 40) {
    cancelPending();
    const token = ++detailToken;
    timer = setTimeout(() => {
      timer = null;
      raf = requestAnimationFrame(() => {
        raf = 0;
        runDetailPass(token);
      });
    }, delay);
  }

  function scheduleDb(delay = 40) {
    setTimeout(() => {
      if (document.hidden) return;
      requestAnimationFrame(() => {
        try { window.MyKeibaDbRankUIV31?.ensureDbImportButton?.(); } catch {}
      });
    }, delay);
  }

  function releaseClosedDetail() {
    setTimeout(() => {
      const detail = document.querySelector('#v4Detail');
      if (!detail?.hidden) return;
      cancelPending();
      detailToken++;
      const body = document.querySelector('#v4DetailBody');
      if (body) body.replaceChildren();
    }, 0);
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-v4-race],.v4-race-card')) scheduleDetail(30);
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"]')) scheduleDb(30);
    if (e.target?.closest?.('#v4CloseDetail,#v4CloseBottom') || e.target?.id === 'v4Detail') releaseClosedDetail();
  }, true);

  ['mykeiba:race-number-repaired','mykeiba:horse-db-updated','mykeiba:race-going-updated','mykeiba:lapdata-repaired'].forEach(name => {
    window.addEventListener(name, () => scheduleDetail(30), { passive:true });
  });

  window.addEventListener('mykeiba:modules-ready', () => {
    try { window.MyKeibaNakayama11RepairV33?.repair?.(); } catch {}
    scheduleDb(20);
    scheduleDetail(60);
  }, { once:true });

  window.addEventListener('mykeiba:resume', () => {
    scheduleDb(20);
    scheduleDetail(40);
  }, { passive:true });

  window.addEventListener('pagehide', cancelPending, { passive:true });
  window.addEventListener('freeze', cancelPending, { passive:true });

  window.MyKeibaStabilityV34 = { scheduleDetail, scheduleDb, runDetailPass, cancelPending };
})();