// MY KEIBA DB LAB - horse DB standalone importer
// Uses the same IndexedDB database as MY KEIBA LAB, so existing registrations are shared automatically.
(() => {
  const DB_NAME = 'my-keiba-horse-db-v1';
  const DB_VERSION = 1;
  const HORSES = 'horses';
  const RUNS = 'runs';
  const $ = id => document.getElementById(id);

  const normName = v => String(v || '').replace(/[\s　・･]/g, '').trim();

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

  const reqP = req => new Promise((resolve, reject) => {
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
    const boundary = raw.slice(0, 5000).match(/boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return raw;
    const htmlParts = [];
    for (const part of raw.split(`--${boundary}`)) {
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
          htmlParts.push(decodeBytes(Uint8Array.from(bin, c => c.charCodeAt(0)), charset));
        } else if (enc.includes('quoted-printable')) {
          htmlParts.push(decodeBytes(quotedPrintableBytes(body), charset));
        } else htmlParts.push(body);
      } catch { htmlParts.push(body); }
    }
    return htmlParts.join('\n') || raw;
  }

  function textOf(doc) {
    return (doc.body?.innerText || doc.documentElement?.textContent || '')
      .replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function identity(doc, fullText, fileName) {
    const reg = fullText.match(/(?:血統登録番号|登録番号)\s*[:：]?\s*([A-Za-z0-9-]{6,20})/i)?.[1] || '';
    let name = '';
    for (const sel of ['h1','.horse_name','.horseName','[class*="horse-name"]','[class*="horse_name"]']) {
      const t = doc.querySelector(sel)?.textContent?.trim();
      if (t && /[ァ-ヶーA-Za-z]/.test(t) && t.length <= 40) { name = t; break; }
    }
    if (!name) name = fullText.match(/(?:馬名|競走馬名)\s*[:：]?\s*([ァ-ヶヴーA-Za-z0-9・･]{2,30})/)?.[1] || '';
    if (!name) {
      const title = doc.title?.trim() || '';
      name = title.split(/[|｜:：\-–—]/)[0].replace(/競走馬|データベース|馬情報/g, '').trim();
    }
    if (!name || /Facebook|Twitter|競走馬データベース/i.test(name)) {
      const m = fullText.match(/(?:^|\n)([ァ-ヶヴー]{3,24})(?:\s|\n)/);
      if (m) name = m[1];
    }
    if (!name) name = fileName.replace(/\.(mht|mhtml|html?|txt)$/i, '').trim();
    return { name: name.replace(/^【|】$/g, '').trim(), registrationNo: reg };
  }

  const aliases = {
    date:['日付','年月日','開催日','日程'], raceName:['レース名','競走名','レース'], finish:['着順','着'],
    raceClass:['クラス','競走クラス','クラス名'], fieldSize:['頭数','出走頭数'], lap33:['33ラップ','33lap','33'], track:['競馬場','開催場','場'],
    surface:['芝ダ','芝・ダ','芝ダート','馬場種別','コース種別'], distance:['距離'], going:['馬場状態','馬場','馬場コンディション','コンディション'],
    odds:['単勝オッズ','オッズ','単勝'], agari:['上がり3f','上り3f','上がり','上り'], positions:['通過順','通過'],
    margin:['着差','タイム差','差'], pace:['ペース'], review:['レース総評','総評'], weight:['馬体重'], jockey:['騎手'], trainingScore:['調教採点','採点']
  };

  function headerKey(text) {
    const x = String(text || '').toLowerCase().replace(/[\s　()（）・･／/]/g, '');
    for (const [key, names] of Object.entries(aliases)) {
      if (names.some(n => x === n.toLowerCase().replace(/[\s　()（）・･／/]/g, ''))) return key;
    }
    return '';
  }

  function normalizeDate(v) {
    const s = String(v || '').trim();
    const m = s.match(/(20\d{2})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/);
    return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` : s;
  }
  function normalizeGoing(v) { const s=String(v||''); if(/不良/.test(s))return'不良'; if(/稍/.test(s))return'稍重'; if(/重/.test(s))return'重'; if(/良/.test(s))return'良'; return''; }
  function normalizeSurface(v) { const s=String(v||''); if(/ダート|ダ|ﾀﾞ/i.test(s))return'ダ'; if(/芝/.test(s))return'芝'; return''; }

  function parseRunTables(doc) {
    const out = [];
    let hasMarginColumn = false;
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')];
      let headerRow = -1, cols = [];
      for (let i=0;i<Math.min(rows.length,8);i++) {
        const mapped = [...rows[i].querySelectorAll('th,td')].map(c => headerKey(c.textContent.trim()));
        if (mapped.filter(Boolean).length >= 3 && (mapped.includes('date') || mapped.includes('raceName'))) {
          headerRow=i; cols=mapped;
          if(mapped.includes('margin'))hasMarginColumn=true;
          break;
        }
      }
      if (headerRow < 0) continue;
      for (let i=headerRow+1;i<rows.length;i++) {
        const cells=[...rows[i].querySelectorAll('th,td')]; if(!cells.length)continue;
        const run={}; cells.forEach((c,idx)=>{if(cols[idx])run[cols[idx]]=c.textContent.trim();});
        if(!run.date&&!run.raceName)continue;
        const rowText=cells.map(c=>c.textContent.trim()).join(' ');
        if(!run.raceClass){
          const cm=rowText.match(/(?:新馬|未勝利|1勝(?:クラス)?|2勝(?:クラス)?|3勝(?:クラス)?|オープン|OP|リステッド|Listed|G\s*[123]|Ｇ[１２３]|G[ⅠⅡⅢ]|Jpn\s*[123])/i);
          if(cm)run.raceClass=cm[0];
        }
        run.date=normalizeDate(run.date); run.going=normalizeGoing(run.going); run.surface=normalizeSurface(run.surface);
        out.push(run);
      }
    }
    const seen=new Set();
    const runs=out.filter(r=>{const k=[r.date,r.track,r.raceName,r.distance,r.finish].map(v=>String(v||'').trim()).join('|');if(!k.replace(/\|/g,'')||seen.has(k))return false;seen.add(k);return true;});
    return {runs,hasMarginColumn};
  }

  async function parseFile(file) {
    const raw=await file.text();
    const html=/\.mht(?:ml)?$/i.test(file.name)?decodeMht(raw):raw;
    const doc=new DOMParser().parseFromString(html,'text/html');
    const fullText=textOf(doc); const id=identity(doc,fullText,file.name); const parsed=parseRunTables(doc),runs=parsed.runs;
    const dates=runs.map(r=>r.date).filter(v=>/^20\d{2}-\d{2}-\d{2}$/.test(v)).sort();
    const marginRuns=runs.filter(r=>String(r.margin||'').trim()!=='').length;
    return { fileName:file.name, name:id.name, nameKey:normName(id.name), registrationNo:id.registrationNo, runs, marginRuns, hasMarginColumn:parsed.hasMarginColumn, newestDate:dates.at(-1)||'', parsedAt:new Date().toISOString() };
  }

  function runId(horseKey, run) {
    const raw=[horseKey,run.date,run.track,run.raceName,run.distance,run.finish].map(v=>String(v||'').trim()).join('|');
    let hash=2166136261; for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);} return `${horseKey}:${(hash>>>0).toString(36)}`;
  }

  async function saveOne(item) {
    if (!item.nameKey || !item.runs.length) throw new Error('馬名または過去走を認識できません');
    const db=await openDb();
    try {
      const tx=db.transaction([HORSES,RUNS],'readwrite'); const hs=tx.objectStore(HORSES), rs=tx.objectStore(RUNS);
      let existing=await reqP(hs.index('nameKey').get(item.nameKey));
      if(!existing && item.registrationNo) existing=await reqP(hs.index('registrationNo').get(item.registrationNo));
      const key=existing?.key || (item.registrationNo?`reg:${item.registrationNo}`:`name:${item.nameKey}`);
      let added=0;
      for(const run of item.runs){const rec={...run,id:runId(key,run),horseKey:key,sourceFile:item.fileName,importedAt:item.parsedAt};const old=await reqP(rs.get(rec.id));if(!old)added++;rs.put({...old,...rec});}
      hs.put({...existing,key,name:item.name,nameKey:item.nameKey,registrationNo:item.registrationNo||existing?.registrationNo||'',lastImportedAt:item.parsedAt,sourceFile:item.fileName,latestRunDate:item.newestDate||existing?.latestRunDate||'',dbSchemaVersion:18});
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
      return { name:item.name, added, total:item.runs.length, sourceMarginRuns:item.marginRuns||0, hasMarginColumn:!!item.hasMarginColumn };
    } finally { db.close(); }
  }

  async function existingCount() { const db=await openDb(); try{return await reqP(db.transaction(HORSES,'readonly').objectStore(HORSES).count());}finally{db.close();} }

  async function importFiles(files) {
    const status=$('horseImportStatus'); if(status) status.textContent='馬DBを解析中…';
    const results=[];
    for(const file of files){
      try { const item=await parseFile(file); results.push(await saveOne(item)); }
      catch(e){ results.push({name:file.name,error:e.message||'取込失敗'}); }
      await new Promise(r=>setTimeout(r,0));
    }
    const ok=results.filter(x=>!x.error), ng=results.filter(x=>x.error); const count=await existingCount();
    const sourceRuns=ok.reduce((s,x)=>s+(Number(x.total)||0),0);
    const sourceMarginRuns=ok.reduce((s,x)=>s+(Number(x.sourceMarginRuns)||0),0);
    const marginColumnFiles=ok.filter(x=>x.hasMarginColumn).length;
    window.MyKeibaDbLabLastImportStats={files:ok.length,sourceRuns,sourceMarginRuns,marginColumnFiles,failed:ng.length,at:new Date().toISOString()};
    if(status) status.textContent=`登録DB ${count}頭。今回 ${ok.length}頭取込${ng.length?` / ${ng.length}件失敗`:''}。` + (ok.length?` ${ok.map(x=>`${x.name}(新規走+${x.added})`).join('、')}`:'');
    window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
  }

  function install() {
    const btn=$('horseDbAdd'), input=$('horseDbFiles');
    if(!btn||!input)return;
    btn.onclick=()=>input.click();
    input.onchange=async()=>{const files=[...(input.files||[])]; input.value=''; if(files.length) await importFiles(files);};
    existingCount().then(c=>{const s=$('horseImportStatus'); if(s&&!s.textContent)s.textContent=`MY KEIBA LABと共通DB：${c}頭登録済み`;}).catch(()=>{});
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.MyKeibaDbLabHorseImport={importFiles,existingCount};
})();