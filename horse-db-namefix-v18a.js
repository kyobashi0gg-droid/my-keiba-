// MY KEIBA LAB v18a - 馬DB 馬名認識補正
(() => {
  if (window.__MYKEIBA_HORSE_DB_NAMEFIX_V18A__) return;
  window.__MYKEIBA_HORSE_DB_NAMEFIX_V18A__ = true;

  const DB_NAME = 'my-keiba-horse-db-v1';
  const HORSES = 'horses';
  const pending = new Map();
  const GENERIC = /(競走馬データベース|競走馬DB|競走馬情報|馬情報|データベース|鈴木ショータ|大穴マシマシ競馬|MY\s*KEIBA)/i;
  const normalize = v => window.MyKeibaDataV16?.normalizeHorseName ? window.MyKeibaDataV16.normalizeHorseName(v) : String(v || '').replace(/[\s　・･]/g, '').trim();

  function plausible(v) {
    const s = String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^【|】$/g, '').trim();
    if (!s || s.length < 2 || s.length > 32 || GENERIC.test(s)) return '';
    if (/血統登録番号|登録番号|調教採点|レース総評|着順|距離|騎手|競馬場/.test(s)) return '';
    return /[ァ-ヶヴーA-Za-z]/.test(s) ? s : '';
  }

  function decodeQP(text) {
    const clean = String(text || '').replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(clean.slice(i + 1, i + 3))) { bytes.push(parseInt(clean.slice(i + 1, i + 3), 16)); i += 2; }
      else { const c = clean.charCodeAt(i); if (c <= 255) bytes.push(c); else bytes.push(...new TextEncoder().encode(clean[i])); }
    }
    try { return new TextDecoder('shift_jis').decode(new Uint8Array(bytes)); } catch { return new TextDecoder().decode(new Uint8Array(bytes)); }
  }

  function decodeMht(raw) {
    const boundary = raw.slice(0, 6000).match(/boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return raw;
    for (const part of raw.split(`--${boundary}`)) {
      const sep = part.search(/\r?\n\r?\n/); if (sep < 0) continue;
      const head = part.slice(0, sep); if (!/Content-Type:\s*text\/html/i.test(head)) continue;
      const body = part.slice(sep).replace(/^\r?\n\r?\n/, '').trim();
      const enc = head.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || '';
      const cs = /shift[_-]?jis|sjis|windows-31j|cp932/i.test(head) ? 'shift_jis' : 'utf-8';
      try {
        if (enc.includes('base64')) { const bin = atob(body.replace(/\s/g, '')); return new TextDecoder(cs).decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
        if (enc.includes('quoted-printable')) return decodeQP(body);
      } catch {}
      return body;
    }
    return raw;
  }

  async function inspect(file) {
    const raw = await file.text();
    const html = /\.mht(?:ml)?$/i.test(file.name) ? decodeMht(raw) : raw;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = (doc.body?.innerText || doc.documentElement?.textContent || '').replace(/\u00a0/g, ' ');
    const reg = text.match(/(?:血統登録番号|登録番号)\s*[:：]?\s*([A-Za-z0-9-]{6,20})/i)?.[1] || '';
    if (!reg) return null;
    const c = [];
    const add = v => { const s = plausible(v); if (s) c.push(s); };
    add(file.name.replace(/\.(mht|mhtml|html?|txt)$/i, '').split(/[|｜]/)[0]);
    add(doc.querySelector('meta[property="og:title"],meta[name="twitter:title"]')?.content?.split(/[|｜:：]/)[0]);
    add(doc.title?.split(/[|｜:：]/)[0]);
    for (const sel of ['.horse_name','.horseName','[class*="horse-name"]','[class*="horse_name"]','[id*="horse-name"]','[id*="horse_name"]']) add(doc.querySelector(sel)?.textContent);
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const ri = lines.findIndex(x => x.includes(reg) || /血統登録番号|登録番号/.test(x));
    if (ri >= 0) for (let i = ri - 1; i >= Math.max(0, ri - 12); i--) add(lines[i]);
    for (const el of doc.querySelectorAll('h1,h2')) add(el.textContent);
    const name = c[0] || '';
    return name ? { registrationNo: reg, name, nameKey: normalize(name) } : null;
  }

  function openDb() { return new Promise((resolve, reject) => { const r = indexedDB.open(DB_NAME, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }

  async function repair(info) {
    const db = await openDb();
    try {
      const tx = db.transaction(HORSES, 'readwrite');
      const store = tx.objectStore(HORSES);
      const key = `reg:${info.registrationNo}`;
      const horse = await new Promise((resolve, reject) => { const r = store.get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      if (!horse || normalize(horse.name) === info.nameKey) return false;
      horse.name = info.name; horse.nameKey = info.nameKey; horse.registrationNo = info.registrationNo; horse.nameFixedAt = new Date().toISOString();
      store.put(horse);
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      return true;
    } finally { db.close(); }
  }

  document.addEventListener('change', async e => {
    if (e.target?.id !== 'v18HorseDbFile') return;
    for (const file of [...(e.target.files || [])]) { try { const info = await inspect(file); if (info) pending.set(info.registrationNo, info); } catch {} }
  }, true);

  window.addEventListener('mykeiba:horse-db-updated', async () => {
    if (!pending.size) return;
    let changed = false;
    for (const info of pending.values()) { try { if (await repair(info)) changed = true; } catch {} }
    pending.clear();
    if (changed) { window.MyKeibaHorseDBV18?.mountDbSection?.(); window.dispatchEvent(new CustomEvent('mykeiba:horse-db-namefixed')); }
  });
})();