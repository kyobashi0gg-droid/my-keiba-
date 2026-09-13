// MY KEIBA LAB v28.1 - 馬番欠損の安全補正
// 一部PDF取込レースで馬番だけ欠けた場合、保存済みレース配列の並び順から補正する。
(() => {
  if (window.__MYKEIBA_RACE_NUMBER_REPAIR_V281__) return;
  window.__MYKEIBA_RACE_NUMBER_REPAIR_V281__ = true;

  function validNo(v) {
    const n = Number(String(v ?? '').trim());
    return Number.isInteger(n) && n >= 1 && n <= 18 ? n : null;
  }

  function looksImportedRace(race) {
    const horses = race?.horses || [];
    if (race?.v3SourcePage || race?.v3Course || race?.v3Avg33 != null) return true;
    const evidence = horses.filter(h =>
      h?.v3MarkString || h?.trainingScore !== '' || h?.odds !== '' || h?.popularity !== '' || h?.lapkunImportedAt
    ).length;
    return evidence >= Math.max(2, Math.ceil(horses.length / 3));
  }

  function repairRace(race) {
    const horses = race?.horses || [];
    if (horses.length < 2 || horses.length > 18) return 0;
    const nums = horses.map(h => validNo(h?.number));
    if (nums.every(Boolean)) return 0;

    const known = nums.map((n, i) => ({ n, i })).filter(x => x.n != null);
    if (known.length && !known.every(x => x.n === x.i + 1)) return 0;
    if (!known.length && !looksImportedRace(race)) return 0;

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

  function refreshOpenDetail() {
    try {
      const body = document.querySelector('#v4DetailBody');
      if (!body) return;
      const rows = [...body.querySelectorAll('.v4-table tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
      const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
      for (const tr of rows) {
        const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
        if (!id) continue;
        const race = races.find(r => (r.horses || []).some(h => h.id === id));
        const horse = race?.horses?.find(h => h.id === id);
        if (!horse || !validNo(horse.number)) continue;
        const cell = tr.children?.[0];
        if (!cell) continue;
        cell.textContent = String(horse.number);
      }
      window.MyKeibaRaceUIV17?.decorate?.();
    } catch {}
  }

  function run() {
    const st = typeof state !== 'undefined' ? state : window.state;
    const races = st?.races || [];
    let changed = 0;
    for (const race of races) changed += repairRace(race);
    if (changed) {
      try { localStorage.setItem(typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'my-keiba-lab-v2', JSON.stringify(st)); } catch {}
      try { if (typeof render === 'function') render(); } catch {}
      window.dispatchEvent(new CustomEvent('mykeiba:race-number-repaired', { detail: { changed } }));
    }
    refreshOpenDetail();
    return changed;
  }

  run();
  setTimeout(run, 80);
  window.addEventListener('pageshow', () => setTimeout(run, 50), { passive:true });
  window.addEventListener('mykeiba:resume', () => setTimeout(run, 50), { passive:true });

  window.MyKeibaRaceNumberRepairV28 = { run, repairRace, refreshOpenDetail };
})();
