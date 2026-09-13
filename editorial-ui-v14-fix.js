// MY KEIBA LAB v14 UI fix - 統合版ホームに「新聞評価 一括取込」を表示
(() => {
  function placeButton() {
    const grid = document.querySelector('.v4-action-grid');
    const btn = document.querySelector('#v14EditorialImport');
    if (!grid || !btn) return;

    btn.classList.remove('secondary-btn');
    btn.classList.add('v4-secondary', 'v14-v4-btn');
    if (btn.parentElement !== grid) grid.appendChild(btn);
  }

  const style = document.createElement('style');
  style.textContent = `
    #v14EditorialImport.v14-v4-btn {
      border-color:#d5c2eb;
      background:#f7f1ff;
      color:#64458d;
      min-height:72px;
      white-space:normal;
      line-height:1.35;
    }
    #v14EditorialImport.v14-v4-btn.v14-active {
      background:#eee1ff;
      border-color:#b99cdd;
      color:#59377f;
    }
  `;
  document.head.appendChild(style);

  placeButton();
  const observer = new MutationObserver(() => setTimeout(placeButton, 0));
  observer.observe(document.body, { childList: true, subtree: true });
})();

// v17以降は stability-v15 適用後に読み込み、Android復帰時の監視制御も引き継ぐ。
(() => {
  if (window.__MYKEIBA_POST_STABILITY_LOADER__) return;
  window.__MYKEIBA_POST_STABILITY_LOADER__ = true;
  for (const src of ['./race-ui-v17.js', './horse-db-v18.js', './horse-db-name-fix-v19.js', './horse-db-summary-v20.js', './horse-db-fit-v21.js', './horse-db-score-consult-v22.js']) {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }
})();