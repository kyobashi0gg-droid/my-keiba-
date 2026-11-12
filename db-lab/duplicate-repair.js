// DB Lab: opt-in, browser-local duplicate repair. Never deletes runs on page load.
(()=>{
  const $=id=>document.getElementById(id);
  const DB='my-keiba-horse-db-v1';
  const reqP=req=>new Promise((ok,ng)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>ng(req.error)});
  const done=tx=>new Promise((ok,ng)=>{tx.oncomplete=ok;tx.onerror=()=>ng(tx.error);tx.onabort=()=>ng(tx.error)});
  const normDate=v=>{
    const m=String(v||'').match(/(20\d{2})\s*[.\/年-]\s*(\d{1,2})\s*[.\/月-]\s*(\d{1,2})/);
    return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:'';
  };
  const norm=v=>String(v??'').replace(/[\s　・･]/g,'');
  const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
  const keyFields=['raceName','finish','distance','surface','track','lap33'];
  function compatible(a,b) {
    return keyFields.every(k=>{
      if(!present(a[k])||!present(b[k]))return true;
      if(k==='distance'||k==='lap33')return Number(a[k])===Number(b[k]);
      if(k==='surface')return norm(a[k]).replace('ダート','ダ')===norm(b[k]).replace('ダート','ダ');
      return norm(a[k])===norm(b[k]);
    });
  }
  function inspect(runs) {
    const groups=new Map();
    for(const r of runs){
      const date=normDate(r.date);if(!date)continue;
      const key=`${r.horseKey}|基準日:${date}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(r);
    }
    const repairs=[],ambiguous=[];
    for(const [key,rows] of groups){
      if(rows.length<2)continue;
      if(rows.some(x=>rows.some(y=>!compatible(x,y)))){
        ambiguous.push({key,ids:rows.map(r=>r.id),reason:'異なる競走情報'});continue;
      }
      const sorted=[...rows].sort((a,b)=>{
        const score=r=>Object.entries(r).filter(([k,v])=>!['id','horseKey','sourceFile','importedAt'].includes(k)&&present(v)).length;
        return score(b)-score(a);
      });
      const keep={...sorted[0]}, remove=[];
      const conflicts=[];
      for(const old of sorted.slice(1)){
        for(const [k,v] of Object.entries(old)){
          if(['id','horseKey','sourceFile','importedAt','date'].includes(k)||!present(v))continue;
          if(!present(keep[k]))keep[k]=v;
          else if(['finish','distance','lap33','surface','track','raceName'].includes(k)&&!compatible(keep,{[k]:v}))
            conflicts.push(k);
        }
        remove.push(old.id);
      }
      if(conflicts.length)ambiguous.push({key,ids:rows.map(r=>r.id),reason:'データ競合'});
      else repairs.push({key,keep,remove});
    }
    return {repairs,ambiguous};
  }
  async function readDb(){
    const db=await reqP(indexedDB.open(DB,1));
    try{
      const tx=db.transaction(['horses','runs'],'readonly'),finished=done(tx);
      const [horses,runs]=await Promise.all([reqP(tx.objectStore('horses').getAll()),reqP(tx.objectStore('runs').getAll())]);
      await finished;return {horses,runs};
    }finally{db.close()}
  }
  function download(data){
    const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='MY_KEIBA_DB_LAB_BEFORE_REPAIR_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  let checked=null;
  async function scan(){
    const status=$('dupRepairStatus');
    status.textContent='重複検査中…';
    try{
      const {horses,runs}=await readDb(), report=inspect(runs);
      checked={horses,runs,report};
      const count=report.repairs.reduce((n,x)=>n+x.remove.length,0);
      status.textContent=`検査結果：${horses.length}頭・${runs.length}走。修復可能な重複 ${count}走 / 要確認 ${report.ambiguous.length}組。`;
      $('dupRepairExecute').disabled=!(count>0&&report.ambiguous.length===0);
    }catch(e){checked=null;status.textContent='検査失敗：'+e.message;}
  }
  async function repair(){
    if(!checked)return;
    const status=$('dupRepairStatus'),{horses,runs,report}=checked;
    const count=report.repairs.reduce((n,x)=>n+x.remove.length,0);
    if(report.ambiguous.length||!count)return;
    if(!confirm(`現在の馬DB ${horses.length}頭・${runs.length}走をバックアップとしてダウンロードします。その後、${count}件の重複を削除する操作を続けますか？`))return;
    download({format:'my-keiba-db-lab-full-export',formatVersion:1,exportedAt:new Date().toISOString(),database:{name:DB,version:1},counts:{horses:horses.length,runs:runs.length,orphanRuns:0},horses,runs});
    if(!confirm('バックアップJSONが端末に保存されたことを確認しましたか？未確認ならキャンセルしてください。'))return;
    const db=await reqP(indexedDB.open(DB,1));
    try{
      // Re-read and check the entire set before the atomic write transaction.
      const before=await readDb(); // separate connection, no write transaction yet
      if(before.runs.length!==runs.length||before.horses.length!==horses.length||before.runs.some((r,i)=>r.id!==runs[i].id))throw Error('検査後にDBが変更されました。再検査してください');
      const fresh=inspect(before.runs);
      if(fresh.ambiguous.length||fresh.repairs.reduce((n,x)=>n+x.remove.length,0)!==count)
        throw Error('重複内容が変更されています。再検査してください');
      const tx=db.transaction('runs','readwrite'),store=tx.objectStore('runs'),finished=done(tx);
      for(const item of fresh.repairs){
        store.put(item.keep);
        for(const id of item.remove)store.delete(id);
      }
      await finished;
      checked=null;
      $('dupRepairExecute').disabled=true;
      status.textContent=`重複 ${count}走を修復しました。馬マスタは変更していません。再度「検査」を押して確認してください。`;
      window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
    }catch(e){status.textContent='修復を中止：'+e.message}
    finally{db.close()}
  }
  $('dupRepairScan')?.addEventListener('click',scan);
  $('dupRepairExecute')?.addEventListener('click',repair);
})();