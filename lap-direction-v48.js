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

  // v50: 保存済みDB結果にコア33/全好走33が無い特殊ケース向け。
  // 馬DBの「3着以内の実33」だけから参考帯を作る。主評価には使わない。
  const localRefCache = new Map();
  let dbHorseListPromise = null;

  function lapNum(v) {
    if (v == null || v === '') return null;
    const m = String(v).normalize('NFKC').replace(/[−–—]/g, '-').match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  function finishNum(v) {
    if (v == null || v === '') return null;
    const m = String(v).normalize('NFKC').match(/\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function dbHorseList() {
    if (dbHorseListPromise) return dbHorseListPromise;
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses) return [];
    dbHorseListPromise = api.listHorses().catch(() => []);
    return dbHorseListPromise;
  }

  async function localGoodZone(horse) {
    const key = norm(horse?.name);
    if (!key) return null;
    if (localRefCache.has(key)) return localRefCache.get(key);

    const api = window.MyKeibaHorseDBV18;
    if (!api?.getRuns) {
      localRefCache.set(key, null);
      return null;
    }

    try {
      const list = await dbHorseList();
      const dbHorse = list.find(h => norm(h.name) === key);
      if (!dbHorse) {
        localRefCache.set(key, null);
        return null;
      }
      const runs = await api.getRuns(dbHorse.key);
      const values = (runs || [])
        .map(r => ({ lap:lapNum(r.lap33), finish:finishNum(r.finish) }))
        .filter(x => x.lap != null && x.finish != null && x.finish <= 3)
        .map(x => x.lap)
        .sort((a,b) => a-b);
      const zone = values.length ? { lo:values[0], hi:values.at(-1), text:values[0] === values.at(-1) ? String(values[0]) : `${values[0]}〜${values.at(-1)}`, count:values.length } : null;
      localRefCache.set(key, zone);
      return zone;
    } catch {
      localRefCache.set(key, null);
      return null;
    }
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

  function direction(avg, zone, options = {}) {
    const a = num(avg);
    const z = parseZone(zone);
    const reference = Boolean(options.reference);
    const prefix = reference ? '参考' : '';
    const basisLabel = reference ? '全好走33帯' : 'コア33';
    if (a == null || !z) return { code:'unknown', short:'—', label:'判定不可', cls:'unknown', avg:a, zone:z, reference:false, basis:'none' };
    if (a > z.hi + 1e-9) return { code:'minus', short:`${prefix}−${reference ? '' : '側'}`, label:`${basisLabel}へはマイナス側へ振れると合いやすい`, cls:'minus', avg:a, zone:z, reference, basis:reference ? 'all' : 'core' };
    if (a < z.lo - 1e-9) return { code:'plus', short:`${prefix}＋${reference ? '' : '側'}`, label:`${basisLabel}へはプラス側へ振れると合いやすい`, cls:'plus', avg:a, zone:z, reference, basis:reference ? 'all' : 'core' };
    return { code:'same', short:reference ? '参考＝' : '＝', label:`平均33付近で${basisLabel}内`, cls:'same', avg:a, zone:z, reference, basis:reference ? 'all' : 'core' };
  }

  function signed(v) {
    const n = num(v);
    if (n == null) return '—';
    return `${n >= 0 ? '+' : ''}${n}`;
  }

  function horseDirection(race, horse) {
    const db = dbFor(race);
    const hit = (db?.horses || []).find(h => norm(h.name) === norm(horse?.name));
    const core = parseZone(hit?.zone);
    if (core) return { ...direction(avg33(race), hit.zone), hit, sourceZone:hit.zone, source:'core' };
    const all = parseZone(hit?.allZone);
    if (all) return { ...direction(avg33(race), hit.allZone, { reference:true }), hit, sourceZone:hit.allZone, source:'saved-all' };
    const local = localRefCache.get(norm(horse?.name));
    if (local) return { ...direction(avg33(race), local.text, { reference:true }), hit, sourceZone:local.text, source:'horse-db-good', localCount:local.count };
    return { ...direction(avg33(race), null), hit, sourceZone:'—', source:'none' };
  }

  function chipHtml(d) {
    const basis = d.source === 'horse-db-good' ? '馬DB 3着以内33' : d.reference ? '全好走33' : 'コア33';
    const zoneText = d.sourceZone || '—';
    const extra = d.source === 'horse-db-good'
      ? `（保存帯なしの参考表示 / 3着以内${d.localCount || 0}走）`
      : d.reference ? '（コア33なしの参考表示）' : '';
    const title = `平均33 ${signed(d.avg)} / ${basis} ${zoneText} / ${d.label}${extra}`;
    return `<span class="v48-dir ${d.cls}${d.reference ? ' reference' : ''}" title="${title.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${d.short}</span>`;
  }

  async function hydrateLocalReferences(race) {
    const db = dbFor(race);
    const byName = new Map((db?.horses || []).map(h => [norm(h.name), h]));
    const targets = (race.horses || []).filter(h => {
      const hit = byName.get(norm(h.name));
      return !parseZone(hit?.zone) && !parseZone(hit?.allZone) && !localRefCache.has(norm(h.name));
    });
    for (const horse of targets) await localGoodZone(horse);
  }

  function paintRows(race, table, lapIndex) {
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
    heads[lapIndex].title = 'コア33を優先して方向表示。コア33がない馬は全好走33帯から「参考− / 参考＝ / 参考＋」を表示';

    paintRows(race, table, lapIndex);

    // 保存結果だけでは方向を出せない馬がいる場合、レース詳細を開いた時だけローカル馬DBから参考帯を補完。
    hydrateLocalReferences(race).then(() => {
      const active = currentRace();
      const activeTable = document.querySelector('#v4DetailBody .v4-table');
      if (!active || active.id !== race.id || !activeTable) return;
      const hs = [...activeTable.querySelectorAll('thead th')];
      const idx = hs.findIndex(th => ['新聞33','33','33方向'].includes(th.textContent.trim()));
      if (idx >= 0) paintRows(active, activeTable, idx);
    }).catch(() => {});

    const summary = body.querySelector('#v38DbLabSummary p');
    if (summary) summary.textContent = '33方向はコア33を最優先。保存帯がない馬は全好走33帯、さらに無い特殊ケースだけ馬DBの3着以内33から「参考− / 参考＝ / 参考＋」を表示します。参考表示は主評価を上書きしません。';

    return true;
  }

  function consultDirectionCounts(race) {
    const c = { minus:0, same:0, plus:0, refMinus:0, refSame:0, refPlus:0, unknown:0 };
    for (const h of (race.horses || [])) {
      const d = horseDirection(race, h);
      if (d.code === 'unknown') c.unknown++;
      else if (d.reference && d.code === 'minus') c.refMinus++;
      else if (d.reference && d.code === 'same') c.refSame++;
      else if (d.reference && d.code === 'plus') c.refPlus++;
      else c[d.code]++;
    }
    return `33方向: −側${c.minus}頭 / ＝${c.same}頭 / ＋側${c.plus}頭 / 参考−${c.refMinus}頭 / 参考＝${c.refSame}頭 / 参考＋${c.refPlus}頭 / 不明${c.unknown}頭`;
  }

  async function patchConsultText() {
    const modal = document.querySelector('#v6Consult');
    const area = document.querySelector('#v6ConsultText');
    const race = currentRace();
    if (!modal || modal.hidden || !area || !race || !area.value) return;

    await hydrateLocalReferences(race);
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
        const raceHorse = (race.horses || []).find(h => norm(h.name) === norm(horseName));
        const d = raceHorse ? horseDirection(race, raceHorse) : direction(avg, null);
        if (headerIndex < cols.length) cols[headerIndex] = d.short;
        lines[i] = cols.join('|');
        continue;
      }

      if (/^・新聞33 S\/A（補助）:/.test(line)) lines[i] = `・${consultDirectionCounts(race)}`;
      if (/^3\. 適性評価の主軸はDB33主評価/.test(line)) {
        lines[i] = '3. 適性評価の主軸はDB33主評価・コア33・DB根拠。33方向はコア33を優先し、コア33がない場合のみ全好走33帯から「参考− / 参考＝ / 参考＋」を表示する。参考表示は主評価を上書きしない。';
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
    .v48-dir.reference{min-width:48px;font-size:9px;border-style:dashed;opacity:.86}
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
    if (e.target?.closest?.('.v12-apply')) schedule(480);
  }, true);
  window.addEventListener('storage', e => {
    if (e.key === 'my-keiba-db-results-v3' || e.key === 'my-keiba-db-result-v2') schedule(80);
  });
  window.addEventListener('mykeiba:modules-ready', () => schedule(80));
  window.addEventListener('mykeiba:odds-updated', () => schedule(100));
  window.addEventListener('mykeiba:resume', () => schedule(80), { passive:true });
  window.addEventListener('pageshow', () => schedule(100), { passive:true });
  schedule(250);

  window.MyKeibaLapDirectionV48 = { parseZone, direction, horseDirection, localGoodZone, hydrateLocalReferences, decorateTable, patchConsultText };
})();