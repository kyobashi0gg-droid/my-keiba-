/* CHARANIZE DB LAB: private MY KEIBA DB Lab (race-wide 33) join.
   This is race-level lap data, never a horse's individual sectional timing. */
(() => {
 'use strict';
 const venueCodes={東:'東京',京:'京都',阪:'阪神',名:'中京',中:'中山',新:'新潟',福:'福島',小:'小倉',函:'函館',札:'札幌'};
 const normName=x=>String(x||'').normalize('NFKC').replace(/[\s　]+/g,'');
 const normVenue=x=>{
  const t=String(x||'').normalize('NFKC');
  if(/^\d+[東京阪名中新福小函札]/.test(t))return venueCodes[t.match(/^\d+([東京阪名中新福小函札])/)[1]];
  const named=['東京','京都','阪神','中京','中山','新潟','福島','小倉','函館','札幌'];
  return named.find(v=>t.includes(v))||'';
 };
 const num=x=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x))?Number(x):null;
 const keyOf=r=>[r[0],r[2],r[3]].join('|');
 // Compact record: date, venue, surface, distance, race-wide lap33, pass, finish,
 // raceName, review, going, class, pace, agari.
 function parse(raw,prior){
  if(!raw||raw.format!=='my-keiba-db-lab-full-export'||!Array.isArray(raw.horses)||!Array.isArray(raw.runs))
   throw Error('MY KEIBA DB LABの全件書き出しJSONを選択してください。新聞PDFやCHARANIZEのJSONとは形式が異なります。');
  const names=new Map();
  for(const h of raw.horses)if(h.key&&h.name)names.set(h.key,normName(h.name));
  const out={version:1,source:'MY KEIBA DB LAB',importedAt:new Date().toISOString(),byHorse:{}};
  let imported=0,skipped=0,conflicts=0,duplicates=0;
  const table=new Map();
  const merge=(name,record)=>{
   if(!table.has(name))table.set(name,new Map());
   const m=table.get(name),k=keyOf(record),prev=m.get(k);
   if(!prev){m.set(k,record);return;}
   duplicates++;
   if(prev[4]!==record[4]){
    conflicts++;
    // Conflicting 33 values are not automatically reconciled: do not publish a guess.
    prev[4]=null;prev[7]=prev[7]||record[7];prev[8]='同一過去走の33に相違あり。原本確認が必要';
    m.set(k,prev);
    return;
   }
   // Prefer the record with a known course, but never overwrite a known 33.
   const preferred=record[1]&&!prev[1]?record:prev;
   for(let i=0;i<preferred.length;i++)if(preferred[i]==null||preferred[i]==='')preferred[i]=prev===preferred?record[i]:prev[i];
   m.set(k,preferred);
  };
  if(prior?.byHorse)for(const [name,entries] of Object.entries(prior.byHorse)){
   if(!Array.isArray(entries))continue;
   for(const e of entries)if(Array.isArray(e)&&e.length>=10)merge(normName(name),e.slice(0,13));
  }
  for(const r of raw.runs){
   const name=names.get(r.horseKey),lap=num(r.lap33),date=String(r.date||'');
   const surface=r.surface==='芝'?'芝':r.surface==='ダ'?'ダ':'';
   const distance=num(r.distance),venue=normVenue(r.track);
   if(!name||!date.match(/^\d{4}-\d{2}-\d{2}$/)||!surface||!distance||lap===null||Math.abs(lap)>25){skipped++;continue;}
   const rec=[date,venue,surface,distance,lap,String(r.positions||''),num(r.finish),String(r.raceName||'').slice(0,70),String(r.review||'').slice(0,110),String(r.going||''),String(r.raceClass||''),num(r.pace),num(r.agari)];
   merge(name,rec);imported++;
  }
  let total=0;for(const [name,m] of table) {
   const entries=[...m.values()].sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
   if(entries.length){out.byHorse[name]=entries;total+=entries.length;}
  }
  if(!imported||total<1)throw Error('有効な実33を読み取れませんでした。取り込み形式を確認してください。');
  out.stats={sourceRows:raw.runs.length,imported,skipped,total,horseCount:Object.keys(out.byHorse).length,duplicates,conflicts};
  return out;
 }
 // A matching date, surface and distance is mandatory. Course is validated when known.
 function match(name,run,pack){
  const list=pack?.byHorse?.[normName(name)];
  if(!list||!Array.isArray(run))return null;
  const day=String(run[0]||''),surface=run[3],distance=num(run[4]),venue=normVenue(run[1]);
  const candidates=list.filter(r=>r[0]===day&&r[2]===surface&&r[3]===distance&&(!venue||!r[1]||r[1]===venue));
  if(candidates.length!==1||candidates[0][4]===null)return null;
  return {data:candidates[0],courseConfirmed:!!venue&&!!candidates[0][1]};
 }
 window.CHARA_LAP_SYNC={parse,match,normVenue};
})();