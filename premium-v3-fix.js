// v3.2 hotfix: 調教印は並んだ印の「一番右」を採用する。
// 「・○・」のような並びでは右端の「・」= 調教印なし。
// 既に取り込んだデータも v3MarkString から自動修復する。

(() => {
  function rightmostTrainingMark(markString) {
    const raw = [...String(markString || '')]
      .filter(ch => /[◎○▲☆△×・]/.test(ch));
    const rightmost = raw.at(-1) || '';
    return rightmost === '・' ? '' : rightmost;
  }

  // 今後のPDF取込を修正
  if (typeof v3ParsePremiumRacePage === 'function') {
    const original = v3ParsePremiumRacePage;
    v3ParsePremiumRacePage = function(page) {
      const race = original(page);
      if (!race) return race;
      for (const horse of race.horses || []) {
        if (horse.v3MarkString != null) {
          horse.mark = rightmostTrainingMark(horse.v3MarkString);
        }
      }
      return race;
    };
  }

  // 既に保存済みの取込データも修正
  let changed = false;
  if (typeof state !== 'undefined' && state?.races) {
    for (const race of state.races) {
      for (const horse of race.horses || []) {
        if (horse.v3MarkString == null) continue;
        const corrected = rightmostTrainingMark(horse.v3MarkString);
        if ((horse.mark || '') !== corrected) {
          horse.mark = corrected;
          changed = true;
        }
      }
    }
  }

  if (changed && typeof saveState === 'function') {
    saveState();
  }
})();
