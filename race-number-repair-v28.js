// MY KEIBA LAB v28 - 馬番欠損の安全補正
// 一部PDF取込レースで馬番だけ欠けた場合、PDF上の並び順を使って補正する。
(() => {
  if (window.__MYKEIBA_RACE_NUMBER_REPAIR_V28__) return;
  window.__MYKEIBA_RACE_NUMBER_REPAIR_V28__ = true;

  function validNo(v) {
    const n = Number(String(v ?? '').trim());
    return Number.isInteger(n) && n >= 1 && n <= 18 ? n : null;
  }

  function repairRace(race) {
    const horses = race?.horses || [];
    if (horses.length < 2 || horses.length > 18) return 0;
    const nums = horses.map(h => validNo(h?.number));
    if (nums.every(Boolean)) return 0;

    const known = nums.map((n, i) => ({ n, i })).filter(x => x.n != null);
    // 部分欠損は、既存番号と配列順が一致する場合だけ補う。
    if (known.length && !known.every(x => x.n === x.i + 1)) return 0;
    // 全欠損は、PDF由来レースだけを対象にする。
    if (!known.length && !race?.v3SourcePage) return 0;

    const names = horses.map(h => String(h?.name || '').trim()).filter(Boolean);
    if (names.length !== horses.length || new Set(names).size !== names.length) return 0;

    let changed = 0;
    horses.forEach((h, i) => {
      if (validNo(h.number) == null) {
        h.number = String(i + 1);
        changed++;
      }
    });
    return changed;
  }

  function run() {
    const st = typeof state !== 'undefined' ? state : window.state;
    const races = st?.races || [];
    let changed = 0;
    for (const race of races) changed += repairRace(race);
    if (!changed) return 0;
    try { localStorage.setItem(typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'my-keiba-lab-v2', JSON.stringify(st)); } catch {}
    try { if (typeof render === 'function') render(); } catch {}
    window.dispatchEvent(new CustomEvent('mykeiba:race-number-repaired', { detail: { changed } }));
    return changed;
  }

  run();
  window.addEventListener('pageshow', run, { passive:true });
  window.addEventListener('mykeiba:resume', run, { passive:true });

  window.MyKeibaRaceNumberRepairV28 = { run, repairRace };
})();
