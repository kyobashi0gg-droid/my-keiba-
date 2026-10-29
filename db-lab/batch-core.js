(function(root){
'use strict';
const norm=v=>String(v||'').replace(/[\s　・･]/g,'');
const date=v=>String(v||'').replace(/\s/g,'').replace(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/,(_,y,m,d)=>`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
const fields=['date','track','raceName','raceClass','finish','fieldSize','lap33','surface','distance','going','odds','time','agari','positions','pace','review','weight','jockey','trainingScore','frame','carriedWeight','sex','margin'];
function runId(key,r){const raw=[key,r.date,r.track,r.raceName,r.distance,r.finish].map(v=>String(v||'').trim()).join('|');let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${key}:${(hash>>>0).toString(36)}`;}
function validate(data){
 if(data?.format!=='MYKEIBA_HORSE_BATCH_V1'||!Array.isArray(data.horses)||!data.horses.length||data.horses.length>2000)throw Error('対応する馬DBデータではありません');
 const seen=new Set();
 for(const h of data.horses){
  if(typeof h.name!=='string'||!norm(h.name)||!/^[0-9]{10}$/.test(h.registrationNo)||!Array.isArray(h.runs)||!h.runs.length)throw Error('馬名・登録番号・過去走を確認してください');
  if(seen.has(h.registrationNo))throw Error('追加データ内に同じ登録番号があります');seen.add(h.registrationNo);
  const dates=new Set();
  for(const r of h.runs){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||!r.raceName||!r.track||!Number.isFinite(Number(r.distance)))throw Error(`${h.name}の過去走が不正です`);
   if(dates.has(r.date))throw Error(`${h.name}に同日の過去走が重複しています`);dates.add(r.date);
   for(const k of fields)if(r[k]!=null&&typeof r[k]!=='string'&&typeof r[k]!=='number')throw Error('過去走の形式が不正です');
  }
 }
 return data;
}
function plan(data,horses,runs,at){
 validate(data);const writes=[],horseWrites=[],summary=[];
 for(const h of data.horses){
  const byReg=horses.filter(x=>x.registrationNo===h.registrationNo);
  const byName=horses.filter(x=>norm(x.nameKey||x.name)===norm(h.name));
  if(byReg.length>1||(!byReg.length&&byName.length>1))throw Error(`${h.name}に重複候補があります。先に確認してください`);
  const old=byReg[0]||byName[0];
  if(old?.registrationNo&&old.registrationNo!==h.registrationNo)throw Error(`${h.name}の登録番号が既存馬と異なります`);
  const key=old?.key||`reg:${h.registrationNo}`, existing=runs.filter(r=>r.horseKey===key);let added=0,updated=0;
  for(const r of h.runs){
   const same=existing.filter(x=>date(x.date)===r.date);
   if(same.length>1)throw Error(`${h.name}の${r.date}に重複走があります`);
   const prev=same[0];
   if(prev&&Number(prev.distance)!==Number(r.distance))throw Error(`${h.name}の${r.date}の距離が一致しません`);
   const merged={...prev,id:prev?.id||runId(key,r),horseKey:key};
   for(const f of fields)if(r[f]!=null&&String(r[f]).trim()!=='')merged[f]=r[f];
   const changed=!prev||fields.some(f=>String(merged[f]??'')!==String(prev[f]??''));
   if(changed){Object.assign(merged,{sourceFile:h.sourceUrl||data.id,importedAt:at});writes.push(merged);if(prev)updated++;else added++;}
  }
  if(!old||added||updated){horseWrites.push({...old,key,name:old?.nameCorrectedAt?old.name:h.name,nameKey:old?.nameCorrectedAt?old.nameKey:norm(h.name),registrationNo:h.registrationNo,lastImportedAt:at,firstRegisteredAt:old?.firstRegisteredAt||at,latestRunDate:[old?.latestRunDate||'',...h.runs.map(r=>r.date)].sort().at(-1),nameReviewNeeded:false,nameConfirmedAt:old?.nameConfirmedAt||at,sourceFile:h.sourceUrl||data.id,dbSchemaVersion:18});}
  summary.push({key,name:old?.nameCorrectedAt?old.name:h.name,kind:!old?'new':added||updated?'update':'same',addedRuns:added,existingUpdatedRuns:updated,beforeRuns:existing.length,afterRuns:existing.length+added,importedAt:at});
 }
 return {writes,horseWrites,summary};
}
const api={validate,plan};if(typeof module!=='undefined')module.exports=api;else root.KeibaBatchCore=api;
})(typeof window==='undefined'?this:window);
