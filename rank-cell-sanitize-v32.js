// MY KEIBA LAB v32.1 - テン順位 / 上がり順位の最終整合
// v34: 自前のクリック/pageshow監視をやめ、coordinator から必要時だけ同期する。
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
        cells[tenIdx].classList.add('v6-metric-cell','v6-rank-cell');
        cells[tenIdx].innerHTML = badge(horse.tenRank);
      }
      if (cells[agariIdx]) {
        cells[agariIdx].classList.add('v6-metric-cell','v6-rank-cell','v6-group-end');
        cells[agariIdx].innerHTML = badge(horse.agariRank);
      }
    }
    return true;
  }

  window.MyKeibaRankCellV32 = { syncRankCells };
})();