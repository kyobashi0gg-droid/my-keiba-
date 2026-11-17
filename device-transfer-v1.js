/* MY KEIBA LAB: private device transfer v1.
 * Includes the MY KEIBA main state, local analytical archives, and raw horse DB.
 * No cloud upload. Secrets are never exported. No overwrite of a populated target.
 */
(()=>{
 'use strict';
 if(window.__MYKEIBA_TRANSFER_V1__)return;
 window.__MYKEIBA_TRANSFER_V1__=true;
 const FMT='MYKEIBA_DEVICE_TRANSFER_V1',DB_NAME='my-keiba-horse-db-v1',
       STORES=['horses','runs'],EXCLUDED=new Set(['my-keiba-live-odds-private-access-v1']),
       MAX_SIZE=150*1024*1024;
 const $=id=>document.getElementById(id);
 const status=(message,kind='info')=>{
   for(const id of ['transfer-status','v4-transfer-status']){const el=$(id);if(el){el.textContent=message;el.dataset.kind=kind;}}
 };
 const allowed=k=>(/^my-keiba-/i.test(k)||/^MYKEIBA_/i.test(k))&&!EXCLUDED.has(k)&&!/secret|token|password|private.access|credential|api.key/i.test(k);
 const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('IndexedDB操作に失敗しました'));});
 const hasStores=db=>STORES.every(n=>db.objectStoreNames.contains(n));
 function openExisting(){
   return new Promise((resolve,reject)=>{
     const req=indexedDB.open(DB_NAME);
     req.onupgradeneeded=()=>req.transaction.abort(); // Never create a new DB while only inspecting.
     req.onsuccess=()=>{const db=req.result;if(!hasStores(db)){db.close();reject(Error('馬DBの保存構造が一致しません'));}else resolve(db);};
     req.onerror=()=>reject(Error('馬DBを読み取れません。MY KEIBA DB LABを開いて確認してください。'));
     req.onblocked=()=>reject(Error('別のMY KEIBA画面を閉じてから再実行してください。'));
   });
 }
 async function snapshot(){
   const db=await openExisting();
   try{
     const tx=db.transaction(STORES,'readonly');
     const horses=tx.objectStore('horses').getAll(),runs=tx.objectStore('runs').getAll();
     const [h,r]=await Promise.all([request(horses),request(runs)]);
     return {horses:h,runs:r};
   }finally{db.close();}
 }
 function localSnapshot(){
   const obj={};for(let i=0;i<localStorage.length;i++){
     const k=localStorage.key(i);
     if(allowed(k))obj[k]=localStorage.getItem(k);
   }return obj;
 }
 function download(payload){
   const blob=new Blob([JSON.stringify(payload)],{type:'application/json;charset=utf-8'});
   if(blob.size>MAX_SIZE)throw Error('バックアップが150MBを超えました。分割形式の検討が必要です。');
   const a=document.createElement('a'),url=URL.createObjectURL(blob);
   a.href=url;a.download='MY_KEIBA_LAB_DEVICE_BACKUP_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.json';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   return blob.size;
 }
 async function exportAll(){
   const btn=$('transfer-export');btn.disabled=true;
   try{
     status('馬DB・分析履歴を読み取っています…');
     const data=await snapshot(),locals=localSnapshot(),keys=new Set(data.horses.map(h=>h.key));
     const orphan=data.runs.filter(r=>!keys.has(r.horseKey)).length;
     const main=locals['my-keiba-lab-v2'];
     if(!main&&!data.horses.length)throw Error('このブラウザにMY KEIBA LABの保存データが見つかりません。');
     if(main){let obj;try{obj=JSON.parse(main)}catch{throw Error('メイン保存データが不正なJSONです。')}if(!Array.isArray(obj?.races))throw Error('メイン保存データにレース配列がありません。');}
     const payload={format:FMT,version:1,exportedAt:new Date().toISOString(),
       origin:'MY KEIBA LAB',local:locals,horseDb:{database:DB_NAME,horses:data.horses,runs:data.runs},
       counts:{horses:data.horses.length,runs:data.runs.length,localKeys:Object.keys(locals).length,orphanRuns:orphan}};
     const bytes=download(payload);
     status('保存ファイルを作成しました：'+data.horses.length+'頭・過去走'+data.runs.length+'走・分析保存領域'+Object.keys(locals).length+'件（'+(bytes/1048576).toFixed(1)+'MB）。'
     +(orphan?'注意：所属馬が一致しない過去走'+orphan+'件も原本のまま保存しました。':'')
     +' タブレットへ転送してください。','success');
   }catch(e){status('書き出し失敗：'+(e?.message||String(e)),'error');}
   finally{btn.disabled=false;}
 }
 function validate(data){
   if(data?.format!==FMT||data.version!==1)throw Error('MY KEIBA LABの端末一括バックアップJSONではありません。');
   if(!data.local||typeof data.local!=='object'||Array.isArray(data.local)||!data.horseDb||!Array.isArray(data.horseDb.horses)||!Array.isArray(data.horseDb.runs))
     throw Error('バックアップ内容が不完全です。');
   if(data.horseDb.database!==DB_NAME)throw Error('馬DBの識別子が異なります。');
   if(Object.keys(data.local).some(k=>!allowed(k)||typeof data.local[k]!=='string'))throw Error('未対応の保存キーが含まれます。');
   const ids=new Set(),keys=new Set();
   for(const h of data.horseDb.horses){
     if(!h||typeof h!=='object'||typeof h.key!=='string'||!h.key||keys.has(h.key))throw Error('馬DBの馬キーが重複・欠損しています。');
     keys.add(h.key);
   }
   for(const r of data.horseDb.runs){
     if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('馬DBの過去走IDが重複・欠損しています。');
     ids.add(r.id);
   }
   const app=data.local['my-keiba-lab-v2'];
   if(app){let parsed;try{parsed=JSON.parse(app)}catch{throw Error('レース保存データのJSONが不正です。')}
     if(!Array.isArray(parsed?.races))throw Error('レース保存データが不完全です。');
   }
   if(data.counts&&(data.counts.horses!==keys.size||data.counts.runs!==ids.size))
     throw Error('バックアップ件数と実データの件数が一致しません。');
   return {horses:keys.size,runs:ids.size,localKeys:Object.keys(data.local).length};
 }
 async function targetIsEmpty(db){
   const tx=db.transaction(STORES,'readonly');
   const [horses,runs]=await Promise.all([request(tx.objectStore('horses').count()),request(tx.objectStore('runs').count())]);
   const existing=Object.keys(localStorage).filter(allowed);
   // A freshly opened installation may auto-create an empty main state.
   // Permit replacing ONLY that known, verifiably empty initialization key.
   const safeEmpty=existing.filter(k=>{
     if(k!=='my-keiba-lab-v2')return false;
     try{
       const v=JSON.parse(localStorage.getItem(k));
       return v&&typeof v==='object'&&!Array.isArray(v)
         && Array.isArray(v.races)&&v.races.length===0
         && Object.keys(v).every(field=>['races','meta','version','updatedAt'].includes(field))
         && (!('meta' in v)||(v.meta&&typeof v.meta==='object'&&!Array.isArray(v.meta)));
     }catch{return false;}
   });
   return {ok:horses===0&&runs===0&&existing.length===safeEmpty.length,horses,runs,existing,safeEmpty};
 }
 function writeDb(db,horseDb){
   return new Promise((resolve,reject)=>{
     const tx=db.transaction(STORES,'readwrite');
     tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('馬DBの保存に失敗しました'));tx.onabort=()=>reject(tx.error||Error('馬DBの復元が中断されました'));
     try{
       const h=tx.objectStore('horses'),r=tx.objectStore('runs');
       for(const item of horseDb.horses)h.add(item);
       for(const item of horseDb.runs)r.add(item);
     }catch(e){tx.abort();reject(e);}
   });
 }
 function openRestoreDb(){
   return new Promise((resolve,reject)=>{
     const req=indexedDB.open(DB_NAME,1);
     req.onupgradeneeded=()=>{
       const db=req.result;
       if(!db.objectStoreNames.contains('horses')){
         const h=db.createObjectStore('horses',{keyPath:'key'});
         h.createIndex('nameKey','nameKey');h.createIndex('registrationNo','registrationNo');
       }
       if(!db.objectStoreNames.contains('runs')){
         const r=db.createObjectStore('runs',{keyPath:'id'});
         r.createIndex('horseKey','horseKey');r.createIndex('date','date');
       }
     };
     req.onsuccess=()=>{
       const db=req.result;
       if(!hasStores(db)){db.close();reject(Error('既存の馬DBの構造が未対応です。データは変更していません。'));}
       else resolve(db);
     };
     req.onerror=()=>reject(req.error||Error('馬DBを開けません。'));
     req.onblocked=()=>reject(Error('別のMY KEIBA画面を閉じてください。'));
   });
 }
 async function restore(file){
   if(file.size>MAX_SIZE)throw Error('150MB以下のバックアップファイルを選んでください。');
   let data;try{data=JSON.parse(await file.text())}catch{throw Error('JSONファイルが読み取れません。');}
   const counts=validate(data);
   const db=await openRestoreDb();
   try{
     const check=await targetIsEmpty(db);
     if(!check.ok){
       const details=check.existing.map(k=>{
         let shape='未解析';
         try{
           const raw=localStorage.getItem(k)||'';
           const obj=JSON.parse(raw);
           shape=Array.isArray(obj)?'配列'+obj.length+'件':
             obj&&typeof obj==='object'?'項目：'+Object.keys(obj).slice(0,12).join(', '):
             '型：'+typeof obj;
         }catch{shape='JSON以外';}
         return k+'（'+shape+'）';
       }).join(' / ');
       throw Error('既存データの保護により停止：馬'+check.horses+'頭・過去走'+check.runs+'走・分析領域'+check.existing.length+'件。'
         +' 保存キーの診断：'+details+'。この内容をラップ君に送ってください。削除・上書きはしていません。');
     }
     if(!confirm('タブレットの0レース初期状態（metaを含む）はバックアップで置き換えます。既存の馬DBは0頭・過去走0走です。\nMY KEIBA LABのバックアップを復元します。\n馬'+counts.horses+'頭・過去走'+counts.runs+'走・分析保存'+counts.localKeys+'件。\n復元を開始しますか？'))return false;
     // Preserve the verified empty initialization state for rollback.
     const written=[],prior=new Map(check.safeEmpty.map(k=>[k,localStorage.getItem(k)]));
     try{
       for(const [k,v] of Object.entries(data.local)){
         localStorage.setItem(k,v);
         written.push(k);
       }
       await writeDb(db,data.horseDb);
     }catch(e){
       for(const k of written){
         try{if(prior.has(k))localStorage.setItem(k,prior.get(k));else localStorage.removeItem(k);}catch(_){}
       }
       throw Error('復元を完了できませんでした。復元途中の分析データは取り消しました。原因：'+String(e?.message||e));
     }
     return true;
   }finally{db.close();}
 }
 async function onImport(input){
   const file=input?.files?.[0],btn=input?.id==='transfer-import'?$('transfer-import-label'):input?.closest('label');
   if(!file){status('JSONファイルが選択されていません。');return;}
   try{
     if(btn)btn.style.pointerEvents='none';
     status('選択：'+file.name+'（'+(file.size/1048576).toFixed(1)+'MB）。バックアップを検証しています…');
     const restored=await restore(file);
     if(restored){status('復元完了。レース、馬DB、ラップ君の保存結果を読み込み直します。','success');location.reload();}
     else status('復元をキャンセルしました。データは変更していません。');
   }catch(e){status('復元できませんでした：'+(e?.message||String(e)),'error');}
   finally{if(btn)btn.style.pointerEvents='';input.value='';}
 }
 function init(){
   const btn=$('transfer-export');
   if(btn)btn.addEventListener('click',exportAll);
   // Integrated dashboard is re-rendered, so listen on document rather than one transient input.
   document.addEventListener('change',e=>{
     if(e.target?.id==='transfer-import'||e.target?.id==='v4-transfer-import-file')onImport(e.target);
   },true);
   document.addEventListener('input',e=>{
     if(e.target?.id==='v4-transfer-import-file'&&e.target.files?.length)
       status('ファイル選択を検知：'+e.target.files[0].name+'。読み込み処理を待っています…');
   },true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.MyKeibaDeviceTransferV1={validate,allowed};
})();
