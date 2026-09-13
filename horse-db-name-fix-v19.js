// MY KEIBA LAB v19 - 馬DB名補正
// MHT側の汎用見出しを馬名と誤認した場合でも、血統登録番号を維持したまま馬名を修正できる。
(() => {
  if (window.__MYKEIBA_HORSE_DB_NAME_FIX_V19__) return;
  window.__MYKEIBA_HORSE_DB_NAME_FIX_V19__ = true;

  const DB_NAME = 'my-keiba-horse-db-v1';
  const DB_VERSION = 1;
  const HORSES = 'horses';

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const normalizeName = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  const looksWrong = name => {
    const s = String(name || '').trim();
    if (!s) return true;
    return /(競走馬データベース|データベース|Facebook|Twitter|Threads|Line|共有|ログイン|トップページ|検索)/i.test(s);
  };

  function openDb() {
    if (window.MyKeibaHorseDBV18?.openDb) return window.MyKeibaHorseDBV18.openDb();
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const reqPromise = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  async function renameHorse(key, newName) {
    const name = String(newName || '').trim();
    if (!name) throw new Error('馬名を入力してください');
    const db = await openDb();
    try {
      const tx = db.transaction(HORSES, 'readwrite');
      const store = tx.objectStore(HORSES);
      const horse = await reqPromise(store.get(key));
      if (!horse) throw new Error('登録馬が見つかりません');
      horse.name = name;
      horse.nameKey = normalizeName(name);
      horse.nameCorrectedAt = new Date().toISOString();
      store.put(horse);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
      window.MyKeibaHorseDBV18?.mountDbSection?.();
      return horse;
    } finally { db.close(); }
  }

  function ensureModal() {
    let modal = document.querySelector('#v19NameModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v19NameModal';
    modal.className = 'v19-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v19-panel">
        <div class="v19-head"><div><p class="v4-eyebrow">HORSE DB</p><h2>馬名を修正</h2></div><button type="button" class="v4-close" data-v19-close>閉じる</button></div>
        <p class="v19-note">血統登録番号と過去走はそのまま残し、表示する馬名だけ修正します。</p>
        <label class="v19-label">正しい馬名<input id="v19NameInput" class="v4-search" autocomplete="off" /></label>
        <div id="v19Reg" class="v19-reg"></div>
        <div id="v19Status" class="v19-status" hidden></div>
        <div class="v19-actions"><button type="button" class="v4-secondary" data-v19-close>キャンセル</button><button type="button" class="v4-primary" id="v19Save">この馬名に修正</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-v19-close]').forEach(b => b.onclick = () => { modal.hidden = true; });
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
    return modal;
  }

  async function openRename(key) {
    const horses = await window.MyKeibaHorseDBV18?.listHorses?.() || [];
    const horse = horses.find(h => h.key === key);
    if (!horse) return;
    const modal = ensureModal();
    const input = modal.querySelector('#v19NameInput');
    input.value = looksWrong(horse.name) ? '' : (horse.name || '');
    input.placeholder = '例：ジャスティンシカゴ';
    modal.querySelector('#v19Reg').textContent = horse.registrationNo ? `血統登録番号 ${horse.registrationNo}` : '血統登録番号 未取得';
    const status = modal.querySelector('#v19Status');
    status.hidden = true;
    modal.hidden = false;
    setTimeout(() => input.focus(), 50);
    modal.querySelector('#v19Save').onclick = async () => {
      try {
        const saved = await renameHorse(key, input.value);
        status.textContent = `「${saved.name}」に修正しました。`;
        status.className = 'v19-status ok';
        status.hidden = false;
        setTimeout(() => { modal.hidden = true; }, 500);
      } catch (e) {
        status.textContent = e?.message || '修正できませんでした';
        status.className = 'v19-status ng';
        status.hidden = false;
      }
    };
  }

  function decorateCards() {
    const section = document.querySelector('#v18DbHorseSection');
    if (!section) return;
    section.querySelectorAll('.v18-db-horse-card[data-v18-horse-key]').forEach(card => {
      if (card.dataset.v19 === '1') return;
      card.dataset.v19 = '1';
      const key = card.dataset.v18HorseKey;
      const name = card.querySelector('strong')?.textContent || '';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'v19-edit-name';
      edit.textContent = looksWrong(name) ? '馬名を直す' : '名前修正';
      edit.onclick = e => { e.preventDefault(); e.stopPropagation(); openRename(key); };
      card.appendChild(edit);
      if (looksWrong(name)) card.classList.add('v19-suspect');
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .v19-edit-name{appearance:none;border:1px solid #cbd9d0;background:#fff;color:#315c45;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;white-space:nowrap}
    .v18-db-horse-card.v19-suspect{border-color:#e3c89b;background:#fffaf1}
    .v19-modal{position:fixed;inset:0;z-index:1300;background:rgba(12,27,20,.48);display:flex;align-items:flex-end;justify-content:center;padding:12px}.v19-modal[hidden]{display:none}
    .v19-panel{width:min(620px,100%);background:#fff;border-radius:22px 22px 14px 14px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.22)}
    .v19-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v19-head h2{margin:2px 0 10px}.v19-note{font-size:12px;line-height:1.6;color:#607168;background:#f5f8f6;padding:10px 12px;border-radius:12px}.v19-label{display:grid;gap:7px;font-size:12px;font-weight:800;margin:14px 0 8px}.v19-reg{font-size:11px;color:#6a7971}.v19-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.v19-status{margin-top:10px;padding:9px 11px;border-radius:10px;font-size:12px}.v19-status.ok{background:#edf8f1;color:#21603c}.v19-status.ng{background:#fff0f0;color:#9b3333}
    @media(min-width:700px){.v19-modal{align-items:center}.v19-panel{border-radius:22px}}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (document.hidden || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorateCards(); });
  }
  schedule();
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList:true, subtree:true });
  window.addEventListener('mykeiba:horse-db-updated', schedule);
  window.addEventListener('mykeiba:resume', schedule, { passive:true });

  window.MyKeibaHorseDbNameFixV19 = { renameHorse, openRename };
})();