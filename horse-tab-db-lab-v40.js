// MY KEIBA LAB v40 - 競走馬タブをDB LABへの軽量入口にする
(() => {
  if (window.__MYKEIBA_HORSE_TAB_DB_LAB_V40__) return;
  window.__MYKEIBA_HORSE_TAB_DB_LAB_V40__ = true;

  const DB_NAME = 'my-keiba-horse-db-v1';
  const DB_VERSION = 1;
  const HORSES = 'horses';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function countHorses() {
    return new Promise(async (resolve) => {
      let db;
      try {
        db = await openDb();
        const tx = db.transaction(HORSES, 'readonly');
        const req = tx.objectStore(HORSES).count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch { resolve(0); }
      finally { if (db) setTimeout(() => db.close(), 0); }
    });
  }

  async function render() {
    const view = document.querySelector('[data-view="horses"]');
    if (!view || view.hidden) return false;

    const count = await countHorses();
    if (!view || view.hidden) return false;
    view.innerHTML = `
      <div class="v40-head">
        <div><p class="v4-eyebrow">HORSE DATABASE</p><h1 class="v4-h1" style="margin:0">競走馬DB</h1></div>
        <span class="v40-count">${count}頭</span>
      </div>
      <article class="v40-card">
        <div class="v40-icon">DB</div>
        <h2>馬DBはDB LABで管理</h2>
        <p>MY KEIBA LAB本体では馬一覧や過去走DBを展開せず、DB LABで計算した33評価だけを受け取ります。</p>
        <button type="button" id="v40OpenDbLab" class="v4-primary">DB LABを開く</button>
        <small>登録馬 ${count}頭 / 過去走の登録・名前修正・33適合評価はDB LAB側で行います。</small>
      </article>`;

    view.querySelector('#v40OpenDbLab')?.addEventListener('click', () => {
      location.href = './db-lab/';
    });
    return true;
  }

  let timer = null;
  function schedule(ms = 30) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { render().catch(() => {}); }), ms);
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"]')) schedule(20);
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', () => schedule(20));
  window.addEventListener('mykeiba:modules-ready', () => schedule(40), { once:true });
  window.addEventListener('pageshow', () => schedule(40), { passive:true });
  window.addEventListener('mykeiba:resume', () => schedule(40), { passive:true });

  const style = document.createElement('style');
  style.textContent = `
    .v40-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:14px}.v40-count{display:inline-flex;padding:6px 10px;border-radius:999px;background:#edf4f0;color:#496759;font-size:11px;font-weight:950}
    .v40-card{background:#fff;border:1px solid #dbe8e0;border-radius:22px;padding:22px 18px;text-align:center;box-shadow:0 8px 24px rgba(22,67,45,.04)}
    .v40-icon{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;margin:0 auto 12px;background:#e8f5ed;color:#226641;font-weight:950;font-size:18px}.v40-card h2{margin:0 0 8px;font-size:21px;color:#193d2c}.v40-card p{margin:0 auto 16px;max-width:520px;color:#67786f;font-size:12px;line-height:1.7}.v40-card button{width:100%;min-height:54px;font-size:16px}.v40-card small{display:block;margin-top:10px;color:#738279;font-size:10px;line-height:1.55}`;
  document.head.appendChild(style);

  window.MyKeibaHorseTabDbLabV40 = { render, schedule, countHorses };
})();