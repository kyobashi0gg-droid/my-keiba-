(()=>{
 const $=id=>document.getElementById(id),button=$('batchImport'),status=$('batchStatus');let feed;
 const reqP=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 async function load(){const res=await fetch('./horse-batch-v1.json',{cache:'no-store'});if(!res.ok)throw Error('追加データを取得できません');return KeibaBatchCore.validate(await res.json());}
 function preview(data){$('batchPreview').textContent=`${data.label}：${data.horses.map(h=>`${h.name}（${h.runs.length}走）`).join('、')}`;}
 button.onclick=async()=>{
  button.disabled=true;status.textContent='データを確認しています…';let db;
  try{
   feed=await load();preview(feed);
   db=await reqP(indexedDB.open('my-keiba-horse-db-v1',1));
   const tx=db.transaction(['horses','runs'],'readwrite');
   const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('登録を中止しました'));});done.catch(()=>{});
   let plan;
   try{
    const hs=tx.objectStore('horses'),rs=tx.objectStore('runs');
    const [horses,runs]=await Promise.all([reqP(hs.getAll()),reqP(rs.getAll())]);
    plan=KeibaBatchCore.plan(feed,horses,runs,new Date().toISOString());
    if(plan.horseWrites.length||plan.writes.length){
     const keys=new Set(plan.summary.map(h=>h.key));
     localStorage.setItem('my-keiba-batch-backup-v1',JSON.stringify({at:new Date().toISOString(),batch:feed.id,horses:horses.filter(h=>keys.has(h.key)),runs:runs.filter(r=>keys.has(r.horseKey)),newHorseKeys:plan.summary.filter(h=>h.kind==='new').map(h=>h.key)}));
     for(const h of plan.horseWrites)hs.put(h);for(const r of plan.writes)rs.put(r);
    }
   }catch(e){tx.abort();await done.catch(()=>{});throw e;}
   await done;
   try{const old=JSON.parse(localStorage.getItem('my-keiba-db-import-audit-v1')||'[]');localStorage.setItem('my-keiba-db-import-audit-v1',JSON.stringify([...plan.summary,...old.filter(h=>!plan.summary.some(n=>n.key===h.key))].slice(0,80)));}catch{}
   const s=plan.summary;status.textContent=`登録完了：新規 ${s.filter(h=>h.kind==='new').length}頭 / 更新 ${s.filter(h=>h.kind==='update').length}頭 / 変更なし ${s.filter(h=>h.kind==='same').length}頭。${s.map(h=>`${h.name} ${h.afterRuns}走（追加${h.addedRuns}走）`).join('、')}`;
   window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
   $('loadDb').click();
  }catch(e){status.textContent='取り込みできませんでした：'+e.message;}
  finally{db?.close();button.disabled=false;}
 };
 load().then(data=>{feed=data;preview(data);button.disabled=false;status.textContent='ボタンを押すと、このブラウザの馬DBに登録します。';}).catch(e=>{status.textContent=e.message;button.disabled=false;});
})();
