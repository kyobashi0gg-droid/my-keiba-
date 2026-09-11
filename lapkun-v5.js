// MY KEIBA LAB v5 - ラップ君（ChatGPT）連携
// スクショをChatGPTで読み取り -> 反映データを貼付 -> 馬番/馬名で既存レースへ統合。
(() => {
  if (typeof state === 'undefined') return;

  const FIELDS = [
    ['tenPast1f', 'テン1F過去'],
    ['tenPrev1f', 'テン1F前走'],
    ['tenRank', 'テン順'],
    ['agariRank', '上がり順'],
  ];

  let currentRaceId = '';
  let observerBusy = false;

  const esc5 = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const normalizeName = (v = '') => String(v).replace(/[\s　・･]/g, '').toLowerCase();
  const normalizeTrack = (v = '') => String(v).replace(/競馬場/g, '').trim();
  const clean = v => {
    const s = String(v ?? '').trim();
    return /^(?:-|—|―|−|なし|null)$/i.test(s) ? '' : s;
  };

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (typeof render === 'function') render();
  }

  function findRace(track, raceNo, preferredId = '') {
    if (preferredId) {
      const exact = state.races.find(r => r.id === preferredId);
      if (exact) return exact;
    }
    const t = normalizeTrack(track);
    const rn = String(raceNo || '').replace(/R/ig, '').trim();
    if (!t || !rn) return null;
    return state.races.find(r => normalizeTrack(r.track) === t && String(r.raceNo) === rn) || null;
  }

  function findHorse(race, number, name) {
    const num = String(number || '').trim();
    const nm = normalizeName(name);
    if (num && nm) {
      const both = (race.horses || []).find(h => String(h.number || '').trim() === num && normalizeName(h.name) === nm);
      if (both) return both;
    }
    if (num) {
      const byNo = (race.horses || []).filter(h => String(h.number || '').trim() === num);
      if (byNo.length === 1) return byNo[0];
    }
    if (nm) return (race.horses || []).find(h => normalizeName(h.name) === nm) || null;
    return null;
  }

  function parseJson(text) {
    const obj = JSON.parse(text);
    const blocks = Array.isArray(obj) ? obj : Array.isArray(obj.races) ? obj.races : [obj];
    return blocks.map(block => ({
      track: block.track || block.開催場 || '',
      raceNo: block.raceNo || block.R || block.race || block.レース番号 || '',
      horses: (block.horses || block.馬 || block.data || []).map(h => ({
        number: h.number ?? h.馬番 ?? '',
        name: h.name ?? h.馬名 ?? '',
        tenPast1f: h.tenPast1f ?? h['テン1F過去'] ?? '',
        tenPrev1f: h.tenPrev1f ?? h['テン1F前走'] ?? '',
        tenRank: h.tenRank ?? h['テン順'] ?? '',
        agariRank: h.agariRank ?? h['上がり順'] ?? '',
      }))
    }));
  }

  function parseText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
    const blocks = [];
    let block = { track: '', raceNo: '', horses: [] };

    const pushBlock = () => {
      if (block.horses.length) blocks.push(block);
      block = { track: '', raceNo: '', horses: [] };
    };

    for (const raw of lines) {
      if (/^MYKEIBA_LAPDATA/i.test(raw) || /^(?:馬番[|,\t]|#)/.test(raw)) continue;

      const header = raw.match(/^(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)\s*[,|\t ]\s*(\d{1,2})\s*R?/i);
      if (header) {
        if (block.horses.length) pushBlock();
        block.track = header[1];
        block.raceNo = header[2];
        continue;
      }

      const sep = raw.includes('|') ? '|' : raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
      let parts = sep ? raw.split(sep).map(s => s.trim()) : raw.split(/\s+/);
      if (parts.length < 6) continue;
      if (!/^\d{1,2}$/.test(parts[0])) continue;

      block.horses.push({
        number: parts[0],
        name: parts[1],
        tenPast1f: clean(parts[2]),
        tenPrev1f: clean(parts[3]),
        tenRank: clean(parts[4]).replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱]/g, c => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱'.indexOf(c) + 1),
        agariRank: clean(parts[5]).replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱]/g, c => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱'.indexOf(c) + 1),
      });
    }
    if (block.horses.length) blocks.push(block);
    return blocks;
  }

  function parseLapkun(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return [];
    if (/^[\[{]/.test(trimmed)) {
      try { return parseJson(trimmed); } catch {}
    }
    return parseText(trimmed);
  }

  function applyLapkun(text, preferredRaceId = '') {
    const blocks = parseLapkun(text);
    if (!blocks.length) return { ok: false, message: '反映できるデータを認識できませんでした。' };

    let matched = 0;
    let misses = [];
    let changedRaces = new Set();

    for (const block of blocks) {
      const race = findRace(block.track, block.raceNo, preferredRaceId && blocks.length === 1 ? preferredRaceId : '');
      if (!race) {
        misses.push(`${block.track || '?'} ${block.raceNo || '?'}R（レース未一致）`);
        continue;
      }
      for (const row of block.horses) {
        const horse = findHorse(race, row.number, row.name);
        if (!horse) {
          misses.push(`${race.track}${race.raceNo}R ${row.number}番 ${row.name}`);
          continue;
        }
        for (const [key] of FIELDS) horse[key] = clean(row[key]);
        horse.lapkunImportedAt = new Date().toISOString();
        matched += 1;
        changedRaces.add(race.id);
      }
    }

    if (!matched) return { ok: false, message: `一致する馬がありませんでした。${misses.length ? `\n未一致: ${misses.slice(0, 5).join(' / ')}` : ''}` };
    persist();
    return {
      ok: true,
      message: `${changedRaces.size}レース・${matched}頭にラップ君データを反映しました。${misses.length ? `\n未一致 ${misses.length}件: ${misses.slice(0, 4).join(' / ')}` : ''}`
    };
  }

  function installImportDialog() {
    if (document.querySelector('#v5Import')) return;
    const wrap = document.createElement('div');
    wrap.id = 'v5Import';
    wrap.className = 'v5-modal';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="v5-panel">
        <div class="v5-panel-head"><div><p class="v4-eyebrow">LAP-KUN DATA</p><h2>ラップ君データ取込</h2></div><button id="v5ImportClose" class="v4-close">閉じる</button></div>
        <p class="v5-help">このチャットでスクショをラップ君（ChatGPT）に送る → 返ってきた反映データをここへ貼り付けます。馬番＋馬名で照合します。</p>
        <textarea id="v5ImportText" class="v5-textarea" rows="12" placeholder="MYKEIBA_LAPDATA_V1\n阪神 11R\n5|ピースワンデュック|122|127|1|2\n7|ジーティーアダマン|123|126|2|4"></textarea>
        <div class="v5-format"><strong>列順</strong><span>馬番｜馬名｜テン1F過去｜テン1F前走｜テン順｜上がり順</span></div>
        <div class="v5-actions"><button id="v5FillSample" class="v4-secondary">見本を入れる</button><button id="v5Apply" class="v4-primary">反映する</button></div>
        <div id="v5ImportResult" class="v5-result" hidden></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) closeImport(); });
    wrap.querySelector('#v5ImportClose').onclick = closeImport;
    wrap.querySelector('#v5FillSample').onclick = () => {
      const race = currentRaceId ? state.races.find(r => r.id === currentRaceId) : state.races[0];
      const rows = (race?.horses || []).slice(0, 3).map(h => `${h.number || ''}|${h.name}|—|—|—|—`).join('\n');
      wrap.querySelector('#v5ImportText').value = `MYKEIBA_LAPDATA_V1\n${race ? `${race.track} ${race.raceNo}R` : '阪神 11R'}\n${rows}`;
    };
    wrap.querySelector('#v5Apply').onclick = () => {
      const result = applyLapkun(wrap.querySelector('#v5ImportText').value, currentRaceId);
      const out = wrap.querySelector('#v5ImportResult');
      out.hidden = false;
      out.className = `v5-result ${result.ok ? 'ok' : 'ng'}`;
      out.textContent = result.message;
      if (result.ok) setTimeout(() => closeImport(), 1000);
    };
  }

  function openImport(raceId = '') {
    currentRaceId = raceId || currentRaceId || '';
    installImportDialog();
    const modal = document.querySelector('#v5Import');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('#v5ImportText')?.focus(), 50);
  }

  function closeImport() {
    const modal = document.querySelector('#v5Import');
    if (modal) modal.hidden = true;
    const detailOpen = document.querySelector('#v4Detail') && !document.querySelector('#v4Detail').hidden;
    if (!detailOpen) document.body.style.overflow = '';
  }

  function raceFromDetail() {
    const buttons = document.querySelectorAll('#v4DetailBody [data-v4-expand]');
    if (!buttons.length) return null;
    const horseId = buttons[0].dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function value(v) { return v === '' || v == null ? '—' : String(v); }

  function augmentDetail() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table || table.dataset.v5 === '1') return;
    const race = raceFromDetail();
    if (!race) return;
    currentRaceId = race.id;
    table.dataset.v5 = '1';

    const headRow = table.querySelector('thead tr');
    const ths = [...headRow.children];
    const ktmIndex = ths.findIndex(th => th.textContent.trim() === 'KTM');
    const insertIndex = ktmIndex >= 0 ? ktmIndex : Math.max(0, ths.length - 2);
    const labels = ['テン1F過去', 'テン1F前走', 'テン順', '上がり順'];
    labels.forEach((label, offset) => {
      const th = document.createElement('th'); th.textContent = label;
      headRow.insertBefore(th, headRow.children[insertIndex + offset] || null);
    });

    const mainRows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    mainRows.forEach(tr => {
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = race.horses.find(h => h.id === btn?.dataset.v4Expand);
      if (!horse) return;
      const currentCells = [...tr.children];
      const cellKtmIndex = currentCells.findIndex(td => td.textContent.includes('KTM'));
      const idx = cellKtmIndex >= 0 ? cellKtmIndex : Math.max(0, currentCells.length - 2);
      [horse.tenPast1f, horse.tenPrev1f, horse.tenRank, horse.agariRank].forEach((v, offset) => {
        const td = document.createElement('td');
        td.className = offset >= 2 ? 'v5-rank-cell' : 'v5-time-cell';
        td.textContent = value(v);
        tr.insertBefore(td, tr.children[idx + offset] || null);
      });
    });

    table.querySelectorAll('.v4-horse-detail-row').forEach(row => {
      const horseId = row.dataset.v4DetailRow;
      const horse = race.horses.find(h => h.id === horseId);
      const td = row.querySelector('td');
      if (!horse || !td) return;
      td.colSpan = Number(td.colSpan || 11) + 4;
      const wall = td.querySelector('.v4-detail-box:last-child');
      if (wall) {
        wall.innerHTML = `<strong>ラップ君 壁打ち材料</strong><div class="v5-four"><span>テン1F過去<b>${esc5(value(horse.tenPast1f))}</b></span><span>テン1F前走<b>${esc5(value(horse.tenPrev1f))}</b></span><span>テン順<b>${esc5(value(horse.tenRank))}</b></span><span>上がり順<b>${esc5(value(horse.agariRank))}</b></span></div><p>33ラップ ${esc5(horse.lap || '—')} / KTM ${isKtm(horse) ? '該当' : '—'}</p>`;
      }
    });

    const summary = body.querySelector('.v4-summary-line');
    if (summary && !body.querySelector('#v5RaceTools')) {
      const tools = document.createElement('div');
      tools.id = 'v5RaceTools'; tools.className = 'v5-race-tools';
      tools.innerHTML = `<button class="v4-secondary" id="v5RaceImport">ラップ君データ取込</button><button class="v4-primary" id="v5AskLapkun">ラップ君に相談</button>`;
      summary.insertAdjacentElement('afterend', tools);
      tools.querySelector('#v5RaceImport').onclick = () => openImport(race.id);
      tools.querySelector('#v5AskLapkun').onclick = () => makeConsultText(race);
    }
  }

  function makeConsultText(race) {
    const lines = [
      `【MY KEIBA LAB 壁打ち】${race.track}${race.raceNo}R ${race.raceName}`,
      `コース:${race.v3Course || '—'} / 平均33:${race.v3Avg33 ?? '—'} / レベル:${race.v3RaceLevel || '—'}`,
      '馬番|馬名|人気|オッズ|自分印|KTM|調教印|採点|前走比|33|テン1F過去|テン1F前走|テン順|上がり順',
      ...(race.horses || []).map(h => [
        h.number || '', h.name || '', h.popularity || '', h.odds || '', h.userMark || '',
        isKtm(h) ? 'KTM' : '', h.mark || '', h.trainingScore || '', h.diff ?? '', h.lap || '',
        h.tenPast1f || '', h.tenPrev1f || '', h.tenRank || '', h.agariRank || ''
      ].join('|')),
      '',
      'ラップ君、このデータで展開・33ラップ適性・調教・テン/上がり・人気のバランスから、特に人気薄の好走候補を壁打ちしてください。'
    ].join('\n');

    navigator.clipboard?.writeText(lines).then(() => {
      alert('壁打ち用データをコピーしました。このチャットに貼り付けてください。');
    }).catch(() => {
      openImport(race.id);
      const area = document.querySelector('#v5ImportText');
      area.value = lines; area.select();
      alert('自動コピーできなかったため、テキストを表示しました。コピーしてチャットへ貼ってください。');
    });
  }

  function augmentHome() {
    const app = document.querySelector('#v4App');
    if (!app) return;
    const roadmap = app.querySelector('[data-view="home"] .v4-roadmap');
    if (roadmap && roadmap.dataset.v5 !== '1') {
      roadmap.dataset.v5 = '1';
      roadmap.innerHTML = `
        <div class="v4-road on"><strong>テン1F過去</strong><small>スクショ連携</small></div>
        <div class="v4-road on"><strong>テン1F前走</strong><small>スクショ連携</small></div>
        <div class="v4-road on"><strong>テン順</strong><small>スクショ連携</small></div>
        <div class="v4-road on"><strong>上がり順</strong><small>スクショ連携</small></div>`;
      const p = roadmap.nextElementSibling;
      if (p) p.textContent = 'ラップ君＝ChatGPT。スクショをチャットで解析し、この4項目を馬番＋馬名でサイトへ反映します。33ラップ・KTM・調教と合わせて壁打ちできます。';
    }

    const actionGrid = app.querySelector('[data-view="home"] .v4-action-grid');
    if (actionGrid && !actionGrid.querySelector('#v5HomeImport')) {
      const btn = document.createElement('button'); btn.id = 'v5HomeImport'; btn.className = 'v4-secondary'; btn.textContent = 'ラップ君データ取込';
      btn.onclick = () => openImport('');
      actionGrid.appendChild(btn);
    }

    const actions = app.querySelector('.v4-actions');
    if (actions && !actions.querySelector('#v5HeaderImport')) {
      const btn = document.createElement('button'); btn.id = 'v5HeaderImport'; btn.className = 'v4-icon-btn'; btn.textContent = 'ラップ君';
      btn.onclick = () => openImport('');
      actions.insertBefore(btn, actions.firstChild);
    }
  }

  function augment() {
    if (observerBusy) return;
    observerBusy = true;
    try { augmentHome(); augmentDetail(); } finally { observerBusy = false; }
  }

  installImportDialog();
  augment();
  const obs = new MutationObserver(() => setTimeout(augment, 0));
  obs.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaLapkun = { openImport, applyLapkun, makeConsultText };
})();
