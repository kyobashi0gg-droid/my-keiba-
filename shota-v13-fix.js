// MY KEIBA LAB v13 - ショータ印の列位置修正
// 馬柱の印は 左から「ショータ / U太郎 / 調教」。右端は調教印。
(() => {
  if (typeof state === 'undefined') return;

  function symbols(s = '') {
    return [...String(s)].filter(ch => /[◎○▲☆△×・]/.test(ch));
  }

  function shotaMarkFixed(s = '') {
    const a = symbols(s);
    if (!a.length) return '';
    // 現行プレミアム版は3列固定。先頭がショータ、中央がU太郎、右端が調教。
    // 旧データで2文字しか残っていない場合も従来互換で先頭を採用する。
    const mark = a[0] || '';
    return mark === '・' ? '' : mark;
  }

  function uTaroMarkFixed(s = '') {
    const a = symbols(s);
    if (a.length >= 3) return a[1] === '・' ? '' : a[1];
    return '';
  }

  function fixHorse(horse) {
    if (!horse) return horse;
    const raw = horse.v3MarkString || '';
    const shota = shotaMarkFixed(raw);
    horse.shotaMark = shota;
    horse.shotaMain = shota === '◎';
    horse.uTaroMark = uTaroMarkFixed(raw);
    horse.uTaroMain = horse.uTaroMark === '◎';
    return horse;
  }

  // Future PDF imports: correct the result after all previous parser wrappers run.
  if (typeof v3ParsePremiumRacePage === 'function') {
    const originalParse = v3ParsePremiumRacePage;
    v3ParsePremiumRacePage = function(page) {
      const race = originalParse(page);
      if (!race) return race;
      for (const horse of race.horses || []) fixHorse(horse);
      return race;
    };
  }

  // Re-import merge path: old v8 merge logic can re-derive the wrong middle mark,
  // so correct once more after merge.
  if (typeof v3MergeHorse === 'function') {
    const originalMerge = v3MergeHorse;
    v3MergeHorse = function(existing, incoming) {
      const merged = originalMerge(existing, incoming);
      return fixHorse(merged);
    };
  }

  // Repair already-saved races immediately; PDF re-import is not required.
  let changed = false;
  for (const race of state.races || []) {
    for (const horse of race.horses || []) {
      const beforeMark = horse.shotaMark || '';
      const beforeMain = Boolean(horse.shotaMain);
      const beforeU = horse.uTaroMark || '';
      fixHorse(horse);
      if (beforeMark !== (horse.shotaMark || '') || beforeMain !== Boolean(horse.shotaMain) || beforeU !== (horse.uTaroMark || '')) changed = true;
    }
  }

  if (window.MyKeibaEditorial) {
    window.MyKeibaEditorial.shotaMarkFromString = shotaMarkFixed;
  }

  if (changed) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (typeof render === 'function') setTimeout(() => render(), 0);
  }

  window.MyKeibaShotaV13 = { shotaMarkFixed, uTaroMarkFixed, fixHorse };
})();
