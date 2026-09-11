// MY KEIBA LAB v8 - ショータ本命 + 穴馬の資格
(() => {
  if (typeof state === 'undefined') return;

  let busy = false;

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const normalizeName = (v = '') => String(v).replace(/[\s　・･]/g, '').toLowerCase();

  function markSymbols(s = '') {
    return [...String(s)].filter(ch => /[◎○▲☆△×・]/.test(ch));
  }

  // User rule: rightmost = training mark. With 3 marks, the one just left of it is Shota.
  // With 2 marks, the left mark is treated as the prediction mark.
  function shotaMarkFromString(s = '') {
    const a = markSymbols(s);
    if (a.length >= 3) return a[a.length - 2] === '・' ? '' : a[a.length - 2];
    if (a.length === 2) return a[0] === '・' ? '' : a[0];
    return '';
  }

  function cleanEditorialText(v = '') {
    return String(v || '')
      .replace(/人気馬の[⊖\-]?死角[⊖\-]?/g, '')
      .replace(/穴馬の[⊕+]?資格[⊕+]?/g, '')
      .replace(/^◎\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bestNameMatch(race, number, rowText = '') {
    const byNo = (race.horses || []).find(h => String(h.number || '') === String(number || ''));
    if (!byNo) return null;
    const normRow = normalizeName(rowText);
    const normName = normalizeName(byNo.name);
    if (!normName) return byNo;
    if (normRow.includes(normName)) return byNo;
    // PDF box may abbreviate the name. Number match is still unique within a race.
    return byNo;
  }

  function extractHoleByCoordinates(page, race) {
    if (typeof v3ItemsIn !== 'function' || typeof v3BuildRows !== 'function') return null;

    // Right-hand editorial box on the premium PDF page.
    const boxItems = v3ItemsIn(page, 438, 595, 24, 132, () => true);
    if (!boxItems.length) return null;
    const rows = v3BuildRows(boxItems, 2.8);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const texts = row.items.map(x => x.text);
      const rowText = texts.join(' ');
      if (/穴馬の.*資格/.test(rowText)) continue;

      const noToken = texts.find(t => /^(?:[1-9]|1[0-8])$/.test(t));
      if (!noToken) continue;
      const horse = bestNameMatch(race, noToken, rowText);
      if (!horse) continue;

      const chunks = [];
      for (let j = i; j < rows.length; j++) {
        const lineTexts = rows[j].items.map(x => x.text);
        if (j > i && lineTexts.some(t => /^(?:[1-9]|1[0-8])$/.test(t))) break;
        let line = lineTexts.join(' ');
        if (j === i) {
          line = line.replace(new RegExp(`(^|\\s)${String(noToken).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`), ' ');
          // Remove the horse name or abbreviated prefix immediately after the number.
          const parts = line.trim().split(/\s+/);
          if (parts.length && normalizeName(horse.name).startsWith(normalizeName(parts[0]))) parts.shift();
          line = parts.join(' ');
        }
        line = cleanEditorialText(line);
        if (line) chunks.push(line);
      }

      const reason = chunks.join(' ').trim();
      if (reason) return { horse, reason };
    }
    return null;
  }

  function extractHoleByText(page, race) {
    const lines = String(page?.text || '').split('\n').map(x => x.trim()).filter(Boolean);
    const idx = lines.findIndex(line => /人気馬の.*死角/.test(line) && /穴馬の.*資格/.test(line));
    if (idx < 0) return null;

    const found = [];
    for (let i = idx + 1; i < Math.min(lines.length, idx + 18); i++) {
      const m = lines[i].match(/^◎?\s*(\d{1,2})\s+([^\s]+)\s*(.*)$/);
      if (!m) continue;
      const horse = bestNameMatch(race, m[1], `${m[2]} ${m[3]}`);
      if (!horse) continue;
      found.push({ horse, reason: cleanEditorialText(m[3]) });
      if (found.length >= 2) break;
    }
    // PDF text order is left box (popular horse blind spot), then right box (hole qualification).
    return found[1] || null;
  }

  function enrichRaceFromPage(page, race) {
    if (!race) return race;

    for (const horse of race.horses || []) {
      horse.shotaMark = shotaMarkFromString(horse.v3MarkString || '');
      horse.shotaMain = horse.shotaMark === '◎';
      horse.holeQualification = false;
      horse.holeQualificationReason = '';
      horse.shotaReason = '';
    }

    const hole = extractHoleByCoordinates(page, race) || extractHoleByText(page, race);
    if (hole?.horse) {
      hole.horse.holeQualification = true;
      hole.horse.holeQualificationReason = hole.reason || '';
      if (hole.horse.shotaMain) hole.horse.shotaReason = hole.reason || '';
    }

    // If Shota ◎ and hole candidate are the same horse, the qualification note is useful as the reason card.
    for (const horse of race.horses || []) {
      if (horse.shotaMain && !horse.shotaReason && horse.holeQualificationReason) {
        horse.shotaReason = horse.holeQualificationReason;
      }
    }
    return race;
  }

  // Extend the premium PDF parser before the next file import.
  if (typeof v3ParsePremiumRacePage === 'function') {
    const originalParse = v3ParsePremiumRacePage;
    v3ParsePremiumRacePage = function(page) {
      return enrichRaceFromPage(page, originalParse(page));
    };
  }

  // Preserve Lap-kun/user data when the same PDF is re-imported, while taking fresh editorial info from the PDF.
  if (typeof v3MergeHorse === 'function') {
    const originalMerge = v3MergeHorse;
    v3MergeHorse = function(existing, incoming) {
      const merged = originalMerge(existing, incoming);
      const preserve = ['tenPast1f', 'tenPrev1f', 'tenRank', 'agariRank', 'userMark', 'lapkunImportedAt'];
      for (const key of preserve) {
        if ((existing?.[key] !== '' && existing?.[key] != null) && (incoming?.[key] === '' || incoming?.[key] == null)) {
          merged[key] = existing[key];
        }
      }
      merged.shotaMark = incoming?.shotaMark ?? shotaMarkFromString(incoming?.v3MarkString || existing?.v3MarkString || '');
      merged.shotaMain = incoming?.shotaMain ?? (merged.shotaMark === '◎');
      merged.holeQualification = Boolean(incoming?.holeQualification);
      merged.holeQualificationReason = incoming?.holeQualificationReason || '';
      merged.shotaReason = incoming?.shotaReason || '';
      return merged;
    };
  }

  // Existing saved data can already recover Shota ◎ from the stored mark string.
  let migrated = false;
  for (const race of state.races || []) {
    for (const horse of race.horses || []) {
      const mark = shotaMarkFromString(horse.v3MarkString || '');
      if (horse.shotaMark !== mark || horse.shotaMain !== (mark === '◎')) {
        horse.shotaMark = mark;
        horse.shotaMain = mark === '◎';
        migrated = true;
      }
    }
  }
  if (migrated) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function editorialCards(race) {
    const shota = (race.horses || []).filter(h => h.shotaMain);
    const holes = (race.horses || []).filter(h => h.holeQualification);
    if (!shota.length && !holes.length) return '';

    const shotaHtml = shota.length ? `<section class="v8-editorial v8-shota">
      <div class="v8-editorial-head"><div><small>SHOTA MAIN PICK</small><strong>ショータの本命</strong></div><span>ショータ◎</span></div>
      ${shota.map(h => `<div class="v8-editorial-row"><b>${esc(h.number || '—')}. ${esc(h.name)}</b>${h.shotaReason ? `<p>${esc(h.shotaReason)}</p>` : '<p>PDFのショータ印から◎を取得。専用理由は未取得です。</p>'}</div>`).join('')}
    </section>` : '';

    const holeHtml = holes.length ? `<section class="v8-editorial v8-hole">
      <div class="v8-editorial-head"><div><small>VALUE QUALIFIER</small><strong>⊕ 穴馬の資格</strong></div><span>${holes.length}頭</span></div>
      ${holes.map(h => `<div class="v8-editorial-row"><b>${esc(h.number || '—')}. ${esc(h.name)}</b><p>${esc(h.holeQualificationReason || '新聞の「穴馬の資格」該当馬')}</p></div>`).join('')}
    </section>` : '';

    return `<div id="v8EditorialCards" class="v8-editorial-grid">${shotaHtml}${holeHtml}</div>`;
  }

  function decorateDetail() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table) return;
    const race = raceFromDetail();
    if (!race) return;

    // Cards are shown above the race table, like the earlier UI.
    if (!body.querySelector('#v8EditorialCards')) {
      const html = editorialCards(race);
      if (html) {
        const wrap = table.closest('.v4-table-wrap') || table;
        wrap.insertAdjacentHTML('beforebegin', html);
      }
    }

    // Make the two newspaper evaluations obvious directly in the race table.
    const rows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    rows.forEach(tr => {
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      if (!horse) return;
      const nameCell = tr.children[1];
      if (!nameCell || nameCell.querySelector('.v8-name-tags')) return;
      if (!horse.shotaMain && !horse.holeQualification) return;
      const tags = document.createElement('div');
      tags.className = 'v8-name-tags';
      if (horse.shotaMain) tags.insertAdjacentHTML('beforeend', '<span class="v8-mini shota">ショータ◎</span>');
      if (horse.holeQualification) tags.insertAdjacentHTML('beforeend', '<span class="v8-mini hole">穴資格</span>');
      nameCell.appendChild(tags);
    });

    // Add the editorial information to each expanded horse row too.
    table.querySelectorAll('.v4-horse-detail-row').forEach(row => {
      const horse = (race.horses || []).find(h => h.id === row.dataset.v4DetailRow);
      const td = row.querySelector('td');
      if (!horse || !td || td.querySelector('.v8-horse-editorial')) return;
      if (!horse.shotaMain && !horse.holeQualification) return;
      const box = document.createElement('div');
      box.className = 'v8-horse-editorial';
      box.innerHTML = `${horse.shotaMain ? `<div class="shota"><b>ショータ◎</b><span>${esc(horse.shotaReason || 'PDF印から取得')}</span></div>` : ''}${horse.holeQualification ? `<div class="hole"><b>穴馬の資格</b><span>${esc(horse.holeQualificationReason || '該当')}</span></div>` : ''}`;
      td.appendChild(box);
    });
  }

  function appendEditorialToConsult() {
    const race = raceFromDetail();
    const area = document.querySelector('#v6ConsultText');
    if (!race || !area || area.dataset.v8 === '1') return;
    const shota = (race.horses || []).filter(h => h.shotaMain);
    const holes = (race.horses || []).filter(h => h.holeQualification);
    if (!shota.length && !holes.length) return;

    const lines = [
      '■新聞評価',
      `ショータ本命: ${shota.length ? shota.map(h => `${h.number || '—'}番 ${h.name}${h.shotaReason ? `（${h.shotaReason}）` : ''}`).join(' / ') : 'なし'}`,
      `穴馬の資格: ${holes.length ? holes.map(h => `${h.number || '—'}番 ${h.name}${h.holeQualificationReason ? `（${h.holeQualificationReason}）` : ''}`).join(' / ') : 'なし'}`,
      ''
    ].join('\n');

    const marker = '■データ上の事実メモ';
    area.value = area.value.includes(marker) ? area.value.replace(marker, `${lines}${marker}`) : `${area.value}\n\n${lines}`;
    area.dataset.v8 = '1';
  }

  function wireConsult() {
    const btn = document.querySelector('#v5AskLapkun');
    if (!btn || btn.dataset.v8 === '1') return;
    btn.dataset.v8 = '1';
    btn.addEventListener('click', () => setTimeout(appendEditorialToConsult, 60));
  }

  function run() {
    if (busy) return;
    busy = true;
    try { decorateDetail(); wireConsult(); } finally { busy = false; }
  }

  run();
  const observer = new MutationObserver(() => setTimeout(run, 0));
  observer.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaEditorial = { shotaMarkFromString, enrichRaceFromPage };
})();
