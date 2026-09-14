// MY KEIBA LAB v32 - テン順位 / 上がり順位の最終整合
// DOM上の列ズレに影響されず、保存済み horse.tenRank / horse.agariRank を該当列へ直接反映する。
(() => {
  if (window.__MYKEIBA_RANK_CELL_SANITIZE_V32__) return;
  window.__MYKEIBA_RANK_CELL_SANITIZE_V32__ = true;

  const num = v => {
    if (v === '' || v == null || String(v).trim() === '—') return null;
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  function badge(v) {
    const n = num(v);
    if (n == null || n <= 0) return '<span class="v6-missing">—</span>';
    const cls = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'other';
    return `<span class="v6-rank-badge ${cls}" aria-label="${n}位">${n}<small>位</small></span>`;
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first || typeof state === 'undefined') return null;
    return (state.races || []).find(r => (r.horses || []).some(h => h.id === first.dataset.v4Expand)) || null;
  }

  function syncRankCells() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    const race = currentRace();
    if (!table || !race) return false;

    const head = table.querySelector('thead tr');
    if (!head) return false;
    const heads = [...head.children].map(th => th.textContent.trim());
    const tenIdx = heads.indexOf('テン順');
    const agariIdx = heads.indexOf('上がり順');
    if (tenIdx < 0 || agariIdx < 0) return false;

    const rows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    for (const tr of rows) {
      const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
      const horse = (race.horses || []).find(h => h.id === id);
      if (!horse) continue;
      const cells = tr.children;
      if (cells[tenIdx]) {
        cells[tenIdx].className = `${cells[tenIdx].className} v6-metric-cell v6-rank-cell`.trim();
        cells[tenIdx].innerHTML = badge(horse.tenRank);
      }
      if (cells[agariIdx]) {
        cells[agariIdx].className = `${cells[agariIdx].className} v6-metric-cell v6-rank-cell v6-group-end`.trim();
        cells[agariIdx].innerHTML = badge(horse.agariRank);
      }
    }

    // ソートボタンも保存データのキーを直接使う。
    const bar = body.querySelector('#v17SortBar');
    if (bar) {
      bar.querySelectorAll('[data-v17-sort]').forEach(btn => {
        btn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          const mode = btn.dataset.v17Sort;
          const tbody = table.tBodies?.[0];
          if (!tbody) return;
          const pairMap = new Map();
          [...tbody.children].forEach(row => {
            if (row.classList.contains('v4-horse-detail-row')) {
              const rid = row.dataset.v4DetailRow;
              if (!pairMap.has(rid)) pairMap.set(rid, {});
              pairMap.get(rid).detail = row;
            } else {
              const rid = row.querySelector('[data-v4-expand]')?.dataset.v4Expand;
              if (!rid) return;
              if (!pairMap.has(rid)) pairMap.set(rid, {});
              pairMap.get(rid).main = row;
            }
          });
          const key = mode === 'agariRank' ? 'agariRank' : mode === 'tenRank' ? 'tenRank' : 'number';
          const sorted = [...(race.horses || [])].sort((a,b) => {
            const av = num(a?.[key]), bv = num(b?.[key]);
            if (av == null && bv == null) return (num(a?.number) ?? 999) - (num(b?.number) ?? 999);
            if (av == null) return 1;
            if (bv == null) return -1;
            return av - bv || (num(a?.number) ?? 999) - (num(b?.number) ?? 999);
          });
          const frag = document.createDocumentFragment();
          for (const horse of sorted) {
            const pair = pairMap.get(horse.id);
            if (pair?.main) frag.appendChild(pair.main);
            if (pair?.detail) frag.appendChild(pair.detail);
          }
          tbody.appendChild(frag);
          table.dataset.v17Sort = mode;
          bar.querySelectorAll('[data-v17-sort]').forEach(b => b.classList.toggle('active', b.dataset.v17Sort === mode));
          syncRankCells();
        };
      });
    }
    return true;
  }

  function schedule(delay = 0) {
    if (document.hidden) return;
    setTimeout(() => requestAnimationFrame(() => {
      try { syncRankCells(); } catch {}
    }), delay);
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race]')) schedule(120);
  }, true);
  window.addEventListener('mykeiba:modules-ready', () => schedule(120));
  window.addEventListener('mykeiba:resume', () => schedule(50), { passive:true });
  window.addEventListener('pageshow', () => schedule(50), { passive:true });
  schedule(350);

  window.MyKeibaRankCellV32 = { syncRankCells, schedule };
})();