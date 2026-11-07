/* CHARANIZE DB Lab private-data bootstrap. No network transfer of imported data. */
(() => {
  'use strict';
  const DB_NAME = 'CHARANIZE_DB_LAB_PRIVATE_V1';
  const STORE = 'settings';
  const KEY = 'private-pack';
  const MAX_BYTES = 35 * 1024 * 1024;
  const gate = document.getElementById('private-gate');
  const status = document.getElementById('gate-status');
  const input = document.getElementById('initial-file-input');
  let activePack = null;

  const dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('このブラウザでは保存機能が使えません。'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('ブラウザの保存領域を開けません。'));
  });
  async function readSaved() {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('保存データが読めません。'));
    });
  }
  async function savePack(pack) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(pack, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存容量を確認してください。'));
    });
  }
  const metrics = ['escape', 'front', 'pursuit', 'leg', 'gear'];
  function normalizeHorsePack(raw) {
    if (!raw || !raw.horses || typeof raw.horses !== 'object') throw Error('CHARANIZE指数DB（horses）を確認できません。');
    const first = Object.values(raw.horses)[0];
    if (!first) throw Error('指数DBに馬が登録されていません。');
    if (Array.isArray(first) && Array.isArray(first[2])) return raw.horses;
    if (Array.isArray(first.runs)) {
      const compact = {};
      for (const [name, h] of Object.entries(raw.horses)) {
        compact[name] = [h.sex || '', h.age_as_of_latest_paper || null,
          (h.runs || []).map(r => [r.date, r.venue, r.race_no, r.surface, r.distance,
            r.going, r.finish, r.passing, r.last3f,
            metrics.map(k => r.indices?.[k] ?? null),
            String(r.race_name || '').split('　')[0].slice(0, 25),
            r.sources?.length || 1, r.conflicts || null])];
      }
      return compact;
    }
    throw Error('JSONの指数履歴形式が対応していません。');
  }
  function normalizeFullPack(raw) {
    if (!raw || typeof raw !== 'object') throw Error('JSONの形式が正しくありません。');
    const horses = normalizeHorsePack(raw);
    if (!raw.races || !Object.keys(raw.races).length) throw Error('出走表（races）がありません。初回用のデータJSONを選んでください。');
    return {format:'CHARANIZE_WEB_PRIVATE_PACK_V1', horses,
      meta:raw.meta || {}, races:raw.races, race_meta:raw.race_meta || {}};
  }
  async function readFile(file) {
    if (!file || file.size > MAX_BYTES) throw Error('35MB以下のJSONファイルを選んでください。');
    let data;
    try { data = JSON.parse(await file.text()); }
    catch (_) { throw Error('JSONファイルを読み取れませんでした。'); }
    return data;
  }
  function launch(pack) {
    activePack = pack;
    window.__CH_PRIVATE = pack;
    gate.hidden = true;
    const script = document.createElement('script');
    script.src = './app.js?v=20261028-source-gap10';
    script.onerror = () => {
      gate.hidden = false;
      status.textContent = 'アプリ本体の読み込みに失敗しました。通信状態をご確認ください。';
    };
    document.body.appendChild(script);
  }
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    status.textContent = '指数DBを読み込み、端末内に保存しています…';
    try {
      const pack = normalizeFullPack(await readFile(file));
      await savePack(pack);
      status.textContent = '';
      launch(pack);
    } catch (e) { status.textContent = e.message || '取り込みに失敗しました。'; }
    finally { input.value = ''; }
  });

  // Capture changes before legacy file handlers so update persists instead of being lost on reload.
  document.addEventListener('change', async ev => {
    const el = ev.target;
    if (!el || !['file-input','race-file-input'].includes(el.id)) return;
    ev.stopImmediatePropagation();
    const file = el.files?.[0]; if (!file || !activePack) return;
    const statusEl = document.getElementById(el.id === 'file-input' ? 'upload-status' : 'race-upload-status');
    if (statusEl) statusEl.textContent = '読み込み・端末保存中…';
    try {
      const raw = await readFile(file);
      const next = {...activePack};
      if (raw.horses) {
        next.horses = normalizeHorsePack(raw);
        next.meta = raw.meta || next.meta;
      }
      if (raw.races) {
        next.races = {...next.races, ...raw.races};
        next.race_meta = raw.race_meta || next.race_meta;
      }
      if (!raw.horses && !raw.races) throw Error('horses または races を含むJSONを選んでください。');
      await savePack(next);
      if (statusEl) statusEl.textContent = '端末に保存しました。画面を更新します。';
      location.reload();
    } catch (e) { if (statusEl) statusEl.textContent = '更新できませんでした：'+e.message; }
    finally { el.value = ''; }
  }, true);


  // PDF import is opt-in and preview-only until the user explicitly confirms.
  let pdfPending = null;
  const pdfInput = document.getElementById('pdf-file-input');
  const pdfStatus = document.getElementById('pdf-upload-status');
  const pdfPreview = document.getElementById('pdf-import-preview');
  const pdfConfirm = document.getElementById('pdf-import-confirm');
  if (pdfInput) pdfInput.addEventListener('change', async () => {
    const file = pdfInput.files?.[0];
    if (!file) return;
    pdfPending = null;
    pdfPreview.style.display = 'none';
    pdfConfirm.hidden = true;
    pdfStatus.textContent = 'PDFを開く準備をしています…';
    try {
      if (!activePack) throw Error('初回の指数DB JSONを先に読み込んでください。');
      const reader = await import('./pdf-import.js?v=20261107-pdf1');
      pdfPending = await reader.preparePdfImport(file,activePack,s=>{pdfStatus.textContent=s;});
      const r=pdfPending.summary;
      const report=[
        '対象：'+r.file,
        'PDF掲載レース：'+r.pages+'レース、'+r.horses+'頭',
        '過去走：'+r.pastRuns+'件、指数読取：'+r.indexedRuns+'件',
        '新規馬：'+r.newHorses+'頭／新規過去走：'+r.addedRuns+'件',
        '既存走への不足値補完：'+r.filledValues+'項目',
        '出走表の新規レース：'+r.newRaces+'件',
        '既存指数との競合：'+r.conflicts+'件（既存値は保持）',
        '解析できなかった走：'+r.skipped+'件',
        r.conflictSamples.length?'競合の例：'+r.conflictSamples.join('、'):'',
        '※事前の指数新聞は過去走の指数です。当日レースの結果指数ではありません。',
        '※PDFの文字・配置形式が変更された場合、読取エラーになります。'
      ].filter(Boolean).join('\n');
      pdfPreview.textContent=report;
      pdfPreview.style.display='block';
      pdfStatus.textContent='読取完了。件数と競合をご確認ください。まだ保存されていません。';
      pdfConfirm.hidden=!(r.addedRuns || r.filledValues || r.newRaces);
    } catch (e) {
      pdfStatus.textContent='PDF取り込み中止：'+(e.message||String(e));
      pdfPreview.textContent='保存していません。PDFの形式やネット接続をご確認ください。';
      pdfPreview.style.display='block';
    } finally {
      pdfInput.value='';
    }
  });
  if (pdfConfirm) pdfConfirm.addEventListener('click', async () => {
    if (!pdfPending) return;
    pdfConfirm.disabled=true;
    pdfStatus.textContent='確認済みのデータを端末へ保存中…';
    try {
      await savePack(pdfPending.pack);
      pdfStatus.textContent='保存できました。画面を再読み込みします。';
      location.reload();
    } catch(e) {
      pdfStatus.textContent='保存失敗：'+(e.message||String(e));
      pdfConfirm.disabled=false;
    }
  });

  dbPromise.then(readSaved).then(saved => {
    if (saved && saved.horses && Object.keys(saved.horses).length && saved.races && Object.keys(saved.races).length) launch(saved);
    else gate.hidden = false;
  }).catch(error => { gate.hidden = false; status.textContent = '保存領域を利用できません：'+error.message; });
})();