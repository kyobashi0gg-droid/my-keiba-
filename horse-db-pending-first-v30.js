// MY KEIBA LAB v30 - 馬名未入力の新規DBを先頭表示
// 汎用見出し等を仮馬名として取り込んだ馬は、名前修正前だけ登録DBの先頭へ。新しい取込ほど上にする。
(() => {
  if (window.__MYKEIBA_HORSE_DB_PENDING_FIRST_V30__) return;
  window.__MYKEIBA_HORSE_DB_PENDING_FIRST_V30__ = true;

  const WRONG_RE = /(競走馬データベース|データベース|Facebook|Twitter|Threads|Line|共有|ログイン|トップページ|検索)/i;
  const looksPending = horse => {
    const name = String(horse?.name || '').trim();
    return !horse?.nameCorrectedAt && (!name || WRONG_RE.test(name));
  };

  let queued = false;
  async function reorder() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      const section = document.querySelector('#v18DbHorseSection');
      const list = section?.querySelector('.v18-db-list');
      const api = window.MyKeibaHorseDBV18;
      if (!list || !api?.listHorses) return;

      let horses = [];
      try { horses = await api.listHorses(); } catch { return; }
      const byKey = new Map(horses.map(h => [h.key, h]));
      const cards = [...list.querySelectorAll('.v18-db-horse-card[data-v18-horse-key]')];
      if (!cards.length) return;

      cards.sort((a, b) => {
        const ah = byKey.get(a.dataset.v18HorseKey);
        const bh = byKey.get(b.dataset.v18HorseKey);
        const ap = looksPending(ah) ? 1 : 0;
        const bp = looksPending(bh) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        if (ap && bp) {
          const at = Date.parse(ah?.lastImportedAt || '') || 0;
          const bt = Date.parse(bh?.lastImportedAt || '') || 0;
          if (at !== bt) return bt - at;
        }
        return String(ah?.name || '').localeCompare(String(bh?.name || ''), 'ja');
      });

      const frag = document.createDocumentFragment();
      for (const card of cards) {
        const horse = byKey.get(card.dataset.v18HorseKey);
        card.classList.toggle('v30-pending-name', looksPending(horse));
        let badge = card.querySelector('.v30-pending-badge');
        if (looksPending(horse)) {
          if (!badge) {
            badge = document.createElement('small');
            badge.className = 'v30-pending-badge';
            badge.textContent = '馬名未入力';
            card.querySelector('div')?.appendChild(badge);
          }
        } else badge?.remove();
        frag.appendChild(card);
      }
      list.appendChild(frag);
    });
  }

  const style = document.createElement('style');
  style.textContent = `.v30-pending-name{border-color:#e2c78f!important;background:#fffaf0!important}.v30-pending-badge{display:inline-flex;margin-top:4px;padding:3px 6px;border-radius:999px;background:#fff0c8;color:#825d08;font-size:9px;font-weight:900}`;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    if (e.target?.closest?.('[data-tab="horses"],[data-v4-tab="horses"]')) setTimeout(reorder, 120);
  }, true);
  document.addEventListener('input', e => {
    if (e.target?.id === 'v4HorseSearch') setTimeout(reorder, 80);
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', () => setTimeout(reorder, 120));
  window.addEventListener('mykeiba:modules-ready', () => setTimeout(reorder, 120), { once:true });
  window.addEventListener('pageshow', () => setTimeout(reorder, 120), { passive:true });
  window.addEventListener('mykeiba:resume', () => setTimeout(reorder, 120), { passive:true });
  setTimeout(reorder, 500);

  window.MyKeibaHorseDbPendingFirstV30 = { reorder, looksPending };
})();
