// MY KEIBA DB LAB — full horse database export (read-only)
(function exportModule() {
  if (window.__MYKEIBA_DB_LAB_EXPORT__) return;
  window.__MYKEIBA_DB_LAB_EXPORT__ = true;

  const DB_NAME = 'my-keiba-horse-db-v1';
  const STORE_NAMES = ['horses', 'runs'];
  const $ = id => document.getElementById(id);

  function openExistingDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onupgradeneeded = () => {
        // Do not create or upgrade databases as part of a read-only export.
        req.transaction.abort();
      };
      req.onsuccess = () => {
        const db = req.result;
        if (STORE_NAMES.some(name => !db.objectStoreNames.contains(name))) {
          db.close();
          reject(new Error('馬DBの保存形式を確認できません。'));
          return;
        }
        resolve(db);
      };
      req.onerror = () => reject(new Error('登録馬DBを開けませんでした。このブラウザで登録したか確認してください。'));
      req.onblocked = () => reject(new Error('DBが使用中です。ほかのタブを閉じて再実行してください。'));
    });
  }

  function readAll(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES, 'readonly');
      const horses = tx.objectStore('horses').getAll();
      const runs = tx.objectStore('runs').getAll();
      tx.oncomplete = () => resolve({horses: horses.result, runs: runs.result});
      tx.onerror = () => reject(tx.error || new Error('DBの読み取りに失敗しました。'));
      tx.onabort = () => reject(tx.error || new Error('DBの読み取りが中断されました。'));
    });
  }

  function buildPayload(snapshot, dbVersion) {
    const keys = new Set(snapshot.horses.map(h => h.key));
    const orphanRuns = snapshot.runs.filter(r => !keys.has(r.horseKey)).length;
    return {
      format: 'my-keiba-db-lab-full-export',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      database: {name: DB_NAME, version: dbVersion},
      counts: {horses: snapshot.horses.length, runs: snapshot.runs.length, orphanRuns},
      // Preserve all original fields and keys: no rounding, filtering, or reclassification.
      horses: snapshot.horses,
      runs: snapshot.runs
    };
  }

  function saveJson(payload) {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {type: 'application/json;charset=utf-8'});
    const timestamp = payload.exportedAt.replace(/[-:]/g, '').replace('T', '_').slice(0, 15) + 'Z';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MY_KEIBA_DB_LAB_ALL_${timestamp}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  async function exportAll() {
    const button = $('exportHorseDb');
    const status = $('horseExportStatus');
    if (!button || button.disabled) return;
    button.disabled = true;
    if (status) status.textContent = '登録馬と全過去走を読み込んでいます…';
    let db;
    try {
      db = await openExistingDb();
      const snapshot = await readAll(db);
      const payload = buildPayload(snapshot, db.version);
      if (!payload.counts.horses && !payload.counts.runs) {
        if (status) status.textContent = '登録馬データはありません。この端末・ブラウザで登録したか確認してください。';
        return;
      }
      saveJson(payload);
      if (status) {
        const {horses, runs, orphanRuns} = payload.counts;
        status.textContent = `JSONを作成しました：${horses}頭・過去走${runs}件` +
          (orphanRuns ? `（馬マスタ未対応の走${orphanRuns}件も保存）` : '') +
          '。ブラウザのダウンロードを確認してください。';
      }
    } catch (error) {
      if (status) status.textContent = `書き出し失敗：${error?.message || String(error)}`;
    } finally {
      if (db) db.close();
      button.disabled = false;
    }
  }

  function install() {
    $('exportHorseDb')?.addEventListener('click', exportAll);
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', install, {once: true})
    : install();
  window.MyKeibaDbLabExport = {exportAll};
})();
