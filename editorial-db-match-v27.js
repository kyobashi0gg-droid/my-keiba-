// MY KEIBA LAB v27 - 新聞評価 × DB33 一致表示
// PDF新聞の強評価（ショータ◎ / 穴馬の資格 / KTM）とDB33適合を一目で確認する。
(() => {
  if (window.__MYKEIBA_EDITORIAL_DB_MATCH_V27__) return;
  window.__MYKEIBA_EDITORIAL_DB_MATCH_V27__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const id = first.dataset.v4Expand;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    return races.find(r => (r.horses || []).some(h => h.id === id)) || null;
  }

  function dbHit(race, horse) {
    const api = window.MyKeibaDbScoreConsultV22;
    const cache = api?.fitCache;
    if (!cache || !race || !horse) return null;
    const direct = cache.get(`${race.id || ''}|${norm(horse.name)}`);
    if (direct) return direct;
    for (const [k, v] of cache.entries()) {
      if (k.startsWith(`${race.id || ''}|`) && k.endsWith(norm(horse.name))) return v;
    }
    return null;
  }

  function newspaperFlags(horse, race) {
    const flags = [];
    if (horse?.shotaMain) flags.push({ key:'shota', label:'ショータ◎' });
    if (horse?.holeQualification) flags.push({ key:'hole', label:'穴資格' });
    try { if (typeof isKtm === 'function' && isKtm(horse)) flags.push({ key:'ktm', label:'KTM' }); } catch {}
    if (horse?.popularBlindSpot) flags.push({ key:'blind', label:'人気馬の死角' });
    return flags;
  }

  function classify(horse, race, hit) {
    if (!hit?.grade) return { rank:0, key:'no-db', label:'DB未登録', detail:'DB33未判定' };
    const flags = newspaperFlags(horse, race);
    const positive = flags.filter(x => x.key !== 'blind');
    const blind = flags.some(x => x.key === 'blind');

    if (positive.length && hit.grade === '◎') {
      return { rank:5, key:'strong', label:'強一致', detail:`新聞${positive.map(x=>x.label).join('・')} × DB33◎` };
    }
    if (positive.length && hit.grade === '○') {
      return { rank:4, key:'match', label:'一致', detail:`新聞${positive.map(x=>x.label).join('・')} × DB33○` };
    }
    if (blind && hit.grade === '△') {
      return { rank:3, key:'warning', label:'注意', detail:'人気馬の死角 × DB33△' };
    }
    if (hit.grade === '◎') {
      return { rank:2, key:'db', label:'DB適合', detail:'新聞強評価なし / DB33◎' };
    }
    if (positive.length && hit.grade === '△') {
      return { rank:1, key:'split', label:'評価割れ', detail:`新聞${positive.map(x=>x.label).join('・')} / DB33△` };
    }
    return { rank:0, key:'plain', label:'', detail:'' };
  }

  function zone(hit) {
    const s = hit?.summary;
    if (s?.zoneMin == null || s?.zoneMax == null) return '—';
    return s.zoneMin === s.zoneMax ? `${s.zoneMin}` : `${s.zoneMin}〜${s.zoneMax}`;
  }

  function rowHtml(item) {
    const flags = newspaperFlags(item.horse, item.race);
    const flagText = flags.length ? flags.map(x => x.label).join('・') : '新聞強評価なし';
    const basis = item.hit?.basis || '全体';
    return `<div class="v27-row ${item.cls.key}">
      <span class="v27-no">${esc(item.horse.number || '—')}</span>
      <div class="v27-main"><b>${esc(item.horse.name)}</b><small>${esc(flagText)} / ${esc(basis)} / 好走33帯 ${esc(zone(item.hit))}</small></div>
      <span class="v27-db">DB33 ${esc(item.hit?.grade || '—')}</span>
      <strong class="v27-result">${esc(item.cls.label)}</strong>
    </div>`;
  }

  function decorate() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table) return;
    const race = currentRace();
    if (!race) return;

    const items = (race.horses || []).map(horse => {
      const hit = dbHit(race, horse);
      return { race, horse, hit, cls: classify(horse, race, hit) };
    }).filter(x => x.hit && x.cls.rank > 0)
      .sort((a,b) => b.cls.rank - a.cls.rank || Number(a.horse.number || 99) - Number(b.horse.number || 99));

    let box = body.querySelector('#v27EditorialDbMatch');
    if (!box) {
      box = document.createElement('section');
      box.id = 'v27EditorialDbMatch';
      box.className = 'v27-match-box';
      const cards = body.querySelector('#v8EditorialCards');
      const wrap = table.closest('.v4-table-wrap') || table;
      if (cards) cards.insertAdjacentElement('afterend', box);
      else wrap.insertAdjacentElement('beforebegin', box);
    }

    box.innerHTML = `<div class="v27-head"><div><small>EDITORIAL × DB33</small><strong>新聞評価 × DB33</strong></div><span>${items.length}頭</span></div>
      <p class="v27-guide">ショータ◎・穴馬の資格・KTMと、条件別DB33適合を重ねて表示。PDFだけでは見えない33適合を補います。</p>
      <div class="v27-list">${items.length ? items.map(rowHtml).join('') : '<div class="v27-empty">現在のDB登録馬では一致表示対象がありません。</div>'}</div>
      <div class="v27-legend"><span><b>強一致</b> 新聞強評価＋DB33◎</span><span><b>一致</b> 新聞強評価＋DB33○</span><span><b>DB適合</b> DB33◎を独自発見</span><span><b>評価割れ</b> 新聞強評価だがDB33△</span></div>`;

    // レース表にも最小タグを追加して、スクロール中でも判断できるようにする。
    [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row')).forEach(tr => {
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      const nameCell = tr.children[1];
      if (!horse || !nameCell) return;
      nameCell.querySelector('.v27-mini')?.remove();
      const hit = dbHit(race, horse);
      const cls = classify(horse, race, hit);
      if (!cls.label || cls.rank <= 0) return;
      const tag = document.createElement('span');
      tag.className = `v27-mini ${cls.key}`;
      tag.textContent = `${cls.label}・DB${hit?.grade || '—'}`;
      tag.title = cls.detail;
      nameCell.appendChild(tag);
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .v27-match-box{margin:14px 0;padding:16px;border:1px solid #cfe3d7;border-radius:20px;background:#fbfdfb}
    .v27-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.v27-head small{display:block;font-size:10px;font-weight:900;letter-spacing:.12em;color:#2d8a5b}.v27-head strong{display:block;margin-top:2px;font-size:21px;color:#173d2b}.v27-head>span{background:#e7f5ec;color:#256443;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900}
    .v27-guide{margin:8px 0 10px;font-size:11px;line-height:1.55;color:#68776f}.v27-list{display:grid;gap:7px}.v27-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto auto;gap:7px;align-items:center;padding:9px 10px;border:1px solid #e3ebe6;border-radius:13px;background:#fff}.v27-no{font-weight:950;color:#40564a}.v27-main{display:grid;gap:2px;min-width:0}.v27-main b{font-size:13px;color:#253c31}.v27-main small{font-size:9px;color:#78857e;white-space:normal;line-height:1.45}.v27-db{font-size:10px;font-weight:900;color:#2b6747;white-space:nowrap}.v27-result{font-size:10px;padding:5px 7px;border-radius:999px;white-space:nowrap}.v27-row.strong{border-color:#8fd0aa;background:#f0fbf4}.v27-row.strong .v27-result{background:#1f8a55;color:#fff}.v27-row.match .v27-result{background:#dff2e7;color:#23613f}.v27-row.db .v27-result{background:#e7f1ff;color:#2a5f95}.v27-row.split{border-color:#ead9ae;background:#fffaf0}.v27-row.split .v27-result{background:#fff0c7;color:#825d08}.v27-row.warning{border-color:#efc6cb;background:#fff6f7}.v27-row.warning .v27-result{background:#ffe1e5;color:#8e3340}.v27-legend{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.v27-legend span{font-size:9px;color:#718078}.v27-legend b{color:#304d3e}.v27-empty{padding:10px;border:1px dashed #d7e1da;border-radius:12px;color:#78857e;font-size:11px}
    .v27-mini{display:inline-flex;margin-top:4px;margin-left:4px;padding:3px 6px;border-radius:999px;font-size:9px;font-weight:950;vertical-align:middle}.v27-mini.strong{background:#1f8a55;color:#fff}.v27-mini.match{background:#dff2e7;color:#23613f}.v27-mini.db{background:#e7f1ff;color:#2a5f95}.v27-mini.split{background:#fff0c7;color:#825d08}.v27-mini.warning{background:#ffe1e5;color:#8e3340}
    @media(max-width:520px){.v27-match-box{padding:13px}.v27-row{grid-template-columns:24px minmax(0,1fr) auto}.v27-result{grid-column:3;grid-row:2}.v27-db{grid-column:3;grid-row:1}.v27-main small{font-size:9px}}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (document.hidden || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; try { decorate(); } catch {} });
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-v4-expand], .v4-race-card, [data-race-id]')) setTimeout(schedule, 80);
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', () => setTimeout(schedule, 80));
  window.addEventListener('mykeiba:going-bulk-updated', () => setTimeout(schedule, 80));
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });
  setTimeout(schedule, 300);

  window.MyKeibaEditorialDbMatchV27 = { classify, decorate, schedule };
})();
