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
    const f=finishNo(run?.finish);
    return f!=null&&f<=3;
  }
  function dateTs(v){const t=Date.parse(String(v||''));return Number.isFinite(t)?t:0}
  function levelFromText(s){
    s=String(s||'');
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
  function runClassText(run){return `${run?.raceClass||run?.className||run?.grade||''} ${run?.raceName||''}`}
  function raceLevel(run){return levelFromText(runClassText(run))}
  function isNewcomerRun(run){return /新馬/.test(runClassText(run))}
  function isMaidenRun(run){return /未勝利/.test(runClassText(run))}
  function levelName(n){return n==null?'能力帯不明':n>=7?'G1級':n===6?'G2級':n===5?'G3級':n===4?'OP級':n===3?'3勝級':n===2?'2勝級':n===1?'1勝級':'新馬・未勝利';}

  function targetRaceInfo(){
    const pdf=window.MyKeibaDbLabPdfRace||{};
    const raceName=$('raceName')?.value||'';
    const manualClass=$('raceClass')?.value||'';
    const classText=manualClass||pdf.raceClass||raceName;
    const level=levelFromText(classText);
    let age=Number(pdf.ageClass)||null;
    if(age!==2&&age!==3){
      const s=String(raceName);
      if(/2歳(?!以上)/.test(s))age=2;
      else if(/3歳(?!以上)/.test(s))age=3;
      else age=null;
    }
    return{level,age,classText};
  }

  function targetClassRule(info){
    const level=info?.level,age=info?.age;
    if(age===2||age===3){
      if(level===7)return{label:`${age}歳G1：新馬・未勝利除外`,keep:run=>!isNewcomerRun(run)&&!isMaidenRun(run)};
      return{label:`${age}歳戦：下級クラス除外なし`,keep:()=>true};
    }
    // クラスが判別できない過去走は、上位クラス評価へ混ぜない。
    // 「不明だから残す」と下級戦が紛れた場合にコア33を歪めるため、厳格に除外する。
    if(level===7)return{label:'G1：OPクラス以上',keep:run=>{const lv=raceLevel(run);return lv!=null&&lv>=4}};
    if(level===6||level===5)return{label:'G2/G3：3勝クラス以上',keep:run=>{const lv=raceLevel(run);return lv!=null&&lv>=3}};
    if(level===4)return{label:'OP：2勝クラス以上',keep:run=>{const lv=raceLevel(run);return lv!=null&&lv>=2}};
    if(level===3)return{label:'3勝：1勝クラス以上',keep:run=>{const lv=raceLevel(run);return lv!=null&&lv>=1}};
    if(level===2)return{label:'2勝：新馬戦のみ除外',keep:run=>!isNewcomerRun(run)};
    return{label:'クラス除外なし',keep:()=>true};
  }

  function applyTargetClassRule(runs,info){
    const rule=targetClassRule(info);
    const kept=[],excluded=[];
    for(const run of runs||[]){(rule.keep(run)?kept:excluded).push(run)}
    return{runs:kept,excluded,rule:rule.label};
  }

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

  function recentAbilityScope(runs,currentLevelOverride=null){
    const valid=runs.filter(r=>num(r.lap33)!=null).sort((a,b)=>dateTs(b.date)-dateTs(a.date));
    const recent=valid.slice(0,10);
    const recent6=valid.slice(0,6);
    const levels=recent6.map(raceLevel).filter(x=>x!=null);
    const currentLevel=currentLevelOverride!=null?currentLevelOverride:(levels.length?Math.max(...levels):null);
    return{runs:recent,currentLevel,total:valid.length};
  }

  function minimumEvidenceLevel(targetLevel){
    if(targetLevel>=7)return 4;       // G1: OP以上を参考対象
    if(targetLevel===6||targetLevel===5)return 3; // G2/G3: 3勝以上
    if(targetLevel===4)return 2;      // OP: 2勝以上
    if(targetLevel===3)return 1;      // 3勝: 1勝以上
    if(targetLevel===2)return 0;      // 2勝: 新馬以外を参考対象
    return 0;
  }

  function classTier(run,targetLevel){
    const lv=raceLevel(run);
    if(targetLevel==null||lv==null)return 0;
    if(lv>=targetLevel)return 3; // 同級以上
    if(lv>=minimumEvidenceLevel(targetLevel))return 2; // 今回基準で残す下級参考
    return 1;
  }

  function performanceWeight(run,index,targetLevel){
    const f=finishNo(run.finish), m=marginNo(run.margin);
    let p=0;
    if(f===1)p=3.2; else if(f===2)p=2.6; else if(f===3)p=2.2; else if(f===4)p=1.35; else if(f===5)p=1.05;
    else if(f===6)p=.72; else if(f===7)p=.55;
    else if(m!=null&&m<=0.3)p=1.25; else if(m!=null&&m<=0.5)p=.9;
    if(!p)return 0;
    const recency=Math.max(.55,1-index*.06);
    const tier=classTier(run,targetLevel);
    const levelW = tier === 3 ? 1.12 : (tier === 2 ? 0.72 : 0.36);
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

  function coreAnalysis(runs,targetLevel=null){
    const scope=recentAbilityScope(runs,targetLevel);
    const effectiveLevel=targetLevel!=null?targetLevel:scope.currentLevel;
    const points=[];
    scope.runs.forEach((r,i)=>{const lap=num(r.lap33),w=performanceWeight(r,i,effectiveLevel);if(lap!=null&&w>0)points.push({lap,weight:w,run:r})});
    const strong=points.filter(p=>isGoodRun(p.run));
    // コア33は「3着以内」だけから作る。4〜7着や僅差は隠れ適合の材料であり、
    // 好走帯そのものへ混ぜない（好走評価=3着以内の運用ルール）。
    const core=strong.length?densestBand(strong,.9,Math.min(2,strong.length)):null;
    const allGoodVals=runs.filter(r=>num(r.lap33)!=null&&isGoodRun(r)).map(r=>num(r.lap33));
    const allGood=allGoodVals.length?{min:round1(Math.min(...allGoodVals)),max:round1(Math.max(...allGoodVals))}:null;
    return{scope,points,strong,core,allGood,targetLevel:effectiveLevel};
  }

  function gapToBand(avg,band){
    if(avg==null||!band)return null;
    if(avg>=band.min&&avg<=band.max)return 0;
    return round1(avg<band.min?band.min-avg:avg-band.max);
  }

  function evidenceRows(analysis,avg,targetLevel){
    return (analysis?.scope?.runs||[]).map((run,index)=>{
      const lap=num(run.lap33),finish=finishNo(run.finish),margin=marginNo(run.margin),level=raceLevel(run);
      return{run,index,lap,finish,margin,level,tier:classTier(run,targetLevel),delta:lap==null||avg==null?null:round1(Math.abs(lap-avg))};
    }).filter(x=>x.lap!=null&&x.delta!=null);
  }

  function evidenceText(prefix,row){
    if(!row)return prefix;
    const lap=`${row.lap>=0?'+':''}${row.lap}`;
    const fin=row.finish!=null?`${row.finish}着`:'着順不明';
    const lv=row.level==null?'クラス不明':levelName(row.level);
    return `${prefix}：${lv} ${lap} / ${fin}`;
  }

  function pickBest(rows){
    return [...rows].sort((a,b)=>b.tier-a.tier||a.delta-b.delta||(a.finish??99)-(b.finish??99)||a.index-b.index)[0]||null;
  }

  function avgFinish(runs){
    const vals=(runs||[]).map(r=>finishNo(r?.finish)).filter(v=>v!=null);
    return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;
  }

  function hiddenSignal(avg,analysis,targetLevel){
    const rows=evidenceRows(analysis,avg,targetLevel);
    const same=rows.filter(x=>x.tier===3&&x.finish!=null);
    const inside=same.filter(x=>x.delta<=.6&&((x.finish>=4&&x.finish<=7)||(x.margin!=null&&x.margin<=.5)));
    if(!inside.length)return null;
    const outside=same.filter(x=>x.delta>.8);
    const ai=avgFinish(inside.map(x=>x.run)),ao=avgFinish(outside.map(x=>x.run));
    const close=inside.some(x=>x.margin!=null&&x.margin<=.5);
    const relative=ai!=null&&ao!=null&&ao-ai>=.5;
    if(!close&&!relative&&inside.length<2)return null;
    const best=pickBest(inside);
    const detail=relative
      ? `${evidenceText('今回帯で上昇',best)} / 帯内平均${round1(ai)}着・他${round1(ao)}着`
      : `${evidenceText('今回帯で隠れ好走',best)}${close?' / 僅差':''}`;
    return{code:'hidden',mark:'▲',label:'隠れ適合',cls:'hidden',gap:best?.delta??null,detail};
  }

  function reverseSignal(avg,analysis,targetLevel){
    const allGood=evidenceRows(analysis,avg,targetLevel)
      .filter(x=>x.tier>=1&&x.finish!=null&&x.finish<=3);
    const currentGood=allGood.filter(x=>x.tier===3);
    if(currentGood.length<2)return null;

    const currentFar=currentGood.filter(x=>x.delta>=1.0);
    if(currentFar.length<2)return null;
    const currentLeft=currentFar.every(x=>x.lap<=avg-1.0);
    const currentRight=currentFar.every(x=>x.lap>=avg+1.0);
    if(!currentLeft&&!currentRight)return null;

    const side=currentRight?'高い33側':'低い33側';
    const currentNear=currentGood.filter(x=>x.delta<=.9);
    if(currentNear.length)return null;

    const allFar=allGood.filter(x=>x.delta>=1.0);
    const allLeft=allGood.length>=2&&allGood.every(x=>x.lap<=avg-1.0);
    const allRight=allGood.length>=2&&allGood.every(x=>x.lap>=avg+1.0);
    const allCareerReverse=allGood.length>=2&&allFar.length===allGood.length&&(allLeft||allRight);

    if(allCareerReverse){
      return{
        code:'reverse_all',
        mark:'逆◎',
        label:'全く逆',
        cls:'reverse',
        gap:Math.min(...allFar.map(x=>x.delta)),
        detail:`${side}に有効クラスの好走が一貫して集中（${allGood.length}走）`
      };
    }

    const lowerNear=allGood.filter(x=>x.tier<3&&x.delta<=.9);
    return{
      code:'reverse_current',
      mark:'逆◎',
      label:'現級では逆',
      cls:'reverse',
      gap:Math.min(...currentFar.map(x=>x.delta)),
      detail:lowerNear.length
        ? `${side}に同級以上の好走が集中（${currentFar.length}走）／下級では今回帯の好走あり`
        : `${side}に同級以上の好走が集中（${currentFar.length}走）／全体では反対側に限定されない`
    };
  }

  function dependencySignal(avg,analysis,targetLevel){
    const band=analysis.core;if(!band)return null;
    const rows=evidenceRows(analysis,avg,targetLevel).filter(x=>x.tier>=2&&x.finish!=null);
    const inside=rows.filter(x=>x.lap>=band.min-.35&&x.lap<=band.max+.35);
    const outside=rows.filter(x=>x.lap<band.min-.35||x.lap>band.max+.35);
    if(inside.length<2||outside.length<2)return null;
    const ai=avgFinish(inside.map(x=>x.run)),ao=avgFinish(outside.map(x=>x.run)),gap=gapToBand(avg,band);
    if(ai==null||ao==null||gap==null)return null;
    if(ao-ai>=1.5&&gap>.5)return{code:'dependency',mark:'⚠',label:'33依存・今回はズレ',cls:'warn',gap,detail:`コア時平均${round1(ai)}着 / 他${round1(ao)}着`};
    return null;
  }

  function fallbackJudge(avg,band){
    if(avg==null)return{code:'unknown',mark:'—',label:'判定不可',gap:null,cls:'mid',detail:'今回平均33が未設定'};
    if(!band)return{code:'mid',mark:'—',label:'中間',gap:null,cls:'mid',detail:'3着以内の好走33帯を作れる根拠なし'};
    const gap=gapToBand(avg,band);
    if(gap<=.5)return{code:'possible',mark:'○',label:'好走可能',gap,cls:'possible',detail:'3着以内で作ったコア帯に近いが、今回クラスでの直接的な近接好走根拠は弱い'};
    return{code:'mid',mark:'—',label:'中間',gap,cls:'mid',detail:''};
  }

  function primaryJudge(avg,analysis,targetLevel){
    if(avg==null)return fallbackJudge(avg,analysis?.core);
    const rows=evidenceRows(analysis,avg,targetLevel);
    const sameGoodCore=rows.filter(x=>x.tier===3&&x.finish!=null&&x.finish<=3&&x.delta<=.5);
    if(sameGoodCore.length){
      const best=pickBest(sameGoodCore);
      return{code:'core',mark:'◎',label:'コア一致',gap:best.delta,cls:'perfect',detail:evidenceText('同級以上で直接適合',best)};
    }

    const hidden=hiddenSignal(avg,analysis,targetLevel);
    if(hidden)return hidden;

    const sameGoodNear=rows.filter(x=>x.tier===3&&x.finish!=null&&x.finish<=3&&x.delta<=.9);
    if(sameGoodNear.length){
      const best=pickBest(sameGoodNear);
      return{code:'possible',mark:'○',label:'好走可能',gap:best.delta,cls:'possible',detail:evidenceText('同級以上で近接好走',best)};
    }

    const lowerGood=rows.filter(x=>x.tier===2&&x.finish!=null&&x.finish<=3&&x.delta<=.9);
    if(lowerGood.length){
      const best=pickBest(lowerGood);
      return{code:'possible',mark:'○',label:'好走可能',gap:best.delta,cls:'possible',detail:evidenceText('下級参考クラスの適合実績',best)};
    }

    const reverse=reverseSignal(avg,analysis,targetLevel);
    if(reverse)return reverse;
    const dep=dependencySignal(avg,analysis,targetLevel);
    if(dep)return dep;
    return fallbackJudge(avg,analysis.core);
  }

  function abilitySignal(analysis,targetLevel){
    const strong=(analysis?.strong||[]).filter(p=>classTier(p.run,targetLevel)>=2);
    if(strong.length<4)return null;
    const strongLaps=strong.map(p=>p.lap);
    const span=Math.max(...strongLaps)-Math.min(...strongLaps);
    if(span<2.0)return null;
    const buckets=new Set(strongLaps.map(v=>Math.floor(v/.8)));
    if(buckets.size<3)return null;
    return{code:'ability',mark:'◇',label:'能力型',detail:`同級〜参考下級で広い33に好走（幅${round1(span)}）`};
  }

  function zoneTextBand(b){return!b?'—':b.min===b.max?`${b.min}`:`${b.min}〜${b.max}`}
  function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}

  let last=[];
  async function evaluate(){
    const names=$('horses').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const ctx={surface:$('surface').value,band:bandOf($('distance').value),going:$('going').value};
    const inputAvg=num($('avg33').value),pdfAvg=num(window.MyKeibaDbLabPdfRace?.avg33),avg=inputAvg!=null?inputAvg:pdfAvg;
    if(inputAvg==null&&pdfAvg!=null)$('avg33').value=String(pdfAvg);
    const target=targetRaceInfo();
    if(target.level==null)throw new Error('今回クラスを選択してください（G3・3勝など）。クラス未設定では同級判定を行いません。');
    const dbHorses=await listHorses(),byName=new Map(dbHorses.map(h=>[norm(h.name),h])),out=[];
    for(const [i,name] of names.entries()){
      const h=byName.get(norm(name)); if(!h){out.push({no:i+1,name,missing:true});continue}
      try{
        const runs=await getRuns(h.key);
        const usable=usableRuns(runs),excuseExcluded=runs.length-usable.length;
        const classScope=applyTargetClassRule(usable,target);
        const abilityScope=recentAbilityScope(usable);
        const targetLevel=target.level;
        const sel=selectRuns(classScope.runs,ctx),analysis=coreAnalysis(sel.selected,targetLevel);
        let judge;
        try{judge=primaryJudge(avg,analysis,targetLevel)}
        catch(err){
          console.warn('primaryJudge fallback',h.name,err);
          judge=fallbackJudge(avg,analysis?.core||null);
          judge.detail='詳細判定を簡易判定へ退避';
        }
        let ability=null;
        try{ability=abilitySignal(analysis,targetLevel)}catch(err){console.warn('abilitySignal skipped',h.name,err)}
        out.push({no:i+1,name:h.name,missing:false,basis:sel.basis,judge,ability,analysis,targetLevel,excluded:excuseExcluded,classExcluded:classScope.excluded.length,classRule:classScope.rule});
      }catch(err){
        console.error('horse evaluation failed',h.name,err);
        const emptyAnalysis={scope:{runs:[],currentLevel:target.level??null},core:null,allGood:null,strong:[]};
        out.push({no:i+1,name:h.name,missing:false,basis:'判定エラー',judge:{code:'unknown',mark:'—',label:'判定不可',gap:null,cls:'mid',detail:`この馬のDB計算でエラー: ${err?.message||String(err)}`},ability:null,analysis:emptyAnalysis,targetLevel:target.level??null,excluded:0,classExcluded:0,classRule:'再評価が必要'});
      }
      if(i%5===4)await new Promise(r=>setTimeout(r,0));
    }
    last=out;render(out);return out;
  }

  function displayBadge(x){return x.judge;}
  function render(out){
    $('resultCard').hidden=false;$('count').textContent=`${out.filter(x=>!x.missing).length}/${out.length}頭`;
    $('results').innerHTML=out.map(x=>{
      if(x.missing)return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span class="pill p-mid">DBなし</span></div><small class="missing">登録DBに一致馬がありません。</small></div>`;
      const d=displayBadge(x),pill=d.cls==='perfect'?'p-perfect':d.cls==='possible'?'p-possible':d.cls==='reverse'?'p-reverse':d.cls==='hidden'?'p-hidden':d.cls==='warn'?'p-warn':d.cls==='ability'?'p-ability':'p-mid';
      const gap=x.judge.gap==null?'':` / 差${x.judge.gap}`;
      const a=x.analysis,core=zoneTextBand(a.core),all=zoneTextBand(a.allGood),lv=levelName(a.scope.currentLevel);
      const reason=x.judge?.detail?`<div class="db33-signal">${esc(x.judge.detail)}</div>`:'';
      const ability=x.ability?`<span class="pill p-ability" title="${esc(x.ability.detail||'')}">◇ 能力型</span>`:'';
      return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end"><span class="pill ${pill}">${esc(d.mark)} ${esc(d.label)}</span>${ability}</span></div><div class="zone">${esc(x.basis)} / コア33 ${esc(core)}</div><small>${esc(x.classRule)} / 近年対象${a.scope.runs.length}走${x.classExcluded?` / 下級除外${x.classExcluded}走`:''} / 今回クラス ${esc(lv)} / 全好走33 ${esc(all)}${gap}${x.excluded?` / 度外視${x.excluded}走`:''}</small>${reason}${x.ability?`<div class="db33-signal">◇ ${esc(x.ability.detail)}</div>`:''}</div>`;
    }).join('');
    try{$('resultCard')?.scrollIntoView?.({behavior:'smooth',block:'start'})}catch{}
  }

  function resultText(){
    const head=`MYKEIBA_DB_RESULT_V2\n${$('track').value.trim()} ${$('raceNo').value.trim()}R|${$('raceName').value.trim()}|${$('surface').value}|${$('distance').value}|${$('going').value||'未設定'}|${$('avg33').value}`;
    const rows=last.filter(x=>!x.missing).map(x=>{const d=displayBadge(x),a=x.analysis;return `${x.no}|${x.name}|${d.mark}|${d.label}|${zoneTextBand(a.core)}|${x.basis}|${x.judge.gap??0}|${x.excluded||0}|${x.judge?.code||''}|${x.judge?.detail||''}|${zoneTextBand(a.allGood)}|${levelName(a.scope.currentLevel)}|${x.ability?.code||''}|${x.ability?.detail||''}`});
    return `${head}\n${rows.join('\n')}`;
  }

  const style=document.createElement('style');
  style.textContent=`.p-hidden{background:#e8e0ff;color:#6542a0}.p-warn{background:#ffe3dc;color:#a44534}.p-ability{background:#e3edf8;color:#365e87}.db33-signal{margin-top:2px;padding:7px 9px;border-radius:10px;background:#f6f8f7;color:#536c60;font-size:10px;font-weight:800}.db33-advanced-note{margin-top:8px;padding:9px 11px;border-radius:12px;background:#f6f8f7;color:#607168;font-size:10px;line-height:1.6}`;
  document.head.appendChild(style);
  const legend=document.querySelector('.legend');
  if(legend&&!document.querySelector('#db33AdvancedLegend')){
    const box=document.createElement('div');box.id='db33AdvancedLegend';box.className='db33-advanced-note';box.innerHTML='<b>追加判定：</b> ▲ 隠れ適合＝特定33帯で他条件より着順上昇（対象着順も表示）　/　⚠ 33依存・今回はズレ＝コア33時だけ成績が明確に良い　/　◇ 能力型＝広い33で好走';legend.insertAdjacentElement('afterend',box);
  }

  $('loadDb').onclick=async()=>{try{const hs=await listHorses();$('dbStatus').textContent=`登録DB ${hs.length}頭。出走馬欄に馬名を1行ずつ入力してください。`}catch(e){$('dbStatus').textContent='DBを開けませんでした。MY KEIBA LABと同じブラウザで開いてください。'}};
  $('judge').onclick=async()=>{try{$('dbStatus').textContent='評価中…';await evaluate();$('dbStatus').textContent='評価完了（クラス別33適合を優先・能力型は補助タグ）'}catch(e){console.error(e);$('dbStatus').textContent=`評価エラー: ${e?.message||String(e)}`;}};
  $('saveResult').onclick=()=>{if(!last.length)return;localStorage.setItem('my-keiba-db-result-v2',resultText());localStorage.setItem('my-keiba-db-result-v2-at',new Date().toISOString());$('saveStatus').textContent='MY KEIBA LAB取込用としてこのブラウザに保存しました（能力型は補助タグ扱い）。'};
  $('copyResult').onclick=async()=>{if(!last.length)return;try{await navigator.clipboard.writeText(resultText());$('saveStatus').textContent='結果をコピーしました。'}catch{$('saveStatus').textContent='コピーできませんでした。'}};
  $('loadDb').click();
})();