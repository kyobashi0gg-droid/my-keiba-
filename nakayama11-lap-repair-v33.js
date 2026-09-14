// MY KEIBA LAB v33 - 中山11R ラップ君4項目の保存データ修復
// 2026-09 セントライト記念でUI列崩れ時に誤って保存・表示された値を、元の取込値へ戻す。
(() => {
  if (window.__MYKEIBA_NAKAYAMA11_LAP_REPAIR_V33__) return;
  window.__MYKEIBA_NAKAYAMA11_LAP_REPAIR_V33__ = true;

  const SOURCE = {
    1:  { tenPast1f:'123', tenPrev1f:'132', tenRank:'1',  agariRank:'' },
    2:  { tenPast1f:'',    tenPrev1f:'',    tenRank:'',   agariRank:'4' },
    3:  { tenPast1f:'125', tenPrev1f:'132', tenRank:'6',  agariRank:'8' },
    4:  { tenPast1f:'122', tenPrev1f:'122', tenRank:'2',  agariRank:'' },
    5:  { tenPast1f:'125', tenPrev1f:'125', tenRank:'4',  agariRank:'8' },
    6:  { tenPast1f:'',    tenPrev1f:'',    tenRank:'',   agariRank:'1' },
    7:  { tenPast1f:'127', tenPrev1f:'131', tenRank:'2',  agariRank:'' },
    8:  { tenPast1f:'',    tenPrev1f:'',    tenRank:'',   agariRank:'1' },
    9:  { tenPast1f:'',    tenPrev1f:'130', tenRank:'8',  agariRank:'7' },
    10: { tenPast1f:'',    tenPrev1f:'',    tenRank:'',   agariRank:'5' },
    11: { tenPast1f:'126', tenPrev1f:'129', tenRank:'10', agariRank:'' },
    12: { tenPast1f:'',    tenPrev1f:'129', tenRank:'5',  agariRank:'8' },
    13: { tenPast1f:'128', tenPrev1f:'129', tenRank:'10', agariRank:'3' },
    14: { tenPast1f:'124', tenPrev1f:'139', tenRank:'',   agariRank:'' },
    15: { tenPast1f:'',    tenPrev1f:'131', tenRank:'9',  agariRank:'6' },
    16: { tenPast1f:'126', tenPrev1f:'135', tenRank:'7',  agariRank:'' }
  };

  function getState() {
    try { if (typeof state !== 'undefined') return state; } catch {}
    return window.state || null;
  }

  function repair() {
    const s = getState();
    const race = (s?.races || []).find(r => String(r.track || '').includes('中山') && Number(r.raceNo) === 11);
    if (!race) return false;

    let changed = false;
    for (const horse of race.horses || []) {
      const no = Number(horse.number);
      const src = SOURCE[no];
      if (!src) continue;
      for (const key of ['tenPast1f','tenPrev1f','tenRank','agariRank']) {
        if (String(horse[key] ?? '') !== String(src[key])) {
          horse[key] = src[key];
          changed = true;
        }
      }
    }

    if (changed) {
      try {
        if (typeof STORAGE_KEY !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {}
      window.dispatchEvent(new CustomEvent('mykeiba:lapdata-repaired', { detail:{ raceId: race.id } }));
      setTimeout(() => {
        try { window.MyKeibaLapRankRepairV32?.apply?.(); } catch {}
        try { window.MyKeibaRaceUIV17?.schedule?.(0); } catch {}
      }, 30);
    }
    return changed;
  }

  window.addEventListener('mykeiba:modules-ready', repair, { once:true });
  window.addEventListener('pageshow', repair, { passive:true });
  setTimeout(repair, 250);
  window.MyKeibaNakayama11RepairV33 = { repair };
})();
