// MY KEIBA LAB v18 - 馬DB登録 第1版
// MHT/MHTML/HTMLから競走馬と過去走を抽出し、IndexedDBへ軽量保存する。
(() => {
  if (window.__MYKEIBA_HORSE_DB_V18__) return;
  window.__MYKEIBA_HORSE_DB_V18__ = true;

  const DB_NAME = 'my-keiba-horse-db-v1';
  const DB_VERSION = 1;
  const HORSES = 'horses';
  const RUNS = 'runs';
  let pendingImports = [];

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const normalizeName = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HORSES)) {
          const store = db.createObjectStore(HORSES, { keyPath: 'key' });
          store.createIndex('nameKey', 'nameKey', { unique: false });
          store.createIndex('registrationNo', 'registrationNo', { unique: false });
        }
        if (!db.objectStoreNames.contains(RUNS)) {
          const store = db.createObjectStore(RUNS, { keyPath: 'id' });
          store.createIndex('horseKey', 'horseKey', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const reqPromise = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  function decodeBytes(bytes, charset = 'utf-8') {
    const cs = /shift[_-]?jis|sjis|windows-31j|cp932/i.test(charset) ? 'shift_jis' : 'utf-8';
    try { return new TextDecoder(cs).decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); }
  }

  function quotedPrintableBytes(text) {
    const clean = String(text || '').replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(clean.slice(i + 1, i + 3))) {
        bytes.push(parseInt(clean.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        const code = clean.charCodeAt(i);
        if (code <= 255) bytes.push(code);
        else bytes.push(...new TextEncoder().encode(clean[i]));
      }
    }
    return new Uint8Array(bytes);
  }

  function decodeMht(raw) {
    const top = raw.slice(0, 5000);
    const boundary = top.match(/boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return raw;
    const parts = raw.split(`--${boundary}`);
    const htmlParts = [];
    for (const part of parts) {
      const sep = part.search(/\r?\n\r?\n/);
      if (sep < 0) continue;
      const head = part.slice(0, sep);
      if (!/Content-Type:\s*text\/html/i.test(head)) continue;
      const body = part.slice(sep).replace(/^\r?\n\r?\n/, '').trim();
      const charset = head.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] || 'utf-8';
      const enc = head.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || '';
      try {
        if (enc.includes('base64')) {
          const bin = atob(body.replace(/\s/g, ''));
          const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
          htmlParts.push(decodeBytes(bytes, charset));
        } else if (enc.includes('quoted-printable')) {
          htmlParts.push(decodeBytes(quotedPrintableBytes(body), charset));
        } else {
          htmlParts.push(body);
        }
      } catch {
        htmlParts.push(body);
      }
    }
    return htmlParts.join('\n') || raw;
  }

  function textOf(doc) {
    return (doc.body?.innerText || doc.documentElement?.textContent || '')
      .replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function horseIdentity(doc, fullText, fileName) {
    const reg = fullText.match(/(?:血統登録番号|登録番号)\s*[:：]?\s*([A-Za-z0-9-]{6,20})/i)?.[1] || '';
    const selectors = ['h1', '.horse_name', '.horseName', '[class*="horse-name"]', '[class*="horse_name"]'];
    let name = '';
    for (const sel of selectors) {
      const t = doc.querySelector(sel)?.textContent?.trim();
      if (t && /[ァ-ヶーA-Za-z]/.test(t) && t.length <= 40) { name = t; break; }
    }
    if (!name) name = fullText.match(/(?:馬名|競走馬名)\s*[:：]?\s*([ァ-ヶヴーA-Za-z0-9・･]{2,30})/)?.[1] || '';
    if (!name) {
      const title = doc.title?.trim() || '';
      name = title.split(/[|｜:：\-–—]/)[0].replace(/競走馬|データベース|馬情報/g, '').trim();
    }
    if (!name) name = fileName.replace(/\.(mht|mhtml|html?|txt)$/i, '').trim();
    name = name.replace(/^【|】$/g, '').trim();
    return { name, registrationNo: reg, nameKey: normalizeName(name) };
  }

  const aliases = {
    date: ['日付','年月日','開催日','日程'], raceName: ['レース名','競走名','レース'], finish: ['着順','着'],
    fieldSize: ['頭数','出走頭数'], lap33: ['33ラップ','33lap','33'], track: ['競馬場','開催場','場'],
    surface: ['芝ダ','芝・ダ','芝ダート','馬場種別','コース種別'], distance: ['距離'],
    going: ['馬場状態','馬場','馬場コンディション','コンディション','芝馬場','ダート馬場','馬場状態芝','馬場状態ダート'],
    odds: ['単勝オッズ','オッズ','単勝'], agari: ['上がり3f','上り3f','上がり','上り'], positions: ['通過順','通過'],
    pace: ['ペース'], review: ['レース総評','総評'], weight: ['馬体重'], jockey: ['騎手'], trainingScore: ['調教採点','採点']
  };

  function headerKey(text) {
    const x = String(text || '').toLowerCase().replace(/[\s　()（）・･／/]/g, '');
    for (const [key, names] of Object.entries(aliases)) {
      if (names.some(n => x === n.toLowerCase().replace(/[\s　()（）・･／/]/g, ''))) return key;
    }
    if (/馬場.*状態|状態.*馬場|コンディション/.test(x) && !/種別/.test(x)) return 'going';
    return '';
  }

  function normalizeDate(v) {
    const s = String(v || '').trim();
    const m = s.match(/(20\d{2})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    return s;
  }

  function normalizeGoing(v) {
    const s = String(v || '').replace(/[\s　・･／/]/g, '');
    if (!s) return '';
    if (/不良/.test(s)) return '不良';
    if (/稍重|稍/.test(s)) return '稍重';
    if (/重/.test(s)) return '重';
    if (/良/.test(s)) return '良';
    return '';
  }

  function normalizeSurface(v) {
    const s = String(v || '').replace(/[\s　・･／/]/g, '');
    if (/ダート|ダ|ﾀﾞ/i.test(s)) return 'ダ';
    if (/芝/.test(s)) return '芝';
    return '';
  }

  function inferRunCondition(cells, run) {
    const texts = (cells || []).map(c => String(c?.textContent || '').trim()).filter(Boolean);
    const joined = texts.join(' ');

    let going = normalizeGoing(run.going);
    let surface = normalizeSurface(run.surface);

    for (const t of texts) {
      const compact = t.replace(/[\s　・･／/]/g, '');
      if (!going && /^(?:芝|ダート?|ﾀﾞ)?(?:良|稍重|稍|重|不良)$/.test(compact)) going = normalizeGoing(compact);
      if (!surface && /^(?:芝|ダート?|ﾀﾞ)(?:良|稍重|稍|重|不良)?$/.test(compact)) surface = normalizeSurface(compact);
      if (going && surface) break;
    }

    if (!going) {
      const m = joined.match(/(?:芝|ダート?|ﾀﾞ)\s*[・･／/：:]?\s*(不良|稍重|稍|重|良)(?:\s|$)/);
      if (m) going = normalizeGoing(m[1]);
    }
    if (!surface) {
      const m = joined.match(/(?:^|\s)(芝|ダート?|ﾀﾞ)(?:\s|$|[・･／/])/);
      if (m) surface = normalizeSurface(m[1]);
    }

    if (going) run.going = going;
    if (surface) run.surface = surface;
    return run;
  }

  function parseRunTables(doc) {
    const out = [];
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')];
      let headerRow = -1;
      let cols = [];
      for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const cells = [...rows[i].querySelectorAll('th,td')].map(c => c.textContent.trim());
        const mapped = cells.map(headerKey);
        if (mapped.filter(Boolean).length >= 3 && (mapped.includes('date') || mapped.includes('raceName'))) {
          headerRow = i; cols = mapped; break;
        }
      }
      if (headerRow < 0) continue;
      for (let i = headerRow + 1; i < rows.length; i++) {
        const cells = [...rows[i].querySelectorAll('th,td')];
        if (!cells.length) continue;
        const run = {};
        cells.forEach((c, idx) => { if (cols[idx]) run[cols[idx]] = c.textContent.trim(); });
        if (!run.date && !run.raceName) continue;
        run.date = normalizeDate(run.date);
        inferRunCondition(cells, run);
        out.push(run);
      }
    }
    return out;
  }

  function dedupeRuns(runs) {
    const seen = new Set();
    return runs.filter(r => {
      const k = [r.date,r.track,r.raceName,r.distance,r.finish].map(v => String(v || '').trim()).join('|');
      if (!k.replace(/\|/g,'')) return false;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  async function parseFile(file) {
    const raw = await file.text();
    const html = /\.mht(?:ml)?$/i.test(file.name) ? decodeMht(raw) : raw;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fullText = textOf(doc);
    const identity = horseIdentity(doc, fullText, file.name);
    const runs = dedupeRuns(parseRunTables(doc));
    const dates = runs.map(r => r.date).filter(v => /^20\d{2}-\d{2}-\d{2}$/.test(v)).sort();
    const goingCount = runs.filter(r => normalizeGoing(r.going)).length;
    return { fileName: file.name, ...identity, runs, goingCount, newestDate: dates.at(-1) || '', oldestDate: dates[0] || '', parsedAt: new Date().toISOString() };
  }

  function runId(horseKey, run) {
    const raw = [horseKey,run.date,run.track,run.raceName,run.distance,run.finish].map(v => String(v || '').trim()).join('|');
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return `${horseKey}:${(hash >>> 0).toString(36)}`;
  }

  async function saveOne(item) {
    const db = await openDb();
    try {
      const tx = db.transaction([HORSES, RUNS], 'readwrite');
      const hs = tx.objectStore(HORSES);
      const rs = tx.objectStore(RUNS);
      const nameKey = item.nameKey;
      let existing = await reqPromise(hs.index('nameKey').get(nameKey));
      const preferredKey = item.registrationNo ? `reg:${item.registrationNo}` : `name:${nameKey}`;
      const horseKey = existing?.key || preferredKey;
      let added = 0;
      for (const run of item.runs) {
        const record = { ...run, id: runId(horseKey, run), horseKey, sourceFile: item.fileName, importedAt: item.parsedAt };
        const old = await reqPromise(rs.get(record.id));
        if (!old) added++;
        rs.put({ ...(old || {}), ...record });
      }
      const horse = { ...(existing || {}), key: horseKey, name: item.name, nameKey, registrationNo: item.registrationNo || existing?.registrationNo || '', lastImportedAt: item.parsedAt, sourceFile: item.fileName, latestRunDate: item.newestDate || existing?.latestRunDate || '', dbSchemaVersion: 18 };
      hs.put(horse);
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
      const tx2 = db.transaction([HORSES, RUNS], 'readwrite');
      const count = await reqPromise(tx2.objectStore(RUNS).index('horseKey').count(horseKey));
      horse.runCount = count;
      tx2.objectStore(HORSES).put(horse);
      await new Promise((resolve, reject) => { tx2.oncomplete = resolve; tx2.onerror = () => reject(tx2.error); });
      return { horse, added, total: count, goingCount: item.goingCount || 0 };
    } finally { db.close(); }
  }

  async function dbStats() {
    const db = await openDb();
    try {
      const tx = db.transaction([HORSES, RUNS], 'readonly');
      const horses = await reqPromise(tx.objectStore(HORSES).count());
      const runs = await reqPromise(tx.objectStore(RUNS).count());
      return { horses, runs };
    } finally { db.close(); }
  }

  async function listHorses() {
    const db = await openDb();
    try {
      const tx = db.transaction(HORSES, 'readonly');
      const rows = await reqPromise(tx.objectStore(HORSES).getAll());
      return (rows || []).sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja'));
    } finally { db.close(); }
  }

  async function getRuns(horseKey) {
    const db = await openDb();
    try {
      const tx = db.transaction(RUNS, 'readonly');
      const rows = await reqPromise(tx.objectStore(RUNS).index('horseKey').getAll(horseKey));
      return (rows || []).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
    } finally { db.close(); }
  }

  function installUi() {
    if (document.querySelector('#v18HorseDbImport')) return;
    const grid = document.querySelector('.v4-action-grid');
    if (!grid) return;
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'v18HorseDbFile'; input.hidden = true; input.multiple = true;
    input.accept = '.mht,.mhtml,.html,.htm,.txt,text/html,message/rfc822';
    document.body.appendChild(input);
    const btn = document.createElement('button');
    btn.id = 'v18HorseDbImport'; btn.type = 'button'; btn.className = 'v4-secondary v18-db-btn';
    btn.textContent = '馬DB取込'; btn.onclick = () => input.click(); grid.appendChild(btn);
    input.onchange = async () => {
      const files = [...input.files]; input.value = '';
      if (!files.length) return;
      showModal('解析中…', '<p class="v18-note">MHT/HTMLを端末内で解析しています。</p>', false);
      try { pendingImports = []; for (const f of files) pendingImports.push(await parseFile(f)); renderPreview(); }
      catch (e) { showModal('取込できませんでした', `<p class="v18-error">${esc(e?.message || 'ファイル解析に失敗しました')}</p>`, false); }
    };
    dbStats().then(s => { btn.textContent = `馬DB取込 (${s.horses}頭)`; }).catch(() => {});
  }

  function ensureModal() {
    let modal = document.querySelector('#v18DbModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v18DbModal'; modal.className = 'v18-modal'; modal.hidden = true;
    modal.innerHTML = `<div class="v18-panel"><div class="v18-head"><div><p class="v4-eyebrow">HORSE DB</p><h2 id="v18Title">馬DB取込</h2></div><button type="button" id="v18Close" class="v4-close">閉じる</button></div><div id="v18Body"></div><div id="v18Actions" class="v18-actions"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#v18Close').onclick = () => { modal.hidden = true; pendingImports = []; };
    modal.onclick = e => { if (e.target === modal) modal.querySelector('#v18Close').click(); };
    return modal;
  }

  function showModal(title, html, actions = true) {
    const modal = ensureModal();
    modal.querySelector('#v18Title').textContent = title;
    modal.querySelector('#v18Body').innerHTML = html;
    modal.querySelector('#v18Actions').innerHTML = actions ? '<button type="button" class="v4-secondary" id="v18Cancel">キャンセル</button><button type="button" class="v4-primary" id="v18Commit">DBに登録</button>' : '';
    if (actions) { modal.querySelector('#v18Cancel').onclick = () => modal.querySelector('#v18Close').click(); modal.querySelector('#v18Commit').onclick = commitPending; }
    modal.hidden = false;
  }

  function renderPreview() {
    const rows = pendingImports.map(x => `<div class="v18-preview-row"><strong>${esc(x.name || '馬名未取得')}</strong><small>${x.registrationNo ? `血統登録番号 ${esc(x.registrationNo)} / ` : ''}${x.runs.length}走検出${x.oldestDate ? ` / ${esc(x.oldestDate)}〜${esc(x.newestDate)}` : ''}</small><small>馬場状態 ${Number(x.goingCount || 0)}/${x.runs.length}走取得 ・ ${esc(x.fileName)}</small></div>`).join('');
    const bad = pendingImports.some(x => !x.nameKey);
    showModal('登録内容の確認', `${rows}<p class="v18-note">同じ過去走は重複登録しません。再取込でも既存走の馬場状態などを更新します。</p>${bad ? '<p class="v18-error">馬名を判定できないファイルがあります。</p>' : ''}`, !bad);
  }

  async function commitPending() {
    const modal = ensureModal();
    const btn = modal.querySelector('#v18Commit');
    if (btn) { btn.disabled = true; btn.textContent = '登録中…'; }
    try {
      const results = [];
      for (const item of pendingImports) results.push(await saveOne(item));
      const stats = await dbStats();
      const added = results.reduce((n, r) => n + r.added, 0);
      const summary = results.map(r => `<div class="v18-preview-row"><strong>${esc(r.horse.name)}</strong><small>DB ${r.total}走 / 今回追加 ${r.added}走 / 馬場状態 ${r.goingCount}走取得</small></div>`).join('');
      showModal('DB登録完了', `${summary}<p class="v18-success">登録馬 ${stats.horses}頭・過去走 ${stats.runs}走。今回 ${added}走を新規追加しました。</p>`, false);
      const mainBtn = document.querySelector('#v18HorseDbImport');
      if (mainBtn) mainBtn.textContent = `馬DB取込 (${stats.horses}頭)`;
      window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated', { detail: stats }));
      pendingImports = [];
      mountDbSection();
    } catch (e) { showModal('DB登録エラー', `<p class="v18-error">${esc(e?.message || '保存に失敗しました')}</p>`, false); }
  }

  let mountQueued = false;
  async function mountDbSection() {
    if (mountQueued || document.hidden) return;
    mountQueued = true;
    requestAnimationFrame(async () => {
      mountQueued = false;
      const view = document.querySelector('[data-view="horses"]');
      if (!view) return;
      const search = view.querySelector('#v4HorseSearch');
      if (!search) return;
      const q = normalizeName(search.value).toLowerCase();
      let horses = [];
      try { horses = await listHorses(); } catch { return; }
      if (!view.isConnected) return;
      const filtered = horses.filter(h => !q || normalizeName(h.name).toLowerCase().includes(q));
      let section = view.querySelector('#v18DbHorseSection');
      if (!section) {
        section = document.createElement('section');
        section.id = 'v18DbHorseSection';
        section.className = 'v18-db-section';
        search.insertAdjacentElement('afterend', section);
      }
      section.innerHTML = `
        <div class="v18-db-section-head"><strong>登録DB</strong><span>${filtered.length}/${horses.length}頭</span></div>
        <div class="v18-db-list">${filtered.length ? filtered.slice(0,100).map(h => `
          <button type="button" class="v18-db-horse-card" data-v18-horse-key="${esc(h.key)}">
            <div><strong>${esc(h.name || '馬名未取得')}</strong><small>${h.registrationNo ? `血統登録番号 ${esc(h.registrationNo)} ・ ` : ''}過去走 ${Number(h.runCount || 0)}走${h.latestRunDate ? ` ・ 最新 ${esc(h.latestRunDate)}` : ''}</small></div><span>DB</span>
          </button>`).join('') : '<div class="v18-db-empty">登録DBに該当馬がありません。</div>'}</div>`;
      section.querySelectorAll('[data-v18-horse-key]').forEach(btn => btn.onclick = () => openHorseDetail(btn.dataset.v18HorseKey));
    });
  }

  async function openHorseDetail(key) {
    const horses = await listHorses();
    const horse = horses.find(h => h.key === key);
    if (!horse) return;
    const runs = await getRuns(key);
    const rows = runs.slice(0,30).map(r => `<div class="v18-run-row"><strong>${esc(r.date || '日付—')} ${esc(r.raceName || '')}</strong><small>${[r.track, r.surface, r.distance ? `${r.distance}m` : '', r.going, r.finish ? `${r.finish}着` : '', r.lap33 ? `33 ${r.lap33}` : '', r.trainingScore ? `調教 ${r.trainingScore}` : ''].filter(Boolean).map(esc).join(' ・ ')}</small></div>`).join('');
    showModal(horse.name || '競走馬DB', `<div class="v18-horse-summary"><strong>過去走 ${Number(horse.runCount || runs.length)}走</strong><small>${horse.registrationNo ? `血統登録番号 ${esc(horse.registrationNo)}<br>` : ''}${horse.latestRunDate ? `最新走 ${esc(horse.latestRunDate)}` : ''}</small></div>${rows || '<p class="v18-note">過去走データがありません。</p>'}`, false);
  }

  function bindDbView() {
    document.addEventListener('input', e => { if (e.target?.id === 'v4HorseSearch') mountDbSection(); }, true);
    document.addEventListener('click', e => { if (e.target?.closest?.('[data-tab="horses"], [data-v4-tab="horses"]')) setTimeout(mountDbSection, 0); }, true);
    window.addEventListener('mykeiba:horse-db-updated', mountDbSection);
    window.addEventListener('mykeiba:resume', mountDbSection, { passive: true });
    const view = document.querySelector('[data-view="horses"]');
    if (view) {
      const observer = new MutationObserver(mountDbSection);
      observer.observe(view, { childList: true });
    }
    mountDbSection();
  }

  function installStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .v18-db-btn{border-color:#b9d9c8!important;background:#eef8f2!important;color:#245d3d!important;min-height:72px;white-space:normal;font-weight:900}
      .v18-modal{position:fixed;inset:0;z-index:1200;background:rgba(12,27,20,.48);display:flex;align-items:flex-end;justify-content:center;padding:12px}.v18-modal[hidden]{display:none}
      .v18-panel{width:min(680px,100%);max-height:85vh;overflow:auto;background:#fff;border-radius:22px 22px 14px 14px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.22)}
      .v18-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v18-head h2{margin:2px 0 12px;font-size:20px}.v18-preview-row{padding:11px 0;border-bottom:1px solid #e6ece8;display:grid;gap:3px}.v18-preview-row strong{font-size:15px}.v18-preview-row small{font-size:11px;color:#6d7a72}
      .v18-note,.v18-success,.v18-error{font-size:12px;line-height:1.65;padding:10px 12px;border-radius:12px;margin:12px 0}.v18-note{background:#f5f7f6;color:#516158}.v18-success{background:#edf8f1;color:#21603c}.v18-error{background:#fff0f0;color:#9b3333}.v18-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.v18-actions button{min-width:110px}
      .v18-db-section{margin:12px 0 16px}.v18-db-section-head{display:flex;justify-content:space-between;align-items:center;margin:0 2px 8px;color:#315541;font-size:12px}.v18-db-list{display:grid;gap:8px}.v18-db-horse-card{width:100%;border:1px solid #d9e6de;background:#f7fbf8;border-radius:14px;padding:12px;text-align:left;display:flex;justify-content:space-between;gap:10px;align-items:center;color:#243d31}.v18-db-horse-card>div{display:grid;gap:4px}.v18-db-horse-card strong{font-size:15px}.v18-db-horse-card small{font-size:11px;color:#6b7a72;line-height:1.5}.v18-db-horse-card>span{background:#daf0e2;color:#22603d;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900}.v18-db-empty{padding:12px;border:1px dashed #cfdad3;border-radius:12px;color:#748078;font-size:12px}.v18-horse-summary{display:grid;gap:5px;padding:10px 0 12px}.v18-horse-summary small{color:#66766d;line-height:1.6}.v18-run-row{display:grid;gap:3px;padding:10px 0;border-top:1px solid #edf1ee}.v18-run-row strong{font-size:13px}.v18-run-row small{font-size:11px;color:#68766f;line-height:1.5}
      @media(min-width:700px){.v18-modal{align-items:center}.v18-panel{border-radius:22px}}
    `;
    document.head.appendChild(style);
  }

  installStyle();
  installUi();
  bindDbView();
  window.addEventListener('pageshow', () => { installUi(); mountDbSection(); }, { passive: true });
  window.addEventListener('mykeiba:resume', installUi, { passive: true });

  window.MyKeibaHorseDBV18 = { openDb, dbStats, parseFile, listHorses, getRuns, mountDbSection };
})();