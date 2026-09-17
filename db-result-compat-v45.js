// MY KEIBA LAB v45 - v42など旧モジュール向けDB結果ブリッジ互換層
(() => {
  if (window.__MYKEIBA_DB_RESULT_COMPAT_V45__) return;
  window.__MYKEIBA_DB_RESULT_COMPAT_V45__ = true;

  function races() {
    try { return (typeof state !== 'undefined' ? state.races : window.state?.races) || []; }
    catch { return window.state?.races || []; }
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return races().find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function saved() {
    const race = currentRace();
    if (!race) return null;
    return window.MyKeibaDbResultBridgeV44?.savedFor?.(race) || null;
  }

  // 旧v42はV38.saved()を参照するため、軽い互換窓口だけ残す。
  if (!window.MyKeibaDbResultBridgeV38) {
    window.MyKeibaDbResultBridgeV38 = { saved };
  } else if (!window.MyKeibaDbResultBridgeV38.saved) {
    window.MyKeibaDbResultBridgeV38.saved = saved;
  }
})();
