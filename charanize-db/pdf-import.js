/* CHARANIZE DB Lab - local-only PDF parser, adapted from charanize/index.html.
   Only index data; NEVER publish user newspaper content or auto-overwrite conflicts. */

function charaCompact(s){return String(s||'').normalize('NFKC').replace(/\s+/g,'')}
// Android PDF.js may insert U+0001 between a venue name and its month/day.
// Clean date headings only; leave all horse/index parsing exactly as verified in v15.
function charaDateText(s){return charaCompact(s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\u2060\ufeff]/g,'')}
function charaNormalize(s){return String(s||'').normalize('NFKC').replace(/[\u2007\u00a0]/g,' ').replace(/\s+/g,' ').trim()}
function charaReadValues(t){
 const out={};
 for(const [symbol,key] of [['逃','nige'],['先','sen'],['追','tsui'],['脚','ashi'],['ギ','gear']]){
  const m=t.match(new RegExp(symbol+'\\s*([SABCDEFGZ/])\\s*(-?\\d+(?:\\.\\d+)?|/)?'));
  if(m)out[key]={rank:m[1],value:m[2]!=null&&m[2]!=='/'?Number(m[2]):null};
 }
 return out;
}
function charaBuildRows(items,height){
 const tokens=[];
 for(const it of items){
  const text=String(it.str||'');if(!text.trim())continue;
  const x=Number(it.transform?.[4]);const baseline=Number(it.transform?.[5]);
  if(!Number.isFinite(x)||!Number.isFinite(baseline)||x>570)continue;
  tokens.push({x,y:height-baseline,text,col:x<292?'L':'R'});
 }
 tokens.sort((a,b)=>a.y-b.y||a.x-b.x);
 const groups=[];
 for(const t of tokens){
  let g=null,dist=Infinity;
  for(let i=groups.length-1;i>=0;i--){
   const v=groups[i];if(v.col!==t.col)continue;
   const d=Math.abs(v.y-t.y);
   if(d<=4.5&&d<dist){g=v;dist=d}
   if(v.y<t.y-5)break;
  }
  if(!g){g={col:t.col,y:t.y,parts:[]};groups.push(g)}
  const n=g.parts.length;g.y=(g.y*n+t.y)/(n+1);g.parts.push(t);
 }
 for(const g of groups){g.parts.sort((a,b)=>a.x-b.x);g.text=charaNormalize(g.parts.map(t=>t.text).join(''));g.x=g.parts[0]?.x??0}
 return groups.sort((a,b)=>a.y-b.y||a.x-b.x);
}
function charaParsePdfPages(pages,options={}){
 const races=[];let cur=null,horse=null,date='',venue='',unmatched=0,headers=0,firstPageText='',textCount=0;
 for(let pg=1;pg<=pages.length;pg++){
  const p=pages[pg-1],rows=charaBuildRows(p.items,p.height),left=rows.filter(x=>x.col==='L'),right=rows.filter(x=>x.col==='R'&&/逃/.test(x.text)&&/脚/.test(x.text));
  // Recover race-day label even when PDF.js reports an invisible control
  // character or splits the venue and date into adjacent text rows.
  const topHeader=charaDateText(left.slice(0,8).filter(x=>x.y<115).map(x=>x.text).join(''));
  const headerDate=topHeader.match(/(新潟|東京|京都|阪神|中山|中京|小倉|札幌|函館|福島)(\d{1,2})\/(\d{1,2})/);
  if(headerDate){venue=headerDate[1];date=`${options.year || 2026}-${headerDate[2].padStart(2,'0')}-${headerDate[3].padStart(2,'0')}`;}

  // PDF.js uses independent text item baselines for ranks/figures, and may put
  // 逃・先・追・脚・ギ on separate lines. Read the raw right-half items in a window
  // around each left-hand past-performance entry, sorting by *x*, not baseline.
  const rawRight=(p.items||[]).map(it=>({x:Number(it.transform?.[4]),y:p.height-Number(it.transform?.[5]),str:String(it.str||'')}))
   .filter(it=>it.str.trim()&&it.x>=294&&it.x<=570&&Number.isFinite(it.y));
  if(pg<=2){firstPageText+=' '+rows.map(x=>x.text).join(' ').slice(0,20000);textCount+=rows.reduce((n,r)=>n+r.text.length,0)}
  const used=new Set();
  for(let i=0;i<left.length;i++){
   const l=left[i],t=l.text;
   const compact=charaCompact(t);const dt=charaDateText(t).match(/(新潟|東京|京都|阪神|中山|中京|小倉|札幌|函館|福島)(\d{1,2})\/(\d{1,2})/);
   if(dt){venue=dt[1];date=`${options.year || 2026}-${dt[2].padStart(2,'0')}-${dt[3].padStart(2,'0')}`}
   const rh=compact.match(/(新潟|東京|京都|阪神|中山|中京|小倉|札幌|函館|福島)(\d{1,2})R(.*)/i);
   if(rh){
    venue=rh[1];cur={id:`${date}|${venue}|${Number(rh[2])}`,date,venue,raceNo:Number(rh[2]),name:rh[3]||'',condition:'',horses:[],sourcePages:[]};races.push(cur);horse=null;headers++;
    // Course may occupy separate PDF.js items or baselines: reconstruct it
    // from all left-hand glyphs directly beneath the race title.
    const nextRows=left.filter(n=>n.y>l.y+2&&n.y<l.y+56).slice(0,9);
    const rawHeader=(p.items||[]).map(it=>({x:Number(it.transform?.[4]),y:p.height-Number(it.transform?.[5]),str:String(it.str||'')}))
       .filter(it=>it.str.trim()&&it.x<205&&it.y>l.y+2&&it.y<l.y+51)
       .sort((a,b)=>a.y-b.y||a.x-b.x).map(z=>z.str).join('');
    const headerText=charaCompact(nextRows.map(z=>z.text).join(' ')+rawHeader);
    const cm=headerText.match(/(芝|ダ|障)(\d{3,4})(?:m|M)?/);
    if(cm)cur.condition=cm[1]+cm[2]+'m';
   }
   const course=compact.match(/^(芝|ダ|障)(\d{3,4})(?:m|M)?/);
   if(course&&cur)cur.condition=course[1]+course[2]+'m';
   // Short player-card headings may be split across 2 neighboring text baselines.
   const candidate=[t,...left.slice(i+1,i+3).filter(n=>n.y-l.y<10&&!/^(前走|[2-5]走前|未勝利|新馬|芝\d|ダ\d)/.test(n.text)).map(n=>n.text)].join(' ');
   const cc=charaCompact(candidate);const hmatch=cc.match(/(\d{1,2})\(([牡牝セ])\)/);
   if(hmatch&&cur&&!/^(前走|[2-5]走前)/.test(t)){
    const pre=cc.slice(0,hmatch.index).trim();
    // Frame digit (1..8), then horse number (1..18); PDF.js may return every character separately.
    // The header's two number cells remain unambiguous even after whitespace is removed.
    const numbered=pre.match(/^([1-8])(1[0-8]|[1-9])(?:B)?(.+)$/);
    const noNumber=pre.match(/^(?:仮)?未(?:B)?(.+)$/);
    const number=numbered?String(Number(numbered[2])):noNumber?'未':null;
    const name=numbered?.[3]?.trim()||noNumber?.[1]?.trim();
    if(name&&name.length<=35&&!/^(▶|逃げ|先行|過去|展開|新潟|東京|京都|阪神|中山|中京|小倉|札幌|函館|福島)/.test(name)){
     const already=cur.horses.some(z=>z.page===pg&&z.name===name);
     if(!already){const rider=cc.slice(hmatch.index+hmatch[0].length).trim();horse={number,name,age:Number(hmatch[1]),sex:hmatch[2],rider,flags:['延長','短縮','乗替','斤量増','斤量減'].filter(x=>candidate.includes(x)),runs:[],page:pg};cur.horses.push(horse)}
    }
   }
   const rm=compact.match(/^(前走|[2-5]走前)(\d{6})_([^\s]+)/);
   if(rm&&cur){
    if(!horse){unmatched++;continue}
    const seq=rm[1]==='前走'?1:Number(rm[1][0]);
    const dr=compact.match(/(\d{6})_([東新京阪中小札函名福]\d+R)_((?:芝|ダ|障)\d{2})([良稍重不])/);
    const fm=compact.match(/(\d+|止|除|中)着\(([-+\d.]+|----)\)\/(\d+)頭/);
    // Build the five-index reading from raw PDF.js tokens in the right column.
    // The index baseline is typically 5–8pt below the race text baseline.
    // Avoid relying on all five labels having the same PDF.js baseline.
    let candidates=[];
    for(const shift of [7,5,0,10]){
     const group=rawRight.filter(q=>Math.abs(q.y-(l.y+shift))<=10.5).sort((a,b)=>a.x-b.x);
     const raw=charaCompact(group.map(q=>q.str).join(''));
     const ixCandidate=charaReadValues(raw);
     const recognized=['nige','sen','ashi','gear'].filter(k=>ixCandidate[k]&&ixCandidate[k].rank).length;
     const numeric=Object.values(ixCandidate).filter(z=>Number.isFinite(z?.value)).length;
     candidates.push({ix:ixCandidate,recognized,numeric,raw,shift});
    }
    candidates.sort((a,b)=>b.recognized-a.recognized||b.numeric-a.numeric);
    let ix=candidates[0].recognized>=3?candidates[0].ix:{};
    if(Object.keys(ix).length<3){
      const pair=right.map((r,j)=>({r,j,dist:Math.abs(r.y-l.y)})).filter(x=>x.dist<=20&&!used.has(x.j)).sort((a,b)=>a.dist-b.dist)[0];
      if(pair){used.add(pair.j);ix=charaReadValues(charaCompact(pair.r.text))}
    }
    horse.runs.push({seq,raw:t,summary:'',date:dr?.[1]||null,where:dr?.[2]||null,surfaceDistance:dr?.[3]||null,going:dr?.[4]||null,finish:fm&&/^\d+$/.test(fm[1])?Number(fm[1]):null,margin:fm&&fm[2]!=='----'?Number(fm[2]):null,passing:'',final3f:null,indices:ix});
   }
   if(horse?.runs?.length&&!rm&&!hmatch&&!rh&&/通[\d-]+|上\d{1,2}\.\d/.test(t)&&t.length<150){
    const run=horse.runs[horse.runs.length-1];if(!run.summary){run.summary=t;run.passing=compact.match(/通([\d-]+)/)?.[1]||'';run.final3f=Number(compact.match(/上(\d{1,2}\.\d)/)?.[1])||null}
   }
   if(cur&&!cur.sourcePages.includes(pg))cur.sourcePages.push(pg);
  }
  if(options.onProgress&&pg%8===0)options.onProgress(pg,pages.length);
 }
 let count=0,runs=0,indexed=0,duplicates=[];
 for(const r of races){count+=r.horses.length;for(const h of r.horses){runs+=h.runs.length;indexed+=h.runs.filter(v=>Object.values(v.indices||{}).some(ix=>Number.isFinite(ix?.value))).length}
  const names=r.horses.map(h=>h.name);if(new Set(names).size!==names.length)duplicates.push(r.id);
 }
 return {races,count,runs,indexed,unmatched,headers,duplicates,textCount,preview:firstPageText.slice(0,1000)};
}

