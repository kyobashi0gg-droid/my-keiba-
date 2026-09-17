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

// Android Chromeで実行順が前後しないよう1本ずつ読み込む。
// v42: DBは外部評価のまま、テン/上がりだけで軽量な展開・33ズレシミュレーションを追加。
(() => {
  if (window.__MYKEIBA_POST_STABILITY_LOADER__) return;
  window.__MYKEIBA_POST_STABILITY_LOADER__ = true;

  const sources = [
    './race-number-repair-v28.js',
    './race-ui-v17.js',

    // 競走馬DBの登録・一覧・名前修正はDB LAB側へ完全分離。
    './horse-tab-db-lab-v40.js',

    // レース側の軽量機能
    './venue-going-v27.js',
    './db-rank-ui-v31.js',
    './rank-cell-sanitize-v32.js',
    './nakayama11-lap-repair-v33.js',
    './stability-coordinator-v34.js',
    './avg33-sync-v35.js',

    // DB LABで計算済みの軽量結果だけを本体へ反映
    './db-result-bridge-v38.js',

    // テン/上がりから位置取り・展開・平均33のズレパターンを仮説化
    './pace-sim-v42.js'
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
    window.__MYKEIBA_EXTERNAL_DB_ONLY__ = true;
    window.dispatchEvent(new CustomEvent('mykeiba:modules-ready'));
  })();
})();
