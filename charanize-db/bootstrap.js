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
  const uploadStatus = document.getElementById('upload-status');
  if(uploadStatus) uploadStatus.textContent='PDF取り込み機能 v20261117-1 読み込み済み。指数新聞PDFから出走表・指数履歴を一括更新できます。';

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
    const pack={format:'CHARANIZE_WEB_PRIVATE_PACK_V1', horses,
      meta:raw.meta || {}, races:raw.races, race_meta:raw.race_meta || {}};
    // Preserve the user's matched 33 records when restoring a full-device backup.
    if(raw.lapRuns!==undefined){
      if(!raw.lapRuns||typeof raw.lapRuns!=='object'||!raw.lapRuns.byHorse||typeof raw.lapRuns.byHorse!=='object'||Array.isArray(raw.lapRuns.byHorse))
        throw Error('バックアップの実33データ形式が不正です。保存は中止しました。');
      pack.lapRuns=raw.lapRuns;
    }
    return pack;
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
    const lapState = document.getElementById('lap-upload-status');
    if(lapState&&pack.lapRuns?.stats){
      const st=pack.lapRuns.stats;
      lapState.textContent='実33データ保存済み：'+st.total+'走・'+st.horseCount+'頭。取り込み済みの指数DBは保持しています。';
    }
    gate.hidden = true;
    const script = document.createElement('script');
    script.src = './app.js?v=20261117-consult2';
    script.onerror = () => {
      gate.hidden = false;
      status.textContent = 'アプリ本体の読み込みに失敗しました。通信状態をご確認ください。';
    };
    document.body.appendChild(script);
  }
  // Local backup for moving a privately stored index DB to a second device.
  // Export is explicit; never upload licensed PDF-derived content to GitHub or a server.
  const exportButton=document.getElementById('private-pack-export');
  const exportStatus=document.getElementById('private-pack-export-status');
  if(exportButton)exportButton.addEventListener('click',()=>{
    try{
      if(!activePack?.horses||!activePack?.races)throw Error('書き出す指数DB・出走表がありません。');
      const data=JSON.stringify({
        format:'CHARANIZE_WEB_PRIVATE_PACK_V1',
        horses:activePack.horses,races:activePack.races,
        meta:activePack.meta||{},race_meta:activePack.race_meta||{},
        ...(activePack.lapRuns?{lapRuns:activePack.lapRuns}:{}),
      });
      const size=new Blob([data],{type:'application/json;charset=utf-8'});
      if(size.size>MAX_BYTES)throw Error('バックアップが35MBを超えます。転送形式の調整が必要なため出力を中止しました。');
      const link=document.createElement('a');
      const url=URL.createObjectURL(size);
      const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
      link.href=url;
      link.download='CHARANIZE_DB_LAB_BACKUP_'+stamp+'.json';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      if(exportStatus)exportStatus.textContent='バックアップを保存しました（'+(size.size/1048576).toFixed(1)+'MB）。'
        +'指数'+Object.keys(activePack.horses).length+'頭・出走表'+Object.keys(activePack.races).length+'レース'
        +(activePack.lapRuns?.byHorse?'・実33照合データあり':'・実33照合データなし')
        +'。ファイルをタブレットへ送って初回画面で読み込んでください。';
    }catch(e){
      if(exportStatus)exportStatus.textContent='バックアップできませんでした：'+String(e?.message||e);
    }
  });
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
    if (!el || !['file-input','race-file-input','lap-file-input'].includes(el.id)) return;
    ev.stopImmediatePropagation();
    const file = el.files?.[0]; if (!file || !activePack) return;
    const statusEl = document.getElementById(el.id === 'file-input' ? 'upload-status' : el.id === 'lap-file-input' ? 'lap-upload-status' : 'race-upload-status');
    if (statusEl) statusEl.textContent = '読み込み・端末保存中…';
    try {
      if(el.id==='lap-file-input'){
        if(!window.CHARA_LAP_SYNC)throw Error('実33取り込みモジュールが読み込めませんでした。');
        const raw=await readFile(file);
        const imported=window.CHARA_LAP_SYNC.parse(raw,activePack.lapRuns);
        const st=imported.stats;
        const approval='MY KEIBA DB LABの実33を取り込みます。\n'+
         '読み取り'+st.imported+'走／保存対象'+st.total+'走・'+st.horseCount+'頭。\n'+
         '同一過去走の重複'+st.duplicates+'件、実33の不一致'+st.conflicts+'件。\n'+
         '指数DB・出走表は変更せず、実33を別領域に保存します。保存しますか？';
        if(!confirm(approval)){if(statusEl)statusEl.textContent='実33の保存をキャンセルしました。既存データは変更していません。';return;}
        await savePack({...activePack,lapRuns:imported});
        if(statusEl)statusEl.textContent='実33の取り込み完了。画面を更新します。';
        location.reload();return;
      }
      const pdf = el.id === 'file-input' && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
      if(pdf){
        if(!window.CHARA_PDF_DB_IMPORT)throw Error('PDF解析機能を読み込めませんでした。');
        const merged = await window.CHARA_PDF_DB_IMPORT.readAndMerge(file,activePack.horses,
          message=>{if(statusEl)statusEl.textContent=message;},activePack.races);
        const newestRace=merged.raceKeys.slice().sort((a,b)=>b.localeCompare(a,'ja'))[0]||'';
        const [pdfRaceDate,pdfRaceVenue]=newestRace.split('|');
        const next = {...activePack,horses:merged.horses,races:merged.races,
          meta:{...activePack.meta,last_pdf_import:file.name,last_pdf_import_stats:merged.changes,
            last_pdf_race_stats:merged.raceChanges,last_pdf_race_date:pdfRaceDate||'',
            last_pdf_race_venue:pdfRaceVenue||''}};
        const rs=merged.raceChanges;
        const report='PDF解析：'+merged.pdf.races+'レース・'+merged.pdf.horses+'頭・過去走'+merged.pdf.runs+'走。\n'
          +'出走表：新規'+rs.added+'レース／更新'+rs.updated+'レース／同一'+rs.unchanged+'レース／既存優先'+rs.preserved+'レース。\n'
          +'指数DB：追加'+merged.changes.added+'走／更新馬'+merged.changes.horses+'頭／既存照合'+merged.changes.matched+'走／指数衝突'+merged.changes.conflicts+'件。\n'
          +'出走表・指数履歴・実33データを保持し、端末内に保存しますか？';
        if(!confirm(report)){if(statusEl)statusEl.textContent='保存をキャンセルしました。既存データは変更していません。';return;}
        await savePack(next);
        if(statusEl)statusEl.textContent='PDFを保存しました。レース新規'+rs.added+'件・更新'+rs.updated+'件、指数追加'+merged.changes.added+'走。画面を更新します。';
        location.reload();
        return;
      }
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

  dbPromise.then(readSaved).then(saved => {
    if (saved && saved.horses && Object.keys(saved.horses).length && saved.races && Object.keys(saved.races).length) launch(saved);
    else gate.hidden = false;
  }).catch(error => { gate.hidden = false; status.textContent = '保存領域を利用できません：'+error.message; });
})();