async function parsePDF(file){
 setStatus('PDF解析ライブラリを準備中…');
 let pdfjs;
 try{
  pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 }catch(error){throw Error('PDF解析ライブラリを取得できません。ネット接続を確認してください。解析済みJSONの取り込みは利用できます。')}
 const bytes=new Uint8Array(await file.arrayBuffer());
 const pdf=await pdfjs.getDocument({data:bytes}).promise;
 const pages=[];
 for(let pg=1;pg<=pdf.numPages;pg++){
  if(pg%4===1)setStatus(`PDFから文字・座標を読取中… ${pg}/${pdf.numPages}ページ`);
  const page=await pdf.getPage(pg),text=await page.getTextContent();
  // Copy only the coordinates and strings required by the parser (mobile memory use).
  pages.push({height:page.view[3],items:text.items.filter(x=>x.str&&x.transform).map(x=>({str:x.str,transform:[0,0,0,0,x.transform[4],x.transform[5]]}))});
  if(pg%8===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 setStatus('馬名・過去走・5指数を照合中…');
 const matchedYear=String(file.name||'').match(/(?:^|[^0-9])(?:20)?(\\d{2})[01]\\d[0-3]\\d(?=$|[^0-9])/);
 const year=matchedYear ? 2000+Number(matchedYear[1]) : new Date().getFullYear();
 const parsed=charaParsePdfPages(pages,{year});
 if(!/CHARANIZE|脚力ポイント|逃げ・先行指数/.test(parsed.preview)){
  throw Error('CHARANIZE指数新聞ではないPDFの可能性があります。「指数新聞 … .pdf」を選んでください。');
 }
 if(parsed.races.length===0||parsed.count===0||parsed.runs===0||parsed.indexed===0){
  throw Error(`馬名・指数の対応付けに失敗しました（${pdf.numPages}ページ／${parsed.races.length}レース／${parsed.count}頭／${parsed.runs}走）。PDF形式の確認が必要です。`);
 }
 const missingRaces=parsed.races.filter(r=>!r.horses.length||!r.date||!r.condition);
 if(missingRaces.length||parsed.duplicates.length||parsed.unmatched>Math.max(2,Math.floor(parsed.runs*0.01))||parsed.indexed<Math.floor(parsed.runs*0.75)){
  // Keep a compact, local-only diagnostic for reproducing real PDF.js
  // coordinates. No full pages and no PDF contents leave the device.
  const sample=[];
  for(const pg of [0,1]){
    const page=pages[pg];if(!page)continue;
    sample.push({page:pg+1,height:page.height,items:page.items.slice(0,2500).map(t=>({s:t.str,x:Math.round(t.transform[4]*10)/10,y:Math.round(t.transform[5]*10)/10}))});
  }
  window.__charaImportDiagnostic={version:16,counts:{races:parsed.races.length,horses:parsed.count,runs:parsed.runs,indexed:parsed.indexed,unmatched:parsed.unmatched,missingRaces:missingRaces.length},raceExamples:parsed.races.slice(0,3).map(r=>({id:r.id,condition:r.condition,horses:r.horses.length,firstRunIndices:r.horses[0]?.runs[0]?.indices})),sample};
  throw Error(`部分的な解析になりました。誤集計を防ぐため反映を中止しました（${parsed.races.length}レース・${parsed.count}頭・${parsed.runs}走・指数${parsed.indexed}走／未対応過去走${parsed.unmatched}件／未完成レース${missingRaces.length}件）。画面下部の「診断データ保存」で原因を確認できます。`);
 }
 return parsed;
}



const PDF_SOURCE_VERSION = '2026-11-07';
let onStatus = () => {};
function setStatus(s) { onStatus(String(s || '')); }
const venueByShort = {東:'東京',新:'新潟',京:'京都',阪:'阪神',中:'中山',名:'中京',小:'小倉',札:'札幌',函:'函館',福:'福島'};
const indexOrder = ['nige','sen','tsui','ashi','gear'];
function sixDigitDate(str) {
  const m = String(str || '').match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return '';
  return '20' + m[1] + '-' + m[2] + '-' + m[3];
}
function runFromPaper(z) {
  const course = String(z.where || '').match(/^([東新京阪中名小札函福])(\d{1,2})R$/);
  const surface = String(z.surfaceDistance || '').match(/^([芝ダ障])(\d{2})$/);
  if (!z.date || !course || !surface) return null;
  const day = sixDigitDate(z.date), venue = venueByShort[course[1]];
  if (!day || !venue) return null;
  const metrics = indexOrder.map(k => {
    const n = z.indices && z.indices[k] ? z.indices[k].value : null;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  });
  if (!metrics.some(Number.isFinite)) return null;
  return [day,venue,Number(course[2]),surface[1],Number(surface[2])*100,
    String(z.going || ''),Number.isFinite(z.finish)?z.finish:null,
    z.passing || '',Number.isFinite(z.final3f)?z.final3f:null,
    metrics,String((z.summary || '').split(/[\s\d]{2,}/)[0] || '').slice(0,25),1,null];
}
function runKey(z) {
  return [String(z[0]||''),String(z[1]||''),String(z[2]||''),String(z[3]||''),String(z[4]||''),String(z[5]||'')].join('|');
}
function clonePack(pack) {
  return {format:pack.format || 'CHARANIZE_WEB_PRIVATE_PACK_V1',
    horses:{...pack.horses},
    meta:{...(pack.meta||{})},
    races:{...(pack.races||{})},
    race_meta:{...(pack.race_meta||{})}};
}
export async function preparePdfImport(file,pack,progress) {
  if (!file || !/\.pdf$/i.test(file.name)) throw Error('CHARANIZE指数新聞のPDFファイルを選択してください。');
  if (file.size > 60*1024*1024) throw Error('60MB以下のPDFを選んでください。');
  if (!pack || !pack.horses || !pack.races) throw Error('先に初期JSONの読み込みが必要です。');
  onStatus = typeof progress === 'function' ? progress : () => {};
  const parsed = await parsePDF(file); // same coordinate parser as CHARANIZE LAB
  const next=clonePack(pack);
  const summary={file:file.name,pages:parsed.headers,horses:parsed.count,
    pastRuns:parsed.runs,indexedRuns:parsed.indexed,addedRuns:0,filledValues:0,
    existingUnchanged:0,conflicts:0,conflictSamples:[],newHorses:0,newRaces:0,skipped:0};
  for (const race of parsed.races) {
    if (!race.date || !race.venue || !Number.isInteger(race.raceNo)) continue;
    const key=[race.date,race.venue,race.raceNo].join('|');
    if (!next.races[key]) {
      const course=String(race.condition||'').match(/^([芝ダ障])(\d{3,4})m$/);
      const runners=race.horses.filter(h=>/^\d+$/.test(h.number)).map(h=>[Number(h.number),h.name]);
      if (course && runners.length) {
        next.races[key]=[String(race.name||'').slice(0,36),course[1],Number(course[2]),runners];
        summary.newRaces++;
      }
    }
    for (const h of race.horses) {
      const name=String(h.name||'').trim();
      if(!name)continue;
      const prior=next.horses[name];
      const old=prior ? prior[2]||[] : [];
      const rows=old.map(z=>Array.isArray(z)?z.slice():z);
      const byKey=new Map(rows.map((z,i)=>[runKey(z),i]));
      let changes=0;
      for (const z of h.runs) {
        const incoming=runFromPaper(z);
        if(!incoming){summary.skipped++;continue;}
        const key=runKey(incoming),idx=byKey.get(key);
        if(idx===undefined) {
          rows.push(incoming);byKey.set(key,rows.length-1);summary.addedRuns++;changes++;
          continue;
        }
        const existing=rows[idx],nextIx=incoming[9]||[],oldIx=existing[9]||[];
        let filled=0,conflict=false;
        for(let j=0;j<5;j++) {
          const n=nextIx[j],o=oldIx[j];
          if(!Number.isFinite(n))continue;
          if(!Number.isFinite(o)){oldIx[j]=n;filled++;continue;}
          if(Math.abs(Number(o)-n)>0.051)conflict=true;
        }
        if(!Number.isFinite(existing[6])&&Number.isFinite(incoming[6])){existing[6]=incoming[6];filled++;}
        if(!existing[7]&&incoming[7]){existing[7]=incoming[7];filled++;}
        if(!Number.isFinite(Number(existing[8]))&&Number.isFinite(incoming[8])){existing[8]=incoming[8];filled++;}
        existing[9]=oldIx;
        if(conflict) {
          summary.conflicts++;
          if(summary.conflictSamples.length<12)summary.conflictSamples.push(name+' '+incoming[0]+' '+incoming[1]+incoming[2]+'R');
        }
        if(filled){summary.filledValues+=filled;changes++;}
        else if(!conflict)summary.existingUnchanged++;
      }
      if (!prior && !rows.length) continue;
      if (!prior){summary.newHorses++;changes++;}
      if (changes) {
        rows.sort((a,b)=>String(b[0]).localeCompare(String(a[0]))||Number(b[2])-Number(a[2]));
        next.horses[name]=[h.sex||prior?.[0]||'',h.age||prior?.[1]||'',rows.slice(0,10)];
      }
    }
  }
  if (summary.addedRuns===0 && summary.filledValues===0 && summary.newRaces===0)
    onStatus('このPDFから追加できる新規指数・出走表はありません。');
  const all=Object.values(next.horses);
  next.meta.horses=all.length;
  next.meta.runs=all.reduce((n,h)=>n+(h[2]||[]).length,0);
  const dates=parsed.races.map(x=>x.date).filter(Boolean).sort();
  if(dates.length && (!next.meta.as_of || dates[dates.length-1]>next.meta.as_of))next.meta.as_of=dates[dates.length-1];
  const sourceId=file.name+' ('+file.size+' bytes)';
  const priorFiles=Array.isArray(next.meta.local_pdf_imports)?next.meta.local_pdf_imports:[];
  if(!priorFiles.includes(sourceId)) {
    next.meta.local_pdf_imports=[...priorFiles,sourceId].slice(-30);
    next.meta.source_count=(Number(next.meta.source_count)||0)+1;
  }
  next.meta.local_import_software='CHARANIZE PDF importer '+PDF_SOURCE_VERSION;
  // Existing indexed values always take precedence on conflict. Never send PDF contents to GitHub.
  return {pack:next,summary};
}
