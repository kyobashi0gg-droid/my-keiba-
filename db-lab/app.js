(() => {
  const DB_NAME='my-keiba-horse-db-v1', DB_VERSION=1, HORSES='horses', RUNS='runs';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/[\s　・･]/g,'').trim();
  const num=v=>{const m=String(v??'').replace(/,/g,'').match(/[+-]?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
  const round1=x=>Math.round(x*10)/10;
  const goingNorm=v=>{const s=String(v||'');if(/不良/.test(s))return'不良';if(/稍/.test(s))return'稍重';if(/重/.test(s))return'重';if(/良/.test(s))return'良';return''};
  const surfaceOf=v=>{const s=String(v||'');if(/ダ|ﾀﾞ|dirt/i.test(s))return'ダート';if(/芝|turf/i.test(s))return'芝';return''};
  const distanceOf=v=>{const n=num(v);return n!=null&&n>=800&&n<=4000?n:null};
  const bandOf=v=>{const d=distanceOf(v);if(d==null)return'';if(d<=1400)return'短距離';if(d<=2000)return'マイル〜中距離';return'中長距離'};

  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const reqP=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  async function listHorses(){const db=await openDb();try{return await reqP(db.transaction(HORSES,'readonly').objectStore(HORSES).getAll())}finally{db.close()}}
  async function getRuns(key){const db=await openDb();try{return await reqP(db.transaction(RUNS,'readonly').objectStore(RUNS).index('horseKey').getAll(key))}finally{db.close()}}

  function finishNo(v){const n=num(v);return n!=null&&n>0?n:null}
  function firstPosition(v){const m=String(v||'').match(/\d+/);return m?Number(m[0]):null}
  function marginNo(v){const n=num(v);return n==null?null:Math.abs(n)}
  function isGoodRun(run){
    const f=finishNo(run?.finish),m=marginNo(run?.margin);
    return (f!=null&&f<=3)||(m!=null&&m<=0.3);
  }
  function dateTs(v){const t=Date.parse(String(v||''));return Number.isFinite(t)?t:0}
  function raceLevel(run){
    const s=String(run?.raceName||'');
    if(/G\s*1|Ｇ１|GⅠ|Jpn\s*1/i.test(s))return 7;
    if(/G\s*2|Ｇ２|GⅡ|Jpn\s*2/i.test(s))return 6;
    if(/G\s*3|Ｇ３|GⅢ|Jpn\s*3/i.test(s))return 5;
    if(/リステッド|Listed|\bL\b|オープン|OP/i.test(s))return 4;
    if(/3勝|三勝/.test(s))return 3;
    if(/2勝|二勝/.test(s))return 2;
    if(/1勝|一勝/.test(s))return 1;
    if(/未勝利|新馬/.test(s))return 0;
    return null;
  }
  function levelName(n){return n==null?'能力帯不明':n>=7?'G1級':n===6?'G2級':n===5?'G3級':n===4?'OP級':n===3?'3勝級':n===2?'2勝級':n===1?'1勝級':'新馬・未勝利';}

  function excuseReason(run){
    if(isGoodRun(run))return'';
    const f=finishNo(run.finish);
    const review=String(run.review||'');
    const words=['不利','出遅','立遅','躓','つまず','挟ま','接触','前詰','詰ま','進路','壁','包ま','落鉄','故障','競走中止','度外視','大外回','外々','内詰','寄られ','被され'];
    const hit=words.find(w=>review.includes(w)); if(hit)return`総評:${hit}`;
    const pos=firstPosition(run.positions), fs=num(run.fieldSize); if(f==null||pos==null)return'';
    const front=fs!=null?Math.max(3,Math.ceil(fs*.25)):3, back=fs!=null?Math.max(6,Math.ceil(fs*.60)):7;
    if(review.includes('前潰れ')&&pos<=front)return'前潰れ×前方';
    if(review.includes('前残り')&&pos>=back)return'前残り×後方';
    return'';
  }
  function usableRuns(runs){return runs.filter(r=>!excuseReason(r))}
  function runCondition(run){return{surface:surfaceOf(run.surface||run.trackType||run.course),band:bandOf(run.distance),going:goingNorm(run.going)}}

  function summarize(runs){
    const valid=runs.map(run=>({run,lap:num(run.lap33),finish:finishNo(run.finish)})).filter(x=>x.lap!=null);
    const good=valid.filter(x=>isGoodRun(x.run)); const basis=good.length>=2?good:valid;
    if(!basis.length)return{zoneMin:null,zoneMax:null,goodCount:good.length,lapCount:valid.length};
    const vals=basis.map(x=>x.lap).sort((a,b)=>a-b);
    return{zoneMin:round1(vals[0]),zoneMax:round1(vals.at(-1)),goodCount:good.length,lapCount:valid.length};
  }
  function enough(runs,strong=true){const s=summarize(runs);return strong?s.lapCount>=3&&s.goodCount>=2:s.lapCount>=2}
  function selectRuns(runs,ctx){
    const usable=usableRuns(runs); const sameSurface=ctx.surface?usable.filter(r=>runCondition(r).surface===ctx.surface):[];
    const sameBand=ctx.band?sameSurface.filter(r=>runCondition(r).band===ctx.band):[];
    const sameGoingBand=ctx.going?sameBand.filter(r=>runCondition(r).going===ctx.going):[];
    const sameGoingSurface=ctx.going?sameSurface.filter(r=>runCondition(r).going===ctx.going):[];
    let selected=usable,basis='全体';
    if(ctx.going&&enough(sameGoingBand,true)){selected=sameGoingBand;basis=`${ctx.surface}・${ctx.band}・${ctx.going}`}
    else if(enough(sameBand,true)){selected=sameBand;basis=`${ctx.surface}・${ctx.band}`}
    else if(ctx.going&&enough(sameGoingSurface,true)){selected=sameGoingSurface;basis=`${ctx.surface}・${ctx.going}`}
    else if(enough(sameSurface,true)){selected=sameSurface;basis=ctx.surface}
    else if(ctx.going&&enough(sameGoingBand,false)){selected=sameGoingBand;basis=`${ctx.surface}・${ctx.band}・${ctx.going}（参考）`}
    else if(enough(sameBand,false)){selected=sameBand;basis=`${ctx.surface}・${ctx.band}（参考）`}
    else if(ctx.going&&enough(sameGoingSurface,false)){selected=sameGoingSurface;basis=`${ctx.surface}・${ctx.going}（参考）`}
    else if(enough(sameSurface,false)){selected=sameSurface;basis=`${ctx.surface}（参考）`}
    return{selected,basis,excluded:runs.length-usable.length};
  }

  function recentAbilityScope(runs){
    const valid=runs.filter(r=>num(r.lap33)!=null).sort((a,b)=>dateTs(b.date)-dateTs(a.date));
    const recent=valid.slice(0,10);
    const recent6=valid.slice(0,6);
    const levels=recent6.map(raceLevel).filter(x=>x!=null);
    const currentLevel=levels.length?Math.max(...levels):null;
    let floor=null;
    if(currentLevel!=null){ if(currentLevel>=3)floor=currentLevel-1; else if(currentLevel===2)floor=1; else floor=0; }
    const scoped=recent.filter(r=>{const lv=raceLevel(r);return floor==null||lv==null||lv>=floor});
    const excludedByClass=recent.length-scoped.length;
    return{runs:scoped,currentLevel,total:valid.length,floor,excludedByClass};
  }

  function performanceWeight(run,index,currentLevel){
    const f=finishNo(run.finish), m=marginNo(run.margin);
    let p=0;
    if(f===1)p=3.2; else if(f===2)p=2.6; else if(f===3)p=2.2; else if(f===4)p=1.35; else if(f===5)p=1.05;
    else if(m!=null&&m<=0.3)p=1.25; else if(m!=null&&m<=0.5)p=.9;
    if(!p)return 0;
    const recency=Math.max(.55,1-index*.06);
    const lv=raceLevel(run);
    let levelW=1;
    if(currentLevel!=null&&lv!=null){
      if(currentLevel>=3&&lv<=1)levelW=.18;
      else if(currentLevel>=2&&lv===0)levelW=.3;
      else if(lv<currentLevel-1)levelW=.55;
      else if(lv>=currentLevel)levelW=1.08;
    }
    return p*recency*levelW;
  }

  function densestBand(points,width=.9,minPoints=2){
    if(!points.length)return null;
    const pts=[...points].sort((a,b)=>a.lap-b.lap);
    let best=null;
    for(let i=0;i<pts.length;i++){
      const chosen=pts.filter(p=>p.lap>=pts[i].lap&&p.lap<=pts[i].lap+width);
      if(chosen.length<minPoints)continue;
      const score=chosen.reduce((s,p)=>s+p.weight,0);
      if(!best||score>best.score||(score===best.score&&chosen.length>best.points.length))best={score,points:chosen};
    }
    if(!best){
      const top=[...pts].sort((a,b)=>b.weight-a.weight).slice(0,Math.min(2,pts.length));
      if(top.length<1)return null;
      return{min:round1(Math.min(...top.map(p=>p.lap))),max:round1(Math.max(...top.map(p=>p.lap))),count:top.length};
    }
    return{min:round1(Math.min(...best.points.map(p=>p.lap))),max:round1(Math.max(...best.points.map(p=>p.lap))),count:best.points.length};
  }

  function coreAnalysis(runs){
    const scope=recentAbilityScope(runs);
    const points=[];
    scope.runs.forEach((r,i)=>{const lap=num(r.lap33),w=performanceWeight(r,i,scope.currentLevel);if(lap!=null&&w>0)points.push({lap,weight:w,run:r})});
    const strong=points.filter(p=>isGoodRun(p.run));
    const source=strong.length>=2?strong:points;
    const core=densestBand(source,.9,Math.min(2,source.length));
    const allGoodVals=runs.filter(r=>num(r.lap33)!=null&&isGoodRun(r)).map(r=>num(r.lap33));
    const allGood=allGoodVals.length?{min:round1(Math.min(...allGoodVals)),max:round1(Math.max(...allGoodVals))}:null;
    return{scope,points,strong,core,allGood};
  }

  function gapToBand(avg,band){
    if(avg==null||!band)return null;
    if(avg>=band.min&&avg<=band.max)return 0;
    return round1(avg<band.min?band.min-avg:avg-band.max);
  }
  function baseJudge(avg,band){
    if(avg==null||!band)return{mark:'—',label:'判定不可',gap:null,cls:'mid'};
    const gap=gapToBand(avg,band);
    if(gap===0)return{mark:'◎',label:'コア一致',gap:0,cls:'perfect'};
    if(gap<=.5)return{mark:'○',label:'好走可能',gap,cls:'possible'};
    if(gap>=1.0)return{mark:'逆◎',label:'全く逆',gap,cls:'reverse'};
    return{mark:'—',label:'中間',gap,cls:'mid'};
  }

  function avgFinish(runs){const vals=runs.map(r=>finishNo(r.finish)).filter(x=>x!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
  function hiddenSignal(avg,analysis){
    const recent=analysis.scope.runs;
    const recentWins=recent.slice(0,6).filter(r=>finishNo(r.finish)===1).length;
    if(recentWins>0)return null;
    const candidates=recent.filter(r=>{const f=finishNo(r.finish),m=marginNo(r.margin);return num(r.lap33)!=null&&((f!=null&&f>=3&&f<=5)||(m!=null&&m<=.5))});
    if(candidates.length<2)return null;
    const pts=candidates.map(r=>({lap:num(r.lap33),weight:1.2,run:r}));
    const band=densestBand(pts,.8,2); if(!band)return null;
    const inside=recent.filter(r=>{const l=num(r.lap33);return l!=null&&l>=band.min-.2&&l<=band.max+.2});
    const outside=recent.filter(r=>{const l=num(r.lap33);return l!=null&&(l<band.min-.2||l>band.max+.2)});
    const ai=avgFinish(inside),ao=avgFinish(outside),gap=gapToBand(avg,band);
    const closeCount=candidates.filter(r=>{const m=marginNo(r.margin);return m!=null&&m<=.5}).length;
    if(gap!=null&&gap<=.3&&inside.length>=2&&((ai!=null&&ao!=null&&ao-ai>=1.5)||closeCount>=2)){
      return{code:'hidden',mark:'▲',label:'隠れ適合',band,detail:ai!=null&&ao!=null?`適合時平均${round1(ai)}着 / 他${round1(ao)}着`:`3〜5着・僅差が集中`};
    }
    return null;
  }

  function dependencySignal(avg,analysis){
    const band=analysis.core; if(!band)return null;
    const recent=analysis.scope.runs;
    const inside=recent.filter(r=>{const l=num(r.lap33);return l!=null&&l>=band.min-.35&&l<=band.max+.35});
    const outside=recent.filter(r=>{const l=num(r.lap33);return l!=null&&(l<band.min-.35||l>band.max+.35)});
    if(inside.length<2||outside.length<2)return null;
    const ai=avgFinish(inside),ao=avgFinish(outside),gap=gapToBand(avg,band);
    if(ai==null||ao==null||gap==null)return null;
    if(ao-ai>=1.5&&gap>.5)return{code:'dependency',mark:'⚠',label:'33依存・今回はズレ',detail:`コア時平均${round1(ai)}着 / 他${round1(ao)}着`};
    return null;
  }

  function abilitySignal(analysis){
    const strongLaps=analysis.strong.map(p=>p.lap);
    if(strongLaps.length<4)return null;
    const span=Math.max(...strongLaps)-Math.min(...strongLaps);
    if(span<2.0)return null;
    const buckets=new Set(strongLaps.map(v=>Math.floor(v/.8)));
    if(buckets.size<3)return null;
    return{code:'ability',mark:'◇',label:'能力型',detail:`広い33で好走（幅${round1(span)}）`};
  }

  function chooseSignal(avg,analysis){
    const hidden=hiddenSignal(avg,analysis); if(hidden)return hidden;
    const ability=abilitySignal(analysis);
    const dep=dependencySignal(avg,analysis); if(dep&&!ability)return dep;
    return ability;
  }
  function zoneTextBand(b){return!b?'—':b.min===b.max?`${b.min}`:`${b.min}〜${b.max}`}
  function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}

  let last=[];
  async function evaluate(){
    const names=$('horses').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const ctx={surface:$('surface').value,band:bandOf($('distance').value),going:$('going').value};
    const inputAvg=num($('avg33').value),pdfAvg=num(window.MyKeibaDbLabPdfRace?.avg33),avg=inputAvg!=null?inputAvg:pdfAvg;
    if(inputAvg==null&&pdfAvg!=null)$('avg33').value=String(pdfAvg);
    const dbHorses=await listHorses(),byName=new Map(dbHorses.map(h=>[norm(h.name),h])),out=[];
    for(const [i,name] of names.entries()){
      const h=byName.get(norm(name)); if(!h){out.push({no:i+1,name,missing:true});continue}
      const runs=await getRuns(h.key),sel=selectRuns(runs,ctx),analysis=coreAnalysis(sel.selected),core=analysis.core;
      const judge=baseJudge(avg,core),signal=chooseSignal(avg,analysis);
      out.push({no:i+1,name:h.name,missing:false,basis:sel.basis,judge,signal,analysis,excluded:sel.excluded});
      if(i%5===4)await new Promise(r=>setTimeout(r,0));
    }
    last=out;render(out);return out;
  }

  function displayBadge(x){
    if(x.signal?.code==='hidden')return{mark:x.signal.mark,label:x.signal.label,cls:'hidden'};
    if(x.signal?.code==='dependency')return{mark:x.signal.mark,label:x.signal.label,cls:'warn'};
    if(x.signal?.code==='ability')return{mark:x.signal.mark,label:x.signal.label,cls:'ability'};
    return x.judge;
  }
  function render(out){
    $('resultCard').hidden=false;$('count').textContent=`${out.filter(x=>!x.missing).length}/${out.length}頭`;
    $('results').innerHTML=out.map(x=>{
      if(x.missing)return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span class="pill p-mid">DBなし</span></div><small class="missing">登録DBに一致馬がありません。</small></div>`;
      const d=displayBadge(x),pill=d.cls==='perfect'?'p-perfect':d.cls==='possible'?'p-possible':d.cls==='reverse'?'p-reverse':d.cls==='hidden'?'p-hidden':d.cls==='warn'?'p-warn':d.cls==='ability'?'p-ability':'p-mid';
      const gap=x.judge.gap==null?'':` / 差${x.judge.gap}`;
      const a=x.analysis,core=zoneTextBand(a.core),all=zoneTextBand(a.allGood),lv=levelName(a.scope.currentLevel);
      const sig=x.signal?`<div class="db33-signal">${esc(x.signal.detail||'')}</div>`:'';
      return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span class="pill ${pill}">${esc(d.mark)} ${esc(d.label)}</span></div><div class="zone">${esc(x.basis)} / コア33 ${esc(core)}</div><small>${esc(lv)}優先 / 近年対象${a.scope.runs.length}走 / 全好走33 ${esc(all)}${gap}${x.excluded?` / 度外視${x.excluded}走`:''}</small>${sig}</div>`;
    }).join('');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function resultText(){
    const head=`MYKEIBA_DB_RESULT_V2\n${$('track').value.trim()} ${$('raceNo').value.trim()}R|${$('raceName').value.trim()}|${$('surface').value}|${$('distance').value}|${$('going').value||'未設定'}|${$('avg33').value}`;
    const rows=last.filter(x=>!x.missing).map(x=>{const d=displayBadge(x),a=x.analysis;return `${x.no}|${x.name}|${d.mark}|${d.label}|${zoneTextBand(a.core)}|${x.basis}|${x.judge.gap??0}|${x.excluded||0}|${x.signal?.code||''}|${x.signal?.detail||''}|${zoneTextBand(a.allGood)}|${levelName(a.scope.currentLevel)}`});
    return `${head}\n${rows.join('\n')}`;
  }

  const style=document.createElement('style');
  style.textContent=`.p-hidden{background:#e8e0ff;color:#6542a0}.p-warn{background:#ffe3dc;color:#a44534}.p-ability{background:#e3edf8;color:#365e87}.db33-signal{margin-top:2px;padding:7px 9px;border-radius:10px;background:#f6f8f7;color:#536c60;font-size:10px;font-weight:800}.db33-advanced-note{margin-top:8px;padding:9px 11px;border-radius:12px;background:#f6f8f7;color:#607168;font-size:10px;line-height:1.6}`;
  document.head.appendChild(style);
  const legend=document.querySelector('.legend');
  if(legend&&!document.querySelector('#db33AdvancedLegend')){
    const box=document.createElement('div');box.id='db33AdvancedLegend';box.className='db33-advanced-note';box.innerHTML='<b>追加判定：</b> ▲ 隠れ適合＝3〜5着・僅差が特定33に集中　/　⚠ 33依存・今回はズレ＝コア33時だけ成績が明確に良い　/　◇ 能力型＝広い33で好走';legend.insertAdjacentElement('afterend',box);
  }

  $('loadDb').onclick=async()=>{try{const hs=await listHorses();$('dbStatus').textContent=`登録DB ${hs.length}頭。出走馬欄に馬名を1行ずつ入力してください。`}catch(e){$('dbStatus').textContent='DBを開けませんでした。MY KEIBA LABと同じブラウザで開いてください。'}};
  $('judge').onclick=async()=>{try{$('dbStatus').textContent='評価中…';await evaluate();$('dbStatus').textContent='評価完了（コア33・隠れ適合・33依存を反映）'}catch(e){console.error(e);$('dbStatus').textContent='評価中にエラーが発生しました。'}};
  $('saveResult').onclick=()=>{if(!last.length)return;localStorage.setItem('my-keiba-db-result-v2',resultText());localStorage.setItem('my-keiba-db-result-v2-at',new Date().toISOString());$('saveStatus').textContent='MY KEIBA LAB取込用としてこのブラウザに保存しました。'};
  $('copyResult').onclick=async()=>{if(!last.length)return;try{await navigator.clipboard.writeText(resultText());$('saveStatus').textContent='結果をコピーしました。'}catch{$('saveStatus').textContent='コピーできませんでした。'}};
  $('loadDb').click();
})();