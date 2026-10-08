// MY KEIBA LAB v48 - 新聞33 S/A/B/C を「33方向」へ置換
// 表示上は、今回平均33からDBコア33へ寄せるなら「−側 / ＝ / ＋側」のどちらかを示す。
// 元の新聞33(S/A/B/C)データは互換性のため保持するが、壁打ちの主表示・相談文には使わない。
(() => {
  if (window.__MYKEIBA_LAP_DIRECTION_V48__) return;
  window.__MYKEIBA_LAP_DIRECTION_V48__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function num(v) {
    if (v == null || v === '' || String(v).trim() === '—') return null;
    const m = String(v).normalize('NFKC').replace(/[−–—]/g, '-').match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    const horseId = first.dataset.v4Expand;
    return races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function dbFor(race) {
    try { return window.MyKeibaDbResultBridgeV44?.savedFor?.(race) || null; }
    catch { return null; }
  }

  function avg33(race) {
    const direct = num(race?.v3Avg33);
    if (direct != null) return direct;
    const memo = String(race?.paceMemo || '');
    const m = memo.match(/平均33ラップ\s*([+\-−]?\d+(?:\.\d+)?)/);
    return m ? num(m[1]) : null;
  }

  function parseZone(zone) {
    const vals = (String(zone ?? '').normalize('NFKC').replace(/[−–—]/g, '-').match(/[+-]?\d+(?:\.\d+)?/g) || [])
      .map(Number).filter(Number.isFinite);
    if (!vals.length) return null;
    return { lo: Math.min(...vals), hi: Math.max(...vals) };
  }

  function direction(avg, zone) {
    const a = num(avg);
    const z = parseZone(zone);
    if (a == null || !z) return { code:'unknown', short:'—', label:'判定不可', cls:'unknown', avg:a, zone:z };
    if (a > z.hi + 1e-9) return { code:'minus', short:'−側', label:'マイナス側へ振れると合いやすい', cls:'minus', avg:a, zone:z };
    if (a < z.lo - 1e-9) return { code:'plus', short:'＋側', label:'プラス側へ振れると合いやすい', cls:'plus', avg:a, zone:z };
    return { code:'same', short:'＝', label:'平均33付近でコア帯内', cls:'same', avg:a, zone:z };
  }

  function signed(v) {
    const n = num(v);
    if (n == null) return '—';
    return `${n >= 0 ? '+' : ''}${n}`;
  }

  function horseDirection(race, horse) {
    const db = dbFor(race);
    const hit = (db?.horses || []).find(h => norm(h.name) === norm(horse?.name));
    const d = direction(avg33(race), hit?.zone);
    return { ...d, hit };
  }

  function chipHtml(d) {
    const zoneText = d.hit?.zone || '—';
    const title = `平均33 ${signed(d.avg)} / コア33 ${zoneText} / ${d.label}`;
    return `<span class="v48-dir ${d.cls}" title="${title.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${d.short}</span>`;
  }

  function decorateTable() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    const race = currentRace();
    if (!body || !table || !race) return false;

    const heads = [...table.querySelectorAll('thead th')];
    const lapIndex = heads.findIndex(th => ['新聞33','33','33方向'].includes(th.textContent.trim()));
    if (lapIndex < 0) return false;
    heads[lapIndex].textContent = '33方向';
    heads[lapIndex].title = '今回平均33からDBコア33へ寄せるなら、マイナス側/プラス側のどちらがよいかを簡易表示';

    for (const tr of [...table.querySelectorAll('tbody > tr')]) {
      if (tr.classList.contains('v4-horse-detail-row')) continue;
      const btn = tr.querySelector('[data-v4-expand]');
      const horse = (race.horses || []).find(h => h.id === btn?.dataset.v4Expand);
      const cell = tr.children?.[lapIndex];
      if (!horse || !cell) continue;
      const d = horseDirection(race, horse);
      cell.classList.add('v48-dir-cell');
      cell.innerHTML = chipHtml(d);
    }

    const summary = body.querySelector('#v38DbLabSummary p');
    if (summary) summary.textContent = '33方向は「今回平均33 → DBコア33」の寄せ方向を簡易表示。詳細な33適合はDB LABの主評価・コア33・根拠レースで確認します。';

    return true;
  }

  function consultDirectionCounts(race) {
    const c = { minus:0, same:0, plus:0, unknown:0 };
    for (const h of (race.horses || [])) c[horseDirection(race, h).code]++;
    return `33方向（平均33→DBコア33）: −側${c.minus}頭 / ＝${c.same}頭 / ＋側${c.plus}頭 / 不明${c.unknown}頭`;
  }

  function patchConsultText() {
    const modal = document.querySelector('#v6Consult');
    const area = document.querySelector('#v6ConsultText');
    const race = currentRace();
    if (!modal || modal.hidden || !area || !race || !area.value) return;

    const db = dbFor(race);
    const byName = new Map((db?.horses || []).map(h => [norm(h.name), h]));
    const avg = avg33(race);
    const lines = area.value.split('\n');
    let inHorseRows = false;
    let headerIndex = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '■全馬データ') { inHorseRows = true; continue; }
      if (inHorseRows && /^馬番\|馬名\|/.test(line)) {
        const cols = line.split('|');
        headerIndex = cols.findIndex(x => x === '新聞33' || x === '33方向');
        if (headerIndex >= 0) cols[headerIndex] = '33方向';
        lines[i] = cols.join('|');
        continue;
      }
      if (inHorseRows && !line.trim()) { inHorseRows = false; continue; }
      if (inHorseRows && headerIndex != null && /^\d+\|/.test(line)) {
        const cols = line.split('|');
        const horseName = cols[1] || '';
        const hit = byName.get(norm(horseName));
        const d = direction(avg, hit?.zone);
        if (headerIndex < cols.length) cols[headerIndex] = d.short;
        lines[i] = cols.join('|');
        continue;
      }

      if (/^・新聞33 S\/A（補助）:/.test(line)) lines[i] = `・${consultDirectionCounts(race)}`;
      if (/^3\. 適性評価の主軸はDB33主評価/.test(line)) {
        lines[i] = '3. 適性評価の主軸はDB33主評価・コア33・DB根拠。33方向は「今回平均33からDBコア33へ寄る方向」の簡易表示であり、詳細適合を上書きしない。';
      }
      if (/新聞33.*補助/.test(line) && !/^3\./.test(line)) {
        lines[i] = line.replace(/新聞33[^。]*補助[^。]*。?/g, '33方向は簡易表示として扱う。');
      }
    }
    area.value = lines.join('\n');
  }

  const style = document.createElement('style');
  style.textContent = `
    .v48-dir-cell{min-width:54px;text-align:center}
    .v48-dir{display:inline-flex;align-items:center;justify-content:center;min-width:38px;padding:5px 6px;border-radius:999px;font-size:11px;font-weight:950;line-height:1;white-space:nowrap;border:1px solid transparent}
    .v48-dir.minus{background:#e8f1ff;color:#1e5ba8;border-color:#c8dcfa}
    .v48-dir.same{background:#edf4ef;color:#35604a;border-color:#d3e2d8}
    .v48-dir.plus{background:#fff0df;color:#9a5b14;border-color:#f2d4af}
    .v48-dir.unknown{background:#f1f3f2;color:#8a9590;border-color:#e1e5e3}
  `;
  document.head.appendChild(style);

  let timer = null;
  function schedule(ms = 170) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { try { decorateTable(); } catch {} }), ms);
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')) schedule(190);
    const b = e.target?.closest?.('button');
    if (b && /ラップ君に相談/.test(b.textContent || '')) setTimeout(patchConsultText, 520);
  }, true);
  window.addEventListener('storage', e => {
    if (e.key === 'my-keiba-db-results-v3' || e.key === 'my-keiba-db-result-v2') schedule(80);
  });
  window.addEventListener('mykeiba:modules-ready', () => schedule(80));
  window.addEventListener('mykeiba:resume', () => schedule(80), { passive:true });
  window.addEventListener('pageshow', () => schedule(100), { passive:true });
  schedule(250);

  window.MyKeibaLapDirectionV48 = { parseZone, direction, horseDirection, decorateTable, patchConsultText };
})();