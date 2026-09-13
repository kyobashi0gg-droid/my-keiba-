// MY KEIBA LAB v17 - 競走馬DB検索の入力安定化
// 旧実装は1文字入力ごとに検索欄をDOMごと作り直していたため、Androidで
// 2文字目の入力・削除・日本語IMEが止まることがあった。ここではDOMを
// 作り直さず、既存カードの表示/非表示だけで絞り込む。
(() => {
  if (window.__MYKEIBA_HORSE_SEARCH_V17__) return;
  window.__MYKEIBA_HORSE_SEARCH_V17__ = true;

  function normalize(v = '') {
    return String(v).normalize('NFKC').replace(/[\s　・･]/g, '').toLowerCase();
  }

  function filterHorseCards(input) {
    const view = input.closest('[data-view="horses"]');
    if (!view) return;
    const q = normalize(input.value);
    let visible = 0;

    view.querySelectorAll('.v4-horse-card').forEach(card => {
      const name = card.querySelector('strong')?.textContent || '';
      const hit = !q || normalize(name).includes(q);
      card.hidden = !hit;
      if (hit) visible += 1;
    });

    const count = view.querySelector('.v4-section-head .v4-muted');
    if (count) count.textContent = `${visible}頭`;
  }

  // captureで旧oninputより先に受け、旧処理（innerHTML再生成）を止める。
  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'v4HorseSearch') return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    filterHorseCards(input);
  }, true);

  // 検索欄を開いた直後に既存値があれば反映。
  document.addEventListener('focusin', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.id === 'v4HorseSearch') filterHorseCards(input);
  }, true);
})();
