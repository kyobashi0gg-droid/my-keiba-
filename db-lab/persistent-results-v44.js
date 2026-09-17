// MY KEIBA DB LAB v44 - DB評価をレース別に永続保存
(() => {
  if (window.__MYKEIBA_DB_PERSIST_V44__) return;
  window.__MYKEIBA_DB_PERSIST_V44__ = true;

  const LEGACY_KEY = 'my-keiba-db-result-v2';
  const LEGACY_AT_KEY = 'my-keiba-db-result-v2-at';
  const ARCHIVE_KEY = 'my-keiba-db-results-v3';

  const compact = v => String(v ?? '').normalize('NFKC').replace(/[\s　・･]/g, '').trim();

  function parseRace(text) {
    const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines[0] !== 'MYKEIBA_DB_RESULT_V2' || !lines[1]) return null;
    const head = lines[1].split('|');
    const m = (head[0] || '').match(/^(.+?)\s+(\d{1,2})R$/);
    if (!m) return null;
    return {
      track: m[1].trim(),
      raceNo: String(Number(m[2])),
      raceName: head[1] || '',
      surface: head[2] || '',
      distance: head[3] || '',
      going: head[4] || '',
      avg33: head[5] || ''
    };
  }

  function raceKey(race) {
    return `${compact(race?.track)}|${String(Number(race?.raceNo || 0))}|${compact(race?.raceName)}`;
  }

  function readArchive() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || 'null');
      if (parsed && parsed.version === 3 && parsed.items && typeof parsed.items === 'object') return parsed;
    } catch {}
    return { version: 3, updatedAt: '', items: {} };
  }

  function archiveLatest(showMessage = false) {
    const text = localStorage.getItem(LEGACY_KEY);
    const race = parseRace(text);
    if (!text || !race) return false;

    const at = localStorage.getItem(LEGACY_AT_KEY) || new Date().toISOString();
    const store = readArchive();
    const key = raceKey(race);
    store.items[key] = { key, race, text, at };
    store.updatedAt = at;

    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(store));
      if (showMessage) {
        const status = document.getElementById('saveStatus');
        if (status) status.textContent = `MY KEIBA LAB用に保存しました（レース別保存 ${Object.keys(store.items).length}レース）。`;
      }
      return true;
    } catch (error) {
      console.error('DB LAB race archive save failed', error);
      if (showMessage) {
        const status = document.getElementById('saveStatus');
        if (status) status.textContent = '保存容量の上限などにより、レース別保存に失敗しました。';
      }
      return false;
    }
  }

  const saveButton = document.getElementById('saveResult');
  if (saveButton) {
    // app.js の既存保存処理が終わった後に、同じ結果をレース別アーカイブへ追加する。
    saveButton.addEventListener('click', () => setTimeout(() => archiveLatest(true), 0));
  }

  // 更新前に保存されていた直近1レースも、初回読込時にアーカイブへ移行する。
  archiveLatest(false);

  window.MyKeibaDbPersistV44 = { archiveLatest, readArchive, raceKey, parseRace };
})();
