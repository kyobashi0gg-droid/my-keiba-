// v3.1 hotfix: 調教印は並んだ印の「一番右」を採用する。
// 「・○・」のような並びでは右端の「・」= 調教印なし、と扱う。

(() => {
  const original = window.v3ParsePremiumRacePage;
  if (typeof original !== 'function') return;

  window.v3ParsePremiumRacePage = function(page) {
    const race = original(page);
    if (!race) return race;

    for (const horse of race.horses || []) {
      const raw = [...String(horse.v3MarkString || '')]
        .filter(ch => /[◎○▲☆△×・]/.test(ch));
      const rightmost = raw.at(-1) || '';
      horse.mark = rightmost === '・' ? '' : rightmost;
    }

    return race;
  };
})();
