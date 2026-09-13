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

// v28.2: 動的scriptのdefer頼みを廃止。Android Chromeで実行順が前後しないよう1本ずつ読み込む。
(() => {
  if (window.__MYKEIBA_POST_STABILITY_LOADER__) return;
  window.__MYKEIBA_POST_STABILITY_LOADER__ = true;

  const sources = [
    './race-number-repair-v28.js',
    './race-ui-v17.js',
    './horse-db-v18.js',
    './horse-db-name-fix-v19.js',
    './horse-db-summary-v20.js',
    './horse-db-excuse-v25.js',
    './horse-db-condition-v23.js',
    './horse-db-going-v26.js',
    './venue-going-v27.js',
    './horse-db-fit-v21.js',
    './horse-db-score-consult-v22.js',
    './editorial-db-match-v27.js',
    './horse-db-condition-ui-v23.js',
    './horse-db-condition-visual-v24.js'
  ];

  function loadOne(src) {
    return new Promise(resolve => {
      if ([...document.scripts].some(s => s.getAttribute('src') === src)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => { console.warn('module load failed', src); resolve(); };
      document.head.appendChild(script);
    });
  }

  (async () => {
    for (const src of sources) await loadOne(src);
    window.dispatchEvent(new CustomEvent('mykeiba:modules-ready'));
  })();
})();