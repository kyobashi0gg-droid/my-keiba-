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
  function excuseReason(run){
    const f=finishNo(run.finish); if(f!=null&&f<=3)return'';
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
  function summarize(runs){
    const valid=runs.map(run=>({run,lap:num(run.lap33),finish:finishNo(run.finish)})).filter(x=>x.lap!=null);
    const good=valid.filter(x=>x.finish!=null&&x.finish<=3); const basis=good.length>=2?good:valid;
    if(!basis.length)return{zoneMin:null,zoneMax:null,goodCount:good.length,lapCount:valid.length};
    const vals=basis.map(x=>x.lap).sort((a,b)=>a-b);
    return{zoneMin:round1(vals[0]),zoneMax:round1(vals.at(-1)),goodCount:good.length,lapCount:valid.length};
  }
  function runCondition(run){return{surface:surfaceOf(run.surface||run.trackType||run.course),band:bandOf(run.distance),going:goingNorm(run.going)}}
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
  function judge(avg,s){
    if(avg==null||s.zoneMin==null||s.zoneMax==null)return{mark:'—',label:'判定不可',gap:null,cls:'mid'};
    if(avg>=s.zoneMin&&avg<=s.zoneMax)return{mark:'◎',label:'ピッタリ',gap:0,cls:'perfect'};
    const gap=round1(avg<s.zoneMin?s.zoneMin-avg:avg-s.zoneMax);
    if(gap<=.5)return{mark:'○',label:'好走可能',gap,cls:'possible'};
    if(gap>=1.0)return{mark:'逆◎',label:'全く逆',gap,cls:'reverse'};
    return{mark:'—',label:'中間',gap,cls:'mid'};
  }
  function zoneText(s){return s.zoneMin==null?'—':s.zoneMin===s.zoneMax?`${s.zoneMin}`:`${s.zoneMin}〜${s.zoneMax}`}
  function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}

  let last=[];
  async function evaluate(){
    const names=$('horses').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const ctx={surface:$('surface').value,band:bandOf($('distance').value),going:$('going').value}; const avg=num($('avg33').value);
    const dbHorses=await listHorses(); const byName=new Map(dbHorses.map(h=>[norm(h.name),h]));
    const out=[];
    for(const [i,name] of names.entries()){
      const h=byName.get(norm(name));
      if(!h){out.push({no:i+1,name,missing:true});continue}
      const runs=await getRuns(h.key); const sel=selectRuns(runs,ctx); const s=summarize(sel.selected); const j=judge(avg,s);
      out.push({no:i+1,name:h.name,missing:false,basis:sel.basis,summary:s,judge:j,excluded:sel.excluded});
      if(i%5===4) await new Promise(r=>setTimeout(r,0));
    }
    last=out; render(out); return out;
  }
  function render(out){
    $('resultCard').hidden=false; $('count').textContent=`${out.filter(x=>!x.missing).length}/${out.length}頭`;
    $('results').innerHTML=out.map(x=>{
      if(x.missing)return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span class="pill p-mid">DBなし</span></div><small class="missing">登録DBに一致馬がありません。</small></div>`;
      const cls=x.judge.cls, pill=cls==='perfect'?'p-perfect':cls==='possible'?'p-possible':cls==='reverse'?'p-reverse':'p-mid';
      const gap=x.judge.gap==null?'':` / 差${x.judge.gap}`;
      return`<div class="horse"><div class="horse-top"><b>${x.no} ${esc(x.name)}</b><span class="pill ${pill}">${esc(x.judge.mark)} ${esc(x.judge.label)}</span></div><div class="zone">${esc(x.basis)} / 好走33帯 ${esc(zoneText(x.summary))}</div><small>対象${x.summary.lapCount}走 / 好走${x.summary.goodCount}走${gap}${x.excluded?` / 度外視${x.excluded}走`:''}</small></div>`;
    }).join('');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function resultText(){
    const head=`MYKEIBA_DB_RESULT_V2\n${$('track').value.trim()} ${$('raceNo').value.trim()}R|${$('raceName').value.trim()}|${$('surface').value}|${$('distance').value}|${$('going').value||'未設定'}|${$('avg33').value}`;
    const rows=last.filter(x=>!x.missing).map(x=>`${x.no}|${x.name}|${x.judge.mark}|${x.judge.label}|${zoneText(x.summary)}|${x.basis}|${x.judge.gap??0}|${x.excluded||0}`);
    return `${head}\n${rows.join('\n')}`;
  }

  $('loadDb').onclick=async()=>{try{const hs=await listHorses();$('dbStatus').textContent=`登録DB ${hs.length}頭。出走馬欄に馬名を1行ずつ入力してください。`}catch(e){$('dbStatus').textContent='DBを開けませんでした。MY KEIBA LABと同じブラウザで開いてください。'}};
  $('judge').onclick=async()=>{try{$('dbStatus').textContent='評価中…';await evaluate();$('dbStatus').textContent='評価完了'}catch(e){console.error(e);$('dbStatus').textContent='評価中にエラーが発生しました。'}};
  $('saveResult').onclick=()=>{if(!last.length)return;localStorage.setItem('my-keiba-db-result-v2',resultText());localStorage.setItem('my-keiba-db-result-v2-at',new Date().toISOString());$('saveStatus').textContent='MY KEIBA LAB取込用としてこのブラウザに保存しました。'};
  $('copyResult').onclick=async()=>{if(!last.length)return;try{await navigator.clipboard.writeText(resultText());$('saveStatus').textContent='結果をコピーしました。'}catch{$('saveStatus').textContent='コピーできませんでした。'}};
  $('loadDb').click();
})();