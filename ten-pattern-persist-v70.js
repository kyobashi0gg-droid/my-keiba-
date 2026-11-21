/* MY KEIBA LAB v70 — Dedicated, roster-matched, per-horse ten-P persistence.
 * Sidecar protects manual inputs from other modules replacing the main race state.
 * Never guesses a missing P. Synced source data supersedes older manual values.
 */
(function(root){
  'use strict';
  const KEY='my-keiba-ten-pattern-manual-v70';
  const MAIN='my-keiba-lab-v2';
  const SYNC_BACKUP='my-keiba-smartrc-before-sync-v1';
  const allowed=new Set([0,15,30,50]);
  const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･]/g,'').trim();
  const valid=v=>v===null||(typeof v==='number'&&allowed.has(v));
  const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj||{},k);
  const horseKey=h=>String(Number(h?.number||0))+':'+norm(h?.name);
  function raceKey(r){
    const horses=(r?.horses||[]).map(horseKey).sort();
    return JSON.stringify([norm(r?.date||r?.v3DateLabel),norm(r?.track),
      String(Number(r?.raceNo||0)),norm(r?.raceName),horses]);
  }
  function read(storage){
    try {
      const raw=JSON.parse(storage.getItem(KEY)||'null');
      return raw?.version===1 && raw.races && typeof raw.races==='object' && !Array.isArray(raw.races)
        ? raw : {version:1,races:{}};
    }catch{return {version:1,races:{}};}
  }
  function write(storage,obj){
    storage.setItem(KEY,JSON.stringify(obj));
    if(storage.getItem(KEY)!==JSON.stringify(obj)) throw Error('テンPバックアップの読み戻しに失敗');
  }
  function record(storage,race,horse,value,at=Date.now()){
    if(!valid(value)) throw Error('テンPが不正です');
    const book=read(storage),rk=raceKey(race),hk=horseKey(horse);
    const item=book.races[rk]||{horses:{}};
    item.horses[hk]={value,at};
    book.races[rk]=item;
    write(storage,book);
    return true;
  }
  function take(storage,race){
    return read(storage).races[raceKey(race)]?.horses||{};
  }
  function syncedMoreRecent(h,entry){
    const sync=h?.smartrcSync;
    const sv=sync?.values?.tenPattern;
    if(!allowed.has(sv)) return false;
    const sourceAt=Date.parse(sync.observedAt||'');
    return Number.isFinite(sourceAt) && sourceAt>Number(entry.at||0);
  }
  function restore(storage,race,state,commit=true){
    if(!race || !Array.isArray(race.horses))return {restored:0,saved:0};
    const entries=take(storage,race);
    let restored=0;
    for(const horse of race.horses){
      const item=entries[horseKey(horse)];
      if(!item||!valid(item.value)||syncedMoreRecent(horse,item))continue;
      const before=own(horse,'tenPattern')?horse.tenPattern:undefined;
      if(item.value===null){
        if(own(horse,'tenPattern')){delete horse.tenPattern;restored++;}
      }else if(before!==item.value){horse.tenPattern=item.value;restored++;}
    }
    if(restored && commit && state && Array.isArray(state.races)){
      storage.setItem(MAIN,JSON.stringify(state));
    }
    return {restored,saved:Object.keys(entries).length};
  }
  function backupPreview(storage,race){
    try{
      const raw=JSON.parse(storage.getItem(SYNC_BACKUP)||'null');
      const match=(raw?.races||[]).find(r=>raceKey(r)===raceKey(race));
      if(!match)return [];
      const current=new Map((race?.horses||[]).map(h=>[horseKey(h),h]));
      return (match.horses||[]).filter(h=>allowed.has(h.tenPattern))
        .filter(h=>{
          const now=current.get(horseKey(h));
          if(!now)return false;
          if(allowed.has(now.tenPattern))return false;
          return !own(take(storage,race),horseKey(h));
        })
        .map(h=>({number:h.number,name:h.name,tenPattern:h.tenPattern}));
    }catch{return [];}
  }
  function restoreBackup(storage,race,state){
    const found=backupPreview(storage,race);
    if(!found.length)return 0;
    let count=0;
    for(const x of found){
      const h=race.horses.find(y=>horseKey(y)===horseKey(x));
      if(!h)continue;
      record(storage,race,h,x.tenPattern);
      h.tenPattern=x.tenPattern;
      count++;
    }
    if(count && state) storage.setItem(MAIN,JSON.stringify(state));
    return count;
  }
  const api={KEY,raceKey,horseKey,record,restore,take,backupPreview,restoreBackup};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MyKeibaTenPatternPersistV70=api;
})(typeof window==='undefined'?globalThis:window);
