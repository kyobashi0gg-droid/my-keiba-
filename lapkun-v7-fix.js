// MY KEIBA LAB v7 fix - metric column alignment + KTM/score clarification
(() => {
  if (typeof state === 'undefined') return;

  let busy = false;

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function hasNumber(v) {
    return /\d/.test(String(v ?? ''));
  }

  function rankBadge(v) {
    if (!hasNumber(v)) return '<span class="v6-missing">—</span>';
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return '<span class="v6-missing">—</span>';
    const cls = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'other';
    return `<span class="v6-rank-badge ${cls}" aria-label="${n}位">${n}<small>位</small></span>`;
  }

  function timePill(v) {
    if (!hasNumber(v)) return '<span class="v6-missing">—</span>';
    return `<span class="v6-time-pill">${esc(v)}</span>`;
  }

  function metricCell(type, value, start = false, end = false) {
    const td = document.createElement('td');
    td.className = [
      type === 'time' ? 'v5-time-cell' : 'v5-rank-cell',
      'v6-metric-cell',
      type === 'time' ? 'v6-time-cell' : 'v6-rank-cell',
      start ? 'v6-group-start' : '',
      end ? 'v6-group-end' : ''
    ].filter(Boolean).join(' ');
    td.innerHTML = type === 'time' ? timePill(value) : rankBadge(value);
    return td;
  }

  function fixDetailTable() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table) return;
    const race = raceFromDetail();
    if (!race) return;

    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const heads = [...headRow.children];
    const pastIdx = heads.findIndex(th => th.textContent.trim() === 'テン1F過去');
    const prevIdx = heads.findIndex(th => th.textContent.trim() === 'テン1F前走');
    const tenIdx = heads.findIndex(th => th.textContent.trim() === 'テン順');
    const agariIdx = heads.findIndex(th => th.textContent.trim() === '上がり順');
    if ([pastIdx, prevIdx, tenIdx, agariIdx].some(i => i < 0)) return;

    // Keep the first two columns pinned and make the four Lap-kun metrics explicit.
    heads[0]?.classList.add('v6-sticky-no');
    heads[1]?.classList.add('v6-sticky-name');
    heads[pastIdx]?.classList.add('v6-metric-head', 'v6-time-head', 'v6-group-start');
    heads[prevIdx]?.classList.add('v6-metric-head', 'v6-time-head');
    heads[tenIdx]?.classList.add('v6-metric-head', 'v6-rank-head');
    heads[agariIdx]?.classList.add('v6-metric-head', 'v6-rank-head', 'v6-group-end');

    const holeHead = heads.find(th => th.textContent.trim() === '穴');
    if (holeHead) {
      holeHead.textContent = '穴スコア';
      holeHead.title = 'KTMそのものの数字ではなく、KTM・33ラップ・調教・人気・オッズ等を加点した簡易スコア';
    }

    const rows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    rows.forEach(tr => {
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      if (!horse) return;

      // v5 used row text to locate the KTM column. On non-KTM horses that shifted the four
      // inserted fields by one cell. Remove those inserted cells and rebuild from horse data.
      [...tr.children].forEach(td => {
        if (td.classList.contains('v5-time-cell') || td.classList.contains('v5-rank-cell')) td.remove();
      });

      let base = [...tr.children];
      base.forEach(td => td.classList.remove('v6-metric-cell', 'v6-time-cell', 'v6-rank-cell', 'v6-group-start', 'v6-group-end'));
      base[0]?.classList.add('v6-sticky-no');
      base[1]?.classList.add('v6-sticky-name');

      // Original v4 row has KTM at index 8. v6 may already have rewritten that cell,
      // so restore it before inserting the four metrics.
      const ktmCell = base[8];
      if (!ktmCell) return;
      ktmCell.innerHTML = (typeof isKtm === 'function' && isKtm(horse)) ? '<span class="v4-ktm">KTM</span>' : '';

      tr.insertBefore(metricCell('time', horse.tenPast1f, true, false), ktmCell);
      tr.insertBefore(metricCell('time', horse.tenPrev1f, false, false), ktmCell);
      tr.insertBefore(metricCell('rank', horse.tenRank, false, false), ktmCell);
      tr.insertBefore(metricCell('rank', horse.agariRank, false, true), ktmCell);
    });

    table.querySelectorAll('.v4-horse-detail-row > td').forEach(td => { td.colSpan = 15; });

    const summary = body.querySelector('.v4-summary-line');
    if (summary && !body.querySelector('#v7ScoreNote')) {
      const note = document.createElement('div');
      note.id = 'v7ScoreNote';
      note.className = 'v5-format';
      note.style.margin = '0 0 12px';
      note.innerHTML = '<strong>KTMと穴スコアは別物です</strong><span>KTM＝条件に該当するかどうか。数値は「穴スコア」で、KTMなら+4ptを含め、33ラップ・調教・人気・オッズ等を加点したものです。</span>';
      summary.insertAdjacentElement('afterend', note);
    }

    table.dataset.v7fixed = '1';
  }

  function run() {
    if (busy) return;
    busy = true;
    try { fixDetailTable(); } finally { busy = false; }
  }

  run();
  const obs = new MutationObserver(() => setTimeout(run, 0));
  obs.observe(document.body, { childList: true, subtree: true });
})();