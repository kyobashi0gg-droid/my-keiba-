// Initialize before any reader can create an empty database at version 1.
(async()=>{
 const name='my-keiba-horse-db-v1';
 function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;const h=db.createObjectStore('horses',{keyPath:'key'});h.createIndex('nameKey','nameKey');h.createIndex('registrationNo','registrationNo');const s=db.createObjectStore('runs',{keyPath:'id'});s.createIndex('horseKey','horseKey');s.createIndex('date','date');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('ほかのMY KEIBA画面を閉じて再読み込みしてください'));});}
 try{
  let db=await open();
  // Only the broken, schema-less shell is recreated. A database containing
  // ANY object store (including unknown stores) is never deleted here.
  if(db.objectStoreNames.length===0){db.close();await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('ほかのMY KEIBA画面を閉じて再読み込みしてください'));});db=await open();}
  const valid=db.objectStoreNames.contains('horses')&&db.objectStoreNames.contains('runs');db.close();if(!valid)throw Error('DBの構成を確認できません。既存データは変更していません。');
  const files=['horse-import.js','horse-import-audit.js','horse-manage.js','db-export.js?v=20261013-1','pdf-import.js?v=20261003-0108','app.js?v=20261003-0935','persistent-results-v44.js','batch-core.js?v=1','batch-import.js?v=3'];
  for(const file of files)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./'+file;s.onload=resolve;s.onerror=()=>reject(Error('画面の読込に失敗しました。再読み込みしてください'));document.body.append(s);});
 }catch(e){document.getElementById('horseImportStatus').textContent=e.message;document.getElementById('batchStatus').textContent=e.message;}
})();
