// MY KEIBA LAB v14 UI fix - 統合版ホームに「新聞評価 一括取込」を表示
(() => {
  function placeButton() {
    const grid = document.querySelector('.v4-action-grid');
    const btn = document.querySelector('#v14EditorialImport');
    if (!grid || !btn) return false;
    btn.classList.remove('secondary-btn');
    btn.classList.add('v4-secondary', 'v14-v4-btn');
    if (btn.parentElement !== grid) grid.appendChild(btn);
    return true;
  }

  const style = document.createElement('style');
  style.textContent = `#v14EditorialImport.v14-v4-btn{border-color:#d5c2eb;background:#f7f1ff;color:#64458d;min-height:72px;white-space:normal;line-height:1.35}#v14EditorialImport.v14-v4-btn.v14-active{background:#eee1ff;border-color:#b99cdd;color:#59377f}`;
  document.head.appendChild(style);

  placeButton();
  [120,500,1200].forEach(ms => setTimeout(placeButton, ms));
  window.addEventListener('pageshow', placeButton, {passive:true});
  window.addEventListener('mykeiba:resume', placeButton, {passive:true});
})();

// Android Chrome向け軽量ローダー。
// v45: 常時必要な処理だけ先に読み、展開シミュレーションはレース詳細を開いた時に遅延読込する。
(() => {
  if (window.__MYKEIBA_POST_STABILITY_LOADER__) return;
  window.__MYKEIBA_POST_STABILITY_LOADER__ = true;

  const coreSources = [
    './race-number-repair-v28.js',
    './race-ui-v17.js',
    './horse-tab-db-lab-v40.js',
    './venue-going-v27.js',
    './db-rank-ui-v31.js',
    './rank-cell-sanitize-v32.js',
    './nakayama11-lap-repair-v33.js',
    './stability-coordinator-v34.js',
    './avg33-sync-v35.js',
    './db-result-bridge-v44.js',
    './db-result-compat-v45.js'
  ];

  const detailSources = [
    './pace-sim-v42.js',
    './pace-unknown-consult-v43.js'
  ];

  const loaded = new Set();
  let detailPromise = null;

  function loadOne(src) {
    if (loaded.has(src) || [...document.scripts].some(s => s.getAttribute('src') === src)) {
      loaded.add(src);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => { loaded.add(src); resolve(); };
      script.onerror = () => { console.warn('module load failed', src); resolve(); };
      document.head.appendChild(script);
    });
  }

  async function loadDetailModules() {
    if (detailPromise) return detailPromise;
    detailPromise = (async () => {
      for (const src of detailSources) await loadOne(src);
      window.dispatchEvent(new CustomEvent('mykeiba:detail-modules-ready'));
    })();
    return detailPromise;
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race]')) loadDetailModules();
  }, true);

  window.addEventListener('pageshow', () => {
    const detail = document.querySelector('#v4Detail');
    if (detail && !detail.hidden) loadDetailModules();
  }, {passive:true});

  (async () => {
    for (const src of coreSources) await loadOne(src);
    window.__MYKEIBA_EXTERNAL_DB_ONLY__ = true;
    window.dispatchEvent(new CustomEvent('mykeiba:modules-ready'));
    const detail = document.querySelector('#v4Detail');
    if (detail && !detail.hidden) loadDetailModules();
  })();

  window.MyKeibaModuleLoaderV45 = { loadDetailModules };
})();
