// MY KEIBA LAB v38 - DB LABの軽量評価結果だけを本体へ反映
(() => {
  if (window.__MYKEIBA_DB_RESULT_BRIDGE_V38__) return;
  window.__MYKEIBA_DB_RESULT_BRIDGE_V38__ = true;

  const STORAGE_KEY = 'my-keiba-db-result-v2';
  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();
  const esc = (v='') => String(v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function parseSaved(text) {
    const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines[0] !== 'MYKEIBA_DB_RESULT_V2' || !lines[1]) return null;
    const head = lines[1].split('|');
    const m = (head[0] || '').match(/^(.+?)\s+(\d{1,2})R$/);
    if (!m) return null;
    const race = {
      track: m[1].trim(), raceNo: String(Number(m[2])), raceName: head[1] || '',
      surface: head[2] || '', distance: head[3] || '', going: head[4] || '', avg33: head[5] || ''
    };
    const horses = lines.slice(2).map(line => {
      const c = line.split('|');
      return {
        no: c[0] || '', name: c[1] || '', mark: c[2] || '—', label: c[3] || '',
        zone: c[4] || '—', basis: c[5] || '', gap: c[6] || '', excluded: c[7] || '0'
      };
    }).filter(h => h.name);
    return { race, horses, at: localStorage.getItem('my-keiba-db-result-v2-at') || '' };
  }

  function saved() {
    try { return parseSaved(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  }

  function currentRace() {
    const body = document.querySelector('#v4DetailBody');
    const first = body?.querySelector('[data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    const id = first.dataset.v4Expand;
    return races.find(r => (r.horses || []).some(h => h.id === id)) || null;
  }

  function sameRace(a, b) {
    return !!a && !!b && String(a.track || '').trim() === String(b.track || '').trim()
      && String(Number(a.raceNo || 0)) === String(Number(b.raceNo || 0));
  }

  function cls(mark) {
    if (mark === '◎') return 'perfect';
    if (mark === '○') return 'possible';
    if (mark === '逆◎') return 'reverse';
    return 'mid';
  }

  function label(h) {
    if (h.mark === '◎') return '◎ ピッタリ';
    if (h.mark === '○') return '○ 好走可能';
    if (h.mark === '逆◎') return '逆◎ 全く逆';
    return '— 中間';
  }

  function decorate() {
    const data = saved();
    const race = currentRace();
    const body = document.querySelector('#v4DetailBody');
    if (!data || !race || !body || !sameRace(data.race, race)) {
      body?.querySelector('#v38DbLabSummary')?.remove();
      body?.querySelectorAll('.v38-dbtag').forEach(x => x.remove());
      return;
    }

    const byName = new Map(data.horses.map(h => [norm(h.name), h]));
    let matched = 0;
    body.querySelectorAll('tbody > tr').forEach(tr => {
      if (tr.classList.contains('v4-horse-detail-row')) return;
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      const nameCell = tr.children?.[1];
      if (!horse || !nameCell) return;
      nameCell.querySelector('.v38-dbtag')?.remove();
      const hit = byName.get(norm(horse.name));
      if (!hit) return;
      matched++;
      const tag = document.createElement('span');
      tag.className = `v38-dbtag ${cls(hit.mark)}`;
      tag.textContent = label(hit);
      tag.title = `${hit.basis || '条件未取得'} / 好走33帯 ${hit.zone || '—'}${hit.gap ? ` / 差${hit.gap}` : ''}`;
      nameCell.appendChild(tag);
    });

    let box = body.querySelector('#v38DbLabSummary');
    if (!box) {
      box = document.createElement('section');
      box.id = 'v38DbLabSummary';
      box.className = 'v38-summary';
      const table = body.querySelector('.v4-table-wrap') || body.querySelector('.v4-table');
      if (table) table.insertAdjacentElement('beforebegin', box);
    }
    const counts = { '◎':0, '○':0, '逆◎':0, '—':0 };
    data.horses.forEach(h => { counts[h.mark] = (counts[h.mark] || 0) + 1; });
    box.innerHTML = `<div class="v38-head"><div><small>DB LAB RESULT</small><strong>DB33 外部評価</strong></div><span>${matched}/${(race.horses||[]).length}頭</span></div>
      <div class="v38-counts"><b class="perfect">◎ ${counts['◎']||0}</b><b class="possible">○ ${counts['○']||0}</b><b class="reverse">逆◎ ${counts['逆◎']||0}</b></div>
      <p>DB LABで計算した結果だけを表示しています。本体では過去走DBを読み込みません。</p>`;
  }

  let timer = null;
  function schedule(ms=60) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { try { decorate(); } catch {} }), ms);
  }

  const style = document.createElement('style');
  style.textContent = `
    .v38-dbtag{display:inline-flex;margin-top:4px;margin-left:4px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:950;white-space:nowrap}
    .v38-dbtag.perfect,.v38-counts .perfect{background:#dff4e7;color:#17613a}
    .v38-dbtag.possible,.v38-counts .possible{background:#fff2cd;color:#805d11}
    .v38-dbtag.reverse,.v38-counts .reverse{background:#f5dfe3;color:#8e3442}
    .v38-dbtag.mid{background:#edf1ef;color:#69776f}
    .v38-summary{margin:12px 0;padding:13px 14px;border:1px solid #d8e8de;border-radius:18px;background:#fbfdfb}
    .v38-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.v38-head small{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;color:#278154}.v38-head strong{display:block;margin-top:2px;font-size:18px;color:#173d2b}.v38-head>span{font-size:10px;font-weight:900;color:#547064}.v38-counts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v38-counts b{padding:4px 8px;border-radius:999px;font-size:10px}.v38-summary p{margin:7px 0 0;font-size:10px;color:#718078;line-height:1.5}`;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')) schedule(100);
  }, true);
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) schedule(20); });
  window.addEventListener('pageshow', () => schedule(80), { passive:true });
  window.addEventListener('mykeiba:resume', () => schedule(80), { passive:true });
  window.addEventListener('mykeiba:modules-ready', () => schedule(80));
  schedule(250);

  window.MyKeibaDbResultBridgeV38 = { parseSaved, saved, decorate, schedule };
})();