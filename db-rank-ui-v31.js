// MY KEIBA LAB v31.1 - DBページ取込導線 + テン/上がり列・ソート安定化
(() => {
  if (window.__MYKEIBA_DB_RANK_UI_V31__) return;
  window.__MYKEIBA_DB_RANK_UI_V31__ = true;

  const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const num = v => {
    if (v === '' || v == null || String(v).trim() === '—') return null;
    const n = Number(String(v).replace(/[^0-9.-]/g,''));
    return Number.isFinite(n) ? n : null;
  };

  function rankBadge(v) {
    const n = num(v);
    if (n == null || n <= 0) return '<span class="v6-missing">—</span>';
    const cls = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'other';
    return `<span class="v6-rank-badge ${cls}" aria-label="${n}位">${n}<small>位</small></span>`;
  }

  function timePill(v) {
    if (v === '' || v == null || String(v).trim() === '—') return '<span class="v6-missing">—</span>';
    return `<span class="v6-time-pill">${esc(v)}</span>`;
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    return races.find(r => (r.horses || []).some(h => h.id === first.dataset.v4Expand)) || null;
  }

  function makeMetricCell(type, value, extra='') {
    const td = document.createElement('td');
    td.className = `${type === 'time' ? 'v5-time-cell v6-time-cell' : 'v5-rank-cell v6-rank-cell'} v6-metric-cell ${extra}`.trim();
    td.innerHTML = type === 'time' ? timePill(value) : rankBadge(value);
    return td;
  }

  function rowPairs(table) {
    const map = new Map();
    [...table.querySelectorAll('tbody > tr')].forEach(tr => {
      if (tr.classList.contains('v4-horse-detail-row')) {
        const id = tr.dataset.v4DetailRow;
        if (!id) return;
        if (!map.has(id)) map.set(id, {});
        map.get(id).detail = tr;
      } else {
        const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
        if (!id) return;
        if (!map.has(id)) map.set(id, {});
        map.get(id).main = tr;
      }
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
    const map = rowPairs(table);
    const sorted = [...(race.horses || [])].sort((a,b) => compareHorse(a,b,mode));
    const frag = document.createDocumentFragment();
    for (const horse of sorted) {
      const pair = map.get(horse.id);
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

  function rebuildLapColumns() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    const race = currentRace();
    if (!body || !table || !race) return;

    const head = table.querySelector('thead tr');
    if (!head || head.children.length < 2) return;

    [...head.children].forEach(th => {
      if (['テン1F過去','テン1F前走','テン順','上がり順'].includes(th.textContent.trim())) th.remove();
    });
    const labels = ['テン1F過去','テン1F前走','テン順','上がり順'];
    const anchor = head.children[2] || null;
    labels.forEach((label, i) => {
      const th = document.createElement('th');
      th.textContent = label;
      th.className = i < 2 ? 'v6-metric-head v6-time-head' : 'v6-metric-head v6-rank-head';
      if (i === 0) th.classList.add('v6-group-start');
      if (i === 3) th.classList.add('v6-group-end');
      head.insertBefore(th, anchor);
    });

    const mainRows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    for (const tr of mainRows) {
      const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
      const horse = (race.horses || []).find(h => h.id === id);
      if (!horse) continue;

      [...tr.children].forEach(td => {
        if (td.classList.contains('v5-time-cell') || td.classList.contains('v5-rank-cell') || td.classList.contains('v6-metric-cell')) td.remove();
      });
      const insertBefore = tr.children[2] || null;
      tr.insertBefore(makeMetricCell('time', horse.tenPast1f, 'v6-group-start'), insertBefore);
      tr.insertBefore(makeMetricCell('time', horse.tenPrev1f), insertBefore);
      tr.insertBefore(makeMetricCell('rank', horse.tenRank), insertBefore);
      tr.insertBefore(makeMetricCell('rank', horse.agariRank, 'v6-group-end'), insertBefore);
    }

    table.querySelectorAll('.v4-horse-detail-row > td').forEach(td => {
      td.colSpan = Math.max(Number(td.colSpan || 1), head.children.length);
    });

    const bar = body.querySelector('#v17SortBar');
    if (bar) {
      bar.querySelectorAll('[data-v17-sort]').forEach(btn => {
        btn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          applyDirectSort(table, race, btn.dataset.v17Sort);
        };
      });
    }

    const mode = table.dataset.v17Sort || 'number';
    applyDirectSort(table, race, mode);
    try { window.MyKeibaRaceUIV17?.decorateFrameColors?.(table, race); } catch {}
  }

  function ensureDbImportButton() {
    const view = document.querySelector('[data-view="horses"]');
    if (!view || view.hidden) return;
    if (view.querySelector('#v31DbImportHere')) return;
    const search = view.querySelector('#v4HorseSearch');
    if (!search) return;
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
  }

  function scheduleDetail() {
    if (document.hidden) return;
    requestAnimationFrame(() => { try { rebuildLapColumns(); } catch {} });
  }
  function scheduleDb() {
    if (document.hidden) return;
    requestAnimationFrame(() => { try { ensureDbImportButton(); } catch {} });
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race]')) setTimeout(scheduleDetail, 80);
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"]')) setTimeout(scheduleDb, 80);
  }, true);
  window.addEventListener('mykeiba:modules-ready', () => { scheduleDb(); scheduleDetail(); });
  window.addEventListener('mykeiba:resume', () => { scheduleDb(); scheduleDetail(); }, { passive:true });
  window.addEventListener('pageshow', () => { scheduleDb(); scheduleDetail(); }, { passive:true });

  const style = document.createElement('style');
  style.textContent = `.v31-db-import{width:100%;margin:10px 0 14px;appearance:none;border:1px solid #b9d9c8;background:#eef8f2;color:#245d3d;border-radius:16px;padding:14px 16px;font-size:15px;font-weight:950;min-height:52px}`;
  document.head.appendChild(style);

  setTimeout(scheduleDb, 300);
  setTimeout(scheduleDetail, 300);
  window.MyKeibaDbRankUIV31 = { rebuildLapColumns, ensureDbImportButton, applyDirectSort };
})();
