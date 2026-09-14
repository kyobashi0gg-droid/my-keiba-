// MY KEIBA LAB v31.3 - DBページ取込導線 + テン/上がりソート
// v34: 自前の常時イベント監視/タイマーをやめ、stability coordinator から必要時だけ呼ぶ。
(() => {
  if (window.__MYKEIBA_DB_RANK_UI_V31__) return;
  window.__MYKEIBA_DB_RANK_UI_V31__ = true;

  const num = v => {
    if (v === '' || v == null || String(v).trim() === '—') return null;
    const n = Number(String(v).replace(/[^0-9.-]/g,''));
    return Number.isFinite(n) ? n : null;
  };

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    return races.find(r => (r.horses || []).some(h => h.id === first.dataset.v4Expand)) || null;
  }

  function rowPairs(table) {
    const map = new Map();
    [...table.querySelectorAll('tbody > tr')].forEach(tr => {
      if (tr.classList.contains('v4-horse-detail-row')) {
        const id = tr.dataset.v4DetailRow;
        if (!id) return;
        if (!map.has(id)) map.set(id, {});
        map.get(id).detail = tr;
        return;
      }
      const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
      if (!id) return;
      if (!map.has(id)) map.set(id, {});
      map.get(id).main = tr;
    });
    return map;
  }

  function compareHorse(a, b, mode) {
    const key = mode === 'agariRank' ? 'agariRank' : mode === 'tenRank' ? 'tenRank' : 'number';
    const av = num(a?.[key]);
    const bv = num(b?.[key]);
    if (av == null && bv == null) return (num(a?.number) ?? 999) - (num(b?.number) ?? 999);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || (num(a?.number) ?? 999) - (num(b?.number) ?? 999);
  }

  function applyDirectSort(table, race, mode) {
    const tbody = table?.tBodies?.[0];
    if (!tbody || !race) return;
    const pairs = rowPairs(table);
    const sorted = [...(race.horses || [])].sort((a,b) => compareHorse(a,b,mode));
    const frag = document.createDocumentFragment();
    for (const horse of sorted) {
      const pair = pairs.get(horse.id);
      if (pair?.main) frag.appendChild(pair.main);
      if (pair?.detail) frag.appendChild(pair.detail);
    }
    tbody.appendChild(frag);
    table.dataset.v17Sort = mode;
    const bar = document.querySelector('#v17SortBar');
    bar?.querySelectorAll('[data-v17-sort]').forEach(btn => {
      const active = btn.dataset.v17Sort === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function bindRankSort() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    const race = currentRace();
    const bar = body?.querySelector('#v17SortBar');
    if (!body || !table || !race || !bar) return false;

    bar.querySelectorAll('[data-v17-sort]').forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        applyDirectSort(table, race, btn.dataset.v17Sort);
        try { window.MyKeibaRankCellV32?.syncRankCells?.(); } catch {}
      };
    });
    return true;
  }

  function ensureDbImportButton() {
    const view = document.querySelector('[data-view="horses"]');
    if (!view || view.hidden) return false;
    if (view.querySelector('#v31DbImportHere')) return true;
    const search = view.querySelector('#v4HorseSearch');
    if (!search) return false;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'v31DbImportHere';
    btn.className = 'v31-db-import';
    btn.textContent = '＋ 馬DBを追加';
    btn.onclick = () => {
      const input = document.querySelector('#v18HorseDbFile');
      if (input) input.click();
      else document.querySelector('#v18HorseDbImport')?.click();
    };
    search.insertAdjacentElement('afterend', btn);
    return true;
  }

  const style = document.createElement('style');
  style.textContent = `.v31-db-import{width:100%;margin:10px 0 14px;appearance:none;border:1px solid #b9d9c8;background:#eef8f2;color:#245d3d;border-radius:16px;padding:14px 16px;font-size:15px;font-weight:950;min-height:52px}`;
  document.head.appendChild(style);

  window.MyKeibaDbRankUIV31 = { ensureDbImportButton, applyDirectSort, bindRankSort };
})();