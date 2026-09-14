// MY KEIBA LAB v35 - 平均33ラップの補完同期
// race.v3Avg33 が欠けている時だけ、展開・馬場メモ内の「平均33ラップ ±x.x」から補完する。
(() => {
  if (window.__MYKEIBA_AVG33_SYNC_V35__) return;
  window.__MYKEIBA_AVG33_SYNC_V35__ = true;

  function getState() {
    try { if (typeof state !== 'undefined') return state; } catch {}
    return window.state || null;
  }

  function currentAvgMissing(race) {
    const raw = race?.v3Avg33;
    if (raw === '' || raw == null || String(raw).trim() === '—') return true;
    return !Number.isFinite(Number(raw));
  }

  function parseAvg33(text) {
    const s = String(text || '').replace(/＋/g, '+').replace(/－/g, '-');
    const m = s.match(/平均\s*33(?:\s*ラップ)?\s*[:：]?\s*([+-]?\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  function saveState(s) {
    try {
      if (typeof STORAGE_KEY !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }

  function syncRace(race) {
    if (!race || !currentAvgMissing(race)) return false;
    const n = parseAvg33(race.paceMemo || race.memo || race.raceMemo || '');
    if (n == null) return false;
    race.v3Avg33 = n;
    return true;
  }

  function syncAll() {
    const s = getState();
    if (!s?.races) return 0;
    let changed = 0;
    for (const race of s.races) if (syncRace(race)) changed++;
    if (!changed) return 0;

    saveState(s);
    try {
      if (typeof render === 'function') render();
    } catch {}
    try { window.MyKeibaStabilityV34?.schedule?.('avg33-sync'); } catch {}
    window.dispatchEvent(new CustomEvent('mykeiba:avg33-synced', { detail:{ count: changed } }));
    return changed;
  }

  // 既存データの欠損を一度補完。
  setTimeout(syncAll, 180);
  window.addEventListener('mykeiba:modules-ready', () => setTimeout(syncAll, 40), { once:true });
  window.addEventListener('pageshow', () => setTimeout(syncAll, 80), { passive:true });

  // レース編集の「保存する」直後にも軽量チェック。
  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('button');
    if (!btn) return;
    const label = String(btn.textContent || '').replace(/\s+/g, '');
    if (label !== '保存する') return;
    setTimeout(syncAll, 80);
  }, true);

  window.MyKeibaAvg33V35 = { parseAvg33, syncRace, syncAll };
})();
