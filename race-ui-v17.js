// MY KEIBA LAB v17 - 枠色 + レース詳細ソート
// JRAの枠番配分を頭数と馬番から算出し、馬番/テン順/上がり順を軽量DOMソート。
(() => {
  if (typeof state === 'undefined' || window.__MYKEIBA_RACE_UI_V17__) return;
  window.__MYKEIBA_RACE_UI_V17__ = true;

  const SORT_LABELS = {
    number: '馬番順',
    tenRank: 'テン順位',
    agariRank: '上がり順位',
  };

  function num(v) {
    if (window.MyKeibaDataV16?.toNumber) return window.MyKeibaDataV16.toNumber(v);
    if (v === '' || v == null || String(v).trim() === '—') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // JRAの標準的な8枠配分。
  // 9〜16頭は外枠側から2頭枠、17〜18頭は外枠側から3頭枠になる。
  function frameNo(horseNo, fieldSize) {
    const n = Number(horseNo);
    const total = Number(fieldSize);
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(total) || total < 1 || n > total) return null;
    if (total <= 8) return Math.min(n, 8);

    if (total <= 16) {
      const singleFrames = 16 - total; // 9頭=7枠まで単枠、16頭=単枠なし
      if (n <= singleFrames) return n;
      return singleFrames + Math.ceil((n - singleFrames) / 2);
    }

    // 17頭: 1〜7枠が2頭、8枠が3頭
    // 18頭: 1〜6枠が2頭、7〜8枠が3頭
    const tripleFrames = total - 16;
    const doubleFrames = 8 - tripleFrames;
    const doubleHorses = doubleFrames * 2;
    if (n <= doubleHorses) return Math.ceil(n / 2);
    return doubleFrames + Math.ceil((n - doubleHorses) / 3);
  }

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return (state.races || []).find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function rowsByHorse(table) {
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

  function decorateFrameColors(table, race) {
    const total = (race.horses || []).length;
    const rowMap = rowsByHorse(table);

    for (const horse of race.horses || []) {
      const pair = rowMap.get(horse.id);
      const cell = pair?.main?.children?.[0];
      if (!cell) continue;
      const waku = frameNo(num(horse.number), total);
      if (!waku) continue;

      cell.dataset.waku = String(waku);
      cell.title = `${waku}枠 ${horse.number || '—'}番`;
      let chip = cell.querySelector('.v17-number-chip');
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'v17-number-chip';
        cell.textContent = '';
        cell.appendChild(chip);
      }
      chip.dataset.waku = String(waku);
      chip.textContent = horse.number || '—';
      chip.setAttribute('aria-label', `${waku}枠 ${horse.number || '—'}番`);
    }
  }

  function fallbackSort(horses, mode) {
    const list = [...horses];
    const value = h => mode === 'number' ? num(h.number) : num(h[mode]);
    return list.sort((a, b) => {
      const av = value(a), bv = value(b);
      if (av == null && bv == null) return (num(a.number) ?? 999) - (num(b.number) ?? 999);
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv || (num(a.number) ?? 999) - (num(b.number) ?? 999);
    });
  }

  function sortedHorses(race, mode) {
    if (window.MyKeibaDataV16?.sortHorses) return window.MyKeibaDataV16.sortHorses(race.horses || [], mode);
    return fallbackSort(race.horses || [], mode);
  }

  function applySort(table, race, mode) {
    const tbody = table.tBodies?.[0];
    if (!tbody) return;
    const rowMap = rowsByHorse(table);
    const frag = document.createDocumentFragment();

    for (const horse of sortedHorses(race, mode)) {
      const pair = rowMap.get(horse.id);
      if (pair?.main) frag.appendChild(pair.main);
      if (pair?.detail) frag.appendChild(pair.detail);
    }
    tbody.appendChild(frag);
    table.dataset.v17Sort = mode;

    const toolbar = document.querySelector('#v17SortBar');
    toolbar?.querySelectorAll('[data-v17-sort]').forEach(btn => {
      const active = btn.dataset.v17Sort === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function installToolbar(body, table, race) {
    let bar = body.querySelector('#v17SortBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'v17SortBar';
      bar.className = 'v17-sort-bar';
      bar.innerHTML = `
        <span class="v17-sort-label">並び替え</span>
        <div class="v17-sort-buttons">
          ${Object.entries(SORT_LABELS).map(([mode, label]) => `<button type="button" data-v17-sort="${mode}" aria-pressed="false">${label}</button>`).join('')}
        </div>
        <small>未取得「—」は下へ</small>`;

      const guide = body.querySelector('.v6-metric-guide');
      const wrap = table.closest('.v4-table-wrap');
      if (guide) guide.insertAdjacentElement('beforebegin', bar);
      else if (wrap) wrap.insertAdjacentElement('beforebegin', bar);
      else table.insertAdjacentElement('beforebegin', bar);
    }

    bar.querySelectorAll('[data-v17-sort]').forEach(btn => {
      btn.onclick = () => applySort(table, race, btn.dataset.v17Sort);
    });

    const current = table.dataset.v17Sort || 'number';
    bar.querySelectorAll('[data-v17-sort]').forEach(btn => {
      const active = btn.dataset.v17Sort === current;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function decorate() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table) return;
    const race = raceFromDetail();
    if (!race) return;

    decorateFrameColors(table, race);
    installToolbar(body, table, race);

    if (!table.dataset.v17Init) {
      table.dataset.v17Init = '1';
      applySort(table, race, 'number');
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .v17-sort-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 8px;padding:9px 10px;border:1px solid #dfe7e2;border-radius:14px;background:#f8faf9}
    .v17-sort-label{font-size:11px;font-weight:900;color:#3f5148;white-space:nowrap}
    .v17-sort-buttons{display:flex;gap:6px;flex-wrap:wrap}
    .v17-sort-buttons button{appearance:none;border:1px solid #cfdad3;background:#fff;color:#33443b;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;line-height:1;min-height:30px}
    .v17-sort-buttons button.active{background:#183e2d;color:#fff;border-color:#183e2d}
    .v17-sort-bar small{font-size:10px;color:#78867e;margin-left:auto}
    .v17-number-chip{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;border-radius:6px;font-weight:950;font-size:13px;box-sizing:border-box;border:1px solid rgba(0,0,0,.14)}
    .v17-number-chip[data-waku="1"]{background:#fff;color:#111;border-color:#aaa}
    .v17-number-chip[data-waku="2"]{background:#191919;color:#fff;border-color:#191919}
    .v17-number-chip[data-waku="3"]{background:#d9363e;color:#fff;border-color:#c92c34}
    .v17-number-chip[data-waku="4"]{background:#2670c9;color:#fff;border-color:#1f61b2}
    .v17-number-chip[data-waku="5"]{background:#f3cf2f;color:#111;border-color:#d8b81f}
    .v17-number-chip[data-waku="6"]{background:#36a45c;color:#fff;border-color:#2c8e4d}
    .v17-number-chip[data-waku="7"]{background:#ef8a2d;color:#111;border-color:#da7720}
    .v17-number-chip[data-waku="8"]{background:#ef9fbd;color:#111;border-color:#dc88a8}
    @media(max-width:520px){.v17-sort-bar{align-items:flex-start}.v17-sort-bar small{width:100%;margin-left:0}.v17-sort-buttons button{padding:7px 9px}}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (document.hidden || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('mykeiba:resume', schedule, { passive: true });

  window.MyKeibaRaceUIV17 = { frameNo, applySort, decorate };
})();
