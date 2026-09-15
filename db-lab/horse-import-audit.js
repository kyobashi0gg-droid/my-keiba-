// MY KEIBA DB LAB - import audit / duplicate guard / update summary
(() => {
  if (window.__MYKEIBA_DB_LAB_IMPORT_AUDIT__) return;
  window.__MYKEIBA_DB_LAB_IMPORT_AUDIT__ = true;

  const DB_NAME='my-keiba-horse-db-v1', DB_VERSION=1, HORSES='horses', RUNS='runs';
  const AUDIT_KEY='my-keiba-db-import-audit-v1';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/[\s　・･]/g,'').trim();

  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const reqP=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});

  async function snapshot(){
    const db=await openDb();
    try{
      const tx=db.transaction([HORSES,RUNS],'readonly');
      const horses=await reqP(tx.objectStore(HORSES).getAll());
      const counts=new Map();
      await new Promise((resolve,reject)=>{
        const cur=tx.objectStore(RUNS).openCursor();
        cur.onsuccess=()=>{const c=cur.result;if(!c)return resolve();const key=c.value?.horseKey;if(key)counts.set(key,(counts.get(key)||0)+1);c.continue()};
        cur.onerror=()=>reject(cur.error);
      });
      await txDone(tx);
      return {horses:new Map(horses.map(h=>[h.key,h])),counts};
    } finally {db.close()}
  }

  async function allHorses(){const db=await openDb();try{return await reqP(db.transaction(HORSES,'readonly').objectStore(HORSES).getAll())}finally{db.close()}}
  async function countRuns(key){const db=await openDb();try{return await reqP(db.transaction(RUNS,'readonly').objectStore(RUNS).index('horseKey').count(key))}finally{db.close()}}

  function duplicateInfo(horses){
    const byName=new Map(),byReg=new Map();
    for(const h of horses){
      const nk=norm(h.nameKey||h.name),reg=String(h.registrationNo||'').trim();
      if(nk){if(!byName.has(nk))byName.set(nk,[]);byName.get(nk).push(h)}
      if(reg){if(!byReg.has(reg))byReg.set(reg,[]);byReg.get(reg).push(h)}
    }
    const dupKeys=new Map();
    for(const list of byName.values()) if(list.length>1) list.forEach(h=>dupKeys.set(h.key,[...(dupKeys.get(h.key)||[]),'同名']));
    for(const list of byReg.values()) if(list.length>1) list.forEach(h=>dupKeys.set(h.key,[...(dupKeys.get(h.key)||[]),'同一登録番号']));
    return dupKeys;
  }

  function readAudit(){try{return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]')}catch{return[]}}
  function writeAudit(items){try{localStorage.setItem(AUDIT_KEY,JSON.stringify(items.slice(0,80)))}catch{}}

  async function applyPostImport(before){
    let horses=await allHorses();
    const changed=[];
    for(const h of horses){
      const prev=before.horses.get(h.key);
      const oldStamp=prev?.lastImportedAt||'';
      if(prev && oldStamp===h.lastImportedAt) continue;
      const afterCount=await countRuns(h.key);
      const beforeCount=before.counts.get(h.key)||0;
      let restoredName='';
      let nameMismatch=false;

      // 手動修正済みの馬名は、再取込したMHT側の誤認名で上書きしない。
      if(prev?.nameCorrectedAt && norm(prev.name)!==norm(h.name)){
        restoredName=prev.name;
        nameMismatch=true;
        const db=await openDb();
        try{
          const tx=db.transaction(HORSES,'readwrite');
          const store=tx.objectStore(HORSES);
          const fresh=await reqP(store.get(h.key));
          if(fresh){fresh.name=prev.name;fresh.nameKey=prev.nameKey||norm(prev.name);fresh.nameCorrectedAt=prev.nameCorrectedAt;fresh.nameReviewNeeded=false;store.put(fresh)}
          await txDone(tx);
        } finally {db.close()}
      } else if(!prev){
        const db=await openDb();
        try{
          const tx=db.transaction(HORSES,'readwrite');
          const store=tx.objectStore(HORSES);
          const fresh=await reqP(store.get(h.key));
          if(fresh){fresh.nameReviewNeeded=true;fresh.firstRegisteredAt=fresh.firstRegisteredAt||fresh.lastImportedAt||new Date().toISOString();store.put(fresh)}
          await txDone(tx);
        } finally {db.close()}
      }

      changed.push({
        key:h.key,
        name:restoredName||h.name,
        kind:prev?(afterCount>beforeCount?'update':'same'):'new',
        addedRuns:Math.max(0,afterCount-beforeCount),
        beforeRuns:beforeCount,
        afterRuns:afterCount,
        latestRunDate:h.latestRunDate||'',
        importedAt:h.lastImportedAt||new Date().toISOString(),
        nameMismatch,
        incomingName:nameMismatch?h.name:''
      });
    }

    horses=await allHorses();
    const dups=duplicateInfo(horses);
    const rows=changed.map(x=>({...x,duplicates:dups.get(x.key)||[]}));
    if(rows.length){
      const history=[...rows.sort((a,b)=>Date.parse(b.importedAt||0)-Date.parse(a.importedAt||0)),...readAudit().filter(old=>!rows.some(n=>n.key===old.key))];
      writeAudit(history);
    }
    return {rows,duplicateKeys:dups};
  }

  function summaryText(audit,count){
    const rows=audit.rows||[];
    const nNew=rows.filter(x=>x.kind==='new').length;
    const nUpd=rows.filter(x=>x.kind==='update').length;
    const nSame=rows.filter(x=>x.kind==='same').length;
    const runs=rows.reduce((s,x)=>s+(x.addedRuns||0),0);
    const dup=rows.filter(x=>x.duplicates?.length).length;
    const mismatch=rows.filter(x=>x.nameMismatch).length;
    const parts=[`登録DB ${count}頭`,`新規 ${nNew}頭`,`更新 ${nUpd}頭（新規走+${runs}）`];
    if(nSame)parts.push(`既存走のみ ${nSame}頭`);
    if(dup)parts.push(`重複候補 ${dup}頭`);
    if(mismatch)parts.push(`馬名差異 ${mismatch}頭（手動名を保持）`);
    return parts.join(' / ');
  }

  async function install(){
    const input=$('horseDbFiles');
    if(!input) return;
    // horse-import.js が先に登録したハンドラを包み、前後差分だけ監査する。
    const base=input.onchange;
    if(typeof base!=='function'||input.dataset.auditWrapped==='1')return;
    input.dataset.auditWrapped='1';
    input.onchange=async e=>{
      const files=[...(input.files||[])];
      if(!files.length)return;
      const status=$('horseImportStatus');
      if(status)status.textContent='重複・更新状況を確認してから登録しています…';
      let before;
      try{before=await snapshot()}catch{before={horses:new Map(),counts:new Map()}}
      await base.call(input,e);
      try{
        const audit=await applyPostImport(before);
        const count=(await allHorses()).length;
        if(status)status.textContent=summaryText(audit,count);
        window.dispatchEvent(new CustomEvent('mykeiba:horse-db-audited',{detail:audit}));
        window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
      }catch(err){console.error(err);if(status)status.textContent+=' / 更新確認だけ失敗しました';}
    };
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.MyKeibaDbLabImportAudit={readAudit,duplicateInfo,snapshot};
})();
