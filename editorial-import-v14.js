// MY KEIBA LAB v14 - 新聞評価 一括取込
// ChatGPTで新聞PDFから整形した「ショータ本命 / 穴馬の資格 / 人気馬の死角」を全レースへ一括反映。
(() => {
  if (typeof state === 'undefined') return;

  const TRACKS = '札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉';
  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const norm = (v = '') => String(v).replace(/[\s　・･]/g, '').toLowerCase();
  const normTrack = (v = '') => String(v).replace(/競馬場/g, '').trim();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (typeof render === 'function') render();
  }

  function findRace(track, raceNo) {
    const t = normTrack(track);
    const rn = String(raceNo || '').replace(/R/ig, '').trim();
    return (state.races || []).find(r => normTrack(r.track) === t && String(r.raceNo) === rn) || null;
  }

  function findHorse(race, number, name = '') {
    const no = String(number || '').trim();
    const nm = norm(name);
    if (no) {
      const byNo = (race.horses || []).filter(h => String(h.number || '').trim() === no);
      if (byNo.length === 1) return byNo[0];
      if (nm) {
        const exact = byNo.find(h => norm(h.name) === nm || norm(h.name).startsWith(nm) || nm.startsWith(norm(h.name)));
        if (exact) return exact;
      }
    }
    if (nm) return (race.horses || []).find(h => norm(h.name) === nm) || null;
    return null;
  }

  function typeOf(label = '') {
    const s = String(label).replace(/\s+/g, '');
    if (/^(?:ショータ本命|ショータ◎|SHOTA)$/i.test(s)) return 'shota';
    if (/^(?:穴馬の資格|穴資格|VALUEQUALIFIER)$/i.test(s)) return 'hole';
    if (/^(?:人気馬の死角|死角|POPULARBLINDSPOT)$/i.test(s)) return 'blind';
    return '';
  }

  function parseText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
    const blocks = [];
    let block = null;
    for (const raw of lines) {
      if (/^MYKEIBA_EDITORIAL/i.test(raw) || /^#/.test(raw)) continue;
      const header = raw.match(new RegExp(`^(${TRACKS})\\s*[,|\\t ]\\s*(\\d{1,2})\\s*R?`, 'i'));
      if (header) {
        block = { track: header[1], raceNo: header[2], records: [] };
        blocks.push(block);
        continue;
      }
      if (!block) continue;
      const parts = raw.includes('|') ? raw.split('|').map(x => x.trim()) : raw.split(/\t+/).map(x => x.trim());
      if (!parts.length) continue;
      const type = typeOf(parts[0]);
      if (!type) continue;
      const second = String(parts[1] || '').trim();
      if (!second || /^(?:なし|該当なし|none)$/i.test(second)) {
        block.records.push({ type, none: true, number: '', name: '', reason: '' });
        continue;
      }
      block.records.push({
        type,
        none: false,
        number: second.replace(/番/g, '').trim(),
        name: String(parts[2] || '').trim(),
        reason: parts.slice(3).join('|').trim()
      });
    }
    return blocks.filter(b => b.records.length);
  }

  function applyHoleOverride(horse) {
    if (window.MyKeibaHoleManual?.applyOverride) return window.MyKeibaHoleManual.applyOverride(horse);
    horse.holeQualification = Boolean(horse.holeQualificationAuto);
    horse.holeQualificationReason = horse.holeQualificationAutoReason || '';
    return horse;
  }

  function applyBlock(block, now, misses) {
    const race = findRace(block.track, block.raceNo);
    if (!race) {
      misses.push(`${block.track}${block.raceNo}R（レース未一致）`);
      return false;
    }
    const byType = {
      shota: block.records.filter(x => x.type === 'shota'),
      hole: block.records.filter(x => x.type === 'hole'),
      blind: block.records.filter(x => x.type === 'blind')
    };

    if (byType.shota.length) {
      for (const h of race.horses || []) {
        h.shotaMain = false;
        h.shotaReason = '';
      }
      for (const rec of byType.shota.filter(x => !x.none)) {
        const h = findHorse(race, rec.number, rec.name);
        if (!h) { misses.push(`${race.track}${race.raceNo}R ショータ ${rec.number}番 ${rec.name}`); continue; }
        h.shotaMain = true;
        h.shotaMark = '◎';
        h.shotaReason = rec.reason || h.shotaReason || '';
        h.editorialChatImportedAt = now;
      }
    }

    if (byType.hole.length) {
      for (const h of race.horses || []) {
        h.holeQualificationAuto = false;
        h.holeQualificationAutoReason = '';
        applyHoleOverride(h);
      }
      for (const rec of byType.hole.filter(x => !x.none)) {
        const h = findHorse(race, rec.number, rec.name);
        if (!h) { misses.push(`${race.track}${race.raceNo}R 穴資格 ${rec.number}番 ${rec.name}`); continue; }
        h.holeQualificationAuto = true;
        h.holeQualificationAutoReason = rec.reason || '新聞の「穴馬の資格」該当馬';
        applyHoleOverride(h);
        h.editorialChatImportedAt = now;
      }
    }

    if (byType.blind.length) {
      for (const h of race.horses || []) {
        h.popularBlindSpot = false;
        h.popularBlindSpotReason = '';
      }
      for (const rec of byType.blind.filter(x => !x.none)) {
        const h = findHorse(race, rec.number, rec.name);
        if (!h) { misses.push(`${race.track}${race.raceNo}R 死角 ${rec.number}番 ${rec.name}`); continue; }
        h.popularBlindSpot = true;
        h.popularBlindSpotReason = rec.reason || '新聞の「人気馬の死角」該当馬';
        h.editorialChatImportedAt = now;
      }
    }

    race.editorialBatchUpdatedAt = now;
    race.editorialBatchSource = 'chat-v1';
    return true;
  }

  function applyEditorial(text) {
    const blocks = parseText(text);
    if (!blocks.length) return { ok: false, message: '新聞評価データを認識できませんでした。' };
    const now = new Date().toISOString();
    const misses = [];
    let races = 0;
    for (const block of blocks) if (applyBlock(block, now, misses)) races += 1;
    if (!races) return { ok: false, message: `一致するレースがありませんでした。${misses.length ? `\n${misses.slice(0,6).join(' / ')}` : ''}` };
    state.editorialBatchUpdatedAt = now;
    state.editorialBatchRaceCount = races;
    persist();
    return {
      ok: true,
      message: `${races}レースの新聞評価を一括反映しました。ショータ本命・穴馬の資格・人気馬の死角を更新しています。${misses.length ? `\n未一致 ${misses.length}件: ${misses.slice(0,5).join(' / ')}` : ''}`
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #v14EditorialImport{border-color:#b99cdd;background:#f7f1ff;color:#64458d}
    #v14EditorialImport.v14-active{background:#eee1ff;border-color:#9c76cb;color:#59377f}
    .v14-dialog{border:0;padding:0;width:min(600px,calc(100% - 24px));border-radius:22px;background:#fff;color:#16211c;box-shadow:0 22px 60px rgba(0,0,0,.28)}
    .v14-dialog::backdrop{background:rgba(0,0,0,.55)}
    .v14-sheet{padding:20px}.v14-sheet h3{margin:3px 0 6px;font-size:21px}.v14-sheet p{margin:0 0 14px;color:#637068;font-size:12px;line-height:1.6}
    .v14-sheet textarea{width:100%;box-sizing:border-box;border:1px solid #d9e0dc;border-radius:13px;padding:12px;background:#fff;font:inherit;color:#16211c;min-height:260px}
    .v14-format{margin-top:9px;padding:10px 11px;border-radius:11px;background:#f7f1ff;color:#64458d;font-size:11px;line-height:1.55}
    .v14-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.v14-actions button{border:0;border-radius:13px;padding:12px;font-weight:900}.v14-cancel{background:#eef2ef;color:#334139}.v14-apply{background:#7048a0;color:#fff}
    .v14-result{margin-top:10px;padding:10px;border-radius:11px;font-size:11px;white-space:pre-wrap}.v14-result.ok{background:#e9f8ef;color:#16653e}.v14-result.ng{background:#fff0ef;color:#9a2f28}
    .v14-stamp{display:block;font-size:10px;opacity:.75;margin-top:2px}
    .v14-blind-card{margin:14px 0;padding:18px 20px;border:1px solid #efb2b9;border-radius:22px;background:#fff2f4;box-shadow:0 8px 25px rgba(124,35,49,.06)}
    .v14-blind-head{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #f2cbd0;padding-bottom:12px;margin-bottom:12px}.v14-blind-head small{display:block;color:#9e4550;font-weight:900;letter-spacing:.08em}.v14-blind-head strong{display:block;color:#8f303d;font-size:22px;margin-top:2px}.v14-blind-head span{background:#ffe0e4;color:#923b47;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900}.v14-blind-row b{display:block;font-size:16px}.v14-blind-row p{margin:7px 0 0;color:#6b5558;font-size:13px;line-height:1.55}
    .v14-mini-blind{display:inline-flex;margin-top:4px;padding:3px 7px;border-radius:999px;background:#ffe0e4;color:#923b47;font-size:10px;font-weight:900}
  `;
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'v14-dialog';
  dialog.innerHTML = `
    <div class="v14-sheet">
      <small>EDITORIAL BATCH IMPORT</small>
      <h3>新聞評価 一括取込</h3>
      <p>新聞PDFをこのチャットに送ると、ラップ君が全レース分の評価データを作ります。そのデータをここへ1回貼るだけで一括反映します。</p>
      <textarea id="v14Text" placeholder="MYKEIBA_EDITORIAL_V1\n中山 1R\nショータ本命|11|イキフン|理由文\n穴馬の資格|8|ヴィシーチェック|理由文\n人気馬の死角|9|サクセスボーイ|理由文\n\n中山 2R\nショータ本命|...\n穴馬の資格|なし\n人気馬の死角|..."></textarea>
      <div class="v14-format"><b>基本形式</b><br>開催場 R → 評価名｜馬番｜馬名｜理由<br>対象：ショータ本命 / 穴馬の資格 / 人気馬の死角<br>該当なしは「穴馬の資格｜なし」のように指定できます。穴資格の手動補正がある場合は手動指定を優先します。</div>
      <div class="v14-actions"><button type="button" class="v14-cancel">キャンセル</button><button type="button" class="v14-apply">一括反映する</button></div>
      <div id="v14Result" class="v14-result" hidden></div>
    </div>`;
  document.body.appendChild(dialog);

  function openDialog() {
    const area = dialog.querySelector('#v14Text');
    area.value = '';
    dialog.querySelector('#v14Result').hidden = true;
    dialog.showModal();
    setTimeout(() => area.focus(), 50);
  }
  dialog.querySelector('.v14-cancel').onclick = () => dialog.close();
  dialog.querySelector('.v14-apply').onclick = () => {
    const result = applyEditorial(dialog.querySelector('#v14Text').value);
    const out = dialog.querySelector('#v14Result');
    out.hidden = false;
    out.className = `v14-result ${result.ok ? 'ok' : 'ng'}`;
    out.textContent = result.message;
    decorateMainButton();
    if (result.ok) setTimeout(() => dialog.close(), 1100);
  };

  function fmtStamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function decorateMainButton() {
    const actions = document.querySelector('.hero-actions');
    if (!actions) return;
    let btn = document.querySelector('#v14EditorialImport');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'v14EditorialImport';
      btn.type = 'button';
      btn.className = 'secondary-btn';
      actions.appendChild(btn);
    }
    const stamp = fmtStamp(state.editorialBatchUpdatedAt);
    btn.classList.toggle('v14-active', Boolean(stamp));
    btn.innerHTML = stamp ? `新聞評価 一括取込<span class="v14-stamp">更新 ${esc(stamp)} / ${Number(state.editorialBatchRaceCount || 0)}R</span>` : '新聞評価 一括取込';
    btn.onclick = openDialog;
  }

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return (state.races || []).find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function decorateBlindSpot() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table) return;
    const race = raceFromDetail();
    if (!race) return;
    const blinds = (race.horses || []).filter(h => h.popularBlindSpot);
    if (blinds.length && !body.querySelector('#v14BlindCard')) {
      const html = `<section id="v14BlindCard" class="v14-blind-card"><div class="v14-blind-head"><div><small>POPULAR BLIND SPOT</small><strong>⊖ 人気馬の死角</strong></div><span>${blinds.length}頭</span></div>${blinds.map(h => `<div class="v14-blind-row"><b>${esc(h.number || '—')}. ${esc(h.name)}</b><p>${esc(h.popularBlindSpotReason || '新聞の「人気馬の死角」該当馬')}</p></div>`).join('')}</section>`;
      const editorial = body.querySelector('#v8EditorialCards');
      const wrap = table.closest('.v4-table-wrap') || table;
      if (editorial) editorial.insertAdjacentHTML('afterend', html); else wrap.insertAdjacentHTML('beforebegin', html);
    }
    [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row')).forEach(tr => {
      const id = tr.querySelector('[data-v4-expand]')?.dataset.v4Expand;
      const h = (race.horses || []).find(x => x.id === id);
      if (!h?.popularBlindSpot) return;
      const cell = tr.children[1];
      if (!cell || cell.querySelector('.v14-mini-blind')) return;
      const tag = document.createElement('span');
      tag.className = 'v14-mini-blind';
      tag.textContent = '人気馬の死角';
      const tags = cell.querySelector('.v8-name-tags');
      if (tags) tags.appendChild(tag); else cell.appendChild(tag);
    });
  }

  function appendBlindToConsult() {
    const race = raceFromDetail();
    const area = document.querySelector('#v6ConsultText');
    if (!race || !area || area.value.includes('人気馬の死角:')) return;
    const blinds = (race.horses || []).filter(h => h.popularBlindSpot);
    if (!blinds.length) return;
    const line = `人気馬の死角: ${blinds.map(h => `${h.number || '—'}番 ${h.name}${h.popularBlindSpotReason ? `（${h.popularBlindSpotReason}）` : ''}`).join(' / ')}`;
    if (area.value.includes('穴馬の資格:')) area.value = area.value.replace(/(穴馬の資格:[^\n]*\n)/, `$1${line}\n`);
    else if (area.value.includes('■新聞評価')) area.value = area.value.replace('■新聞評価\n', `■新聞評価\n${line}\n`);
  }

  function wireConsult() {
    const btn = document.querySelector('#v5AskLapkun');
    if (!btn || btn.dataset.v14 === '1') return;
    btn.dataset.v14 = '1';
    btn.addEventListener('click', () => {
      setTimeout(appendBlindToConsult, 160);
      setTimeout(appendBlindToConsult, 320);
    });
  }

  function run() {
    decorateMainButton();
    decorateBlindSpot();
    wireConsult();
  }
  run();
  const observer = new MutationObserver(() => setTimeout(run, 0));
  observer.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaEditorialBatch = { parseText, applyEditorial };
})();
