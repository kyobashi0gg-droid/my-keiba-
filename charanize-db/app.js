// CHARANIZE DB Lab - Public application logic (no licensed newspaper content)
const PAYLOAD={meta:window.__CH_PRIVATE.meta,horses:window.__CH_PRIVATE.horses};
const RACE_SOURCE={meta:window.__CH_PRIVATE.race_meta||{},races:window.__CH_PRIVATE.races};
(function(){
"use strict";
const labels=['逃','先','追走','脚力','ギア'],keys=['escape','front','pursuit','leg','gear'],colors=['#14a37d','#e0a04d','#7595de','#2579c1','#a05acb'];
const app={db:PAYLOAD.horses,meta:PAYLOAD.meta,tab:'horse',current:'',avgN:5,chartSeries:[3,4],chartIndex:3,preset:'revival',discoveryLimit:32};
app.compareList=[]; app.compareRaceKey='';
const $=id=>document.getElementById(id),safe=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(1):'—', count=x=>x===1?'1走':x+'走';
const date=x=>x?String(x).slice(2).replaceAll('-','/'):'—';
const isWet=x=>['稍','稍重','重','不','不良'].includes(x);
const num=x=>typeof x==='number'&&Number.isFinite(x);
function nav(tab){app.tab=tab;document.querySelectorAll('.tabview').forEach(v=>v.classList.toggle('active',v.id==='tab-'+tab));document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===tab));if(tab==='discover')renderDiscover();window.scrollTo({top:0,behavior:'smooth'});}
function surfaces(rows){return [...new Set(rows.map(r=>r[3]).filter(Boolean))];}
function getHorse(name){return app.db[name];}
function horseRows(name){return getHorse(name)?.[2]||[];}
function filt(r){if(app.cutoff&&r[0]&&r[0]>=app.cutoff)return false;let t=$('surface').value,venue=$('venue').value,d=$('dist').value,going=$('going').value;return (t==='all'||r[3]===t)&&(venue==='all'||r[1]===venue)&&(going==='all'||r[5]===going)&& (d==='all'||d==='s'&&r[4]<=1400||d==='m'&&r[4]===1600||d==='i'&&r[4]>=1800&&r[4]<=2200||d==='l'&&r[4]>=2400);}
function avg(rows,i,n,threshold=3){let a=rows.slice(0,n).map(r=>r[9][i]).filter(num);return {n:a.length,v:a.length>=threshold?a.reduce((x,y)=>x+y,0)/a.length:null};}
function getPeak(rows,i){let a=rows.filter(r=>num(r[9][i]));return a.length?a.reduce((x,y)=>y[9][i]>x[9][i]?y:x):null;}
function parsePass(r){return String(r[7]||'').match(/\d+/g)?.map(Number)||[];}
function rowTags(r){let v=r[9],pass=parsePass(r),fin=r[6],tags=[]; const tag=(type,label)=>tags.push({type,label});
 if(num(v[3])&&v[3]>=85)tag('pos','高脚力');
 if(num(v[4])&&v[4]>=80)tag('pos','高ギア');
 if(num(v[1])&&v[1]>=80&&num(v[3])&&v[3]>=70&&fin&&fin<=3)tag('pos','先行＋脚力両立');
 if(isWet(r[5])&&num(v[3])&&v[3]>=70&&fin&&fin<=3)tag('neutral','道悪で3着以内');
 if(pass.length>1&&pass[0]<=2&&fin>=7&&num(v[3])&&v[3]<45)tag('neg','前で運んで終い低下');
 if(num(v[2])&&v[2]>=75&&num(v[3])&&v[3]>=70&&num(v[4])&&v[4]>=60)tag('pos','高追走負荷でも脚・ギア発揮');
 if(num(v[2])&&v[2]>=75&&num(v[3])&&v[3]<45&&num(v[4])&&v[4]<25)tag('neg','高追走負荷下で終い低調');
 if(num(v[4])&&v[4]<=12&&num(v[3])&&v[3]<40&&fin>=7)tag('neg','脚・ギアとも低調');
 if(r[12]&&Object.keys(r[12]).length)tag('warn','指数の出典差');
 return tags.slice(0,4)}
function runSummary(r){return [date(r[0]),r[1],r[2]?r[2]+'R':'',r[3]+(r[4]||'')+'m',r[5],r[6]?r[6]+'着':''].join(' ').replaceAll('  ',' ');}
function getSignals(rows){let signal=[];const put=(type,label,desc,refs)=>signal.push({type,label,desc,refs});const turf=rows.filter(r=>r[3]==='芝'),dirt=rows.filter(r=>r[3]==='ダ');
 let high=rows.filter(r=>num(r[9][3])&&r[9][3]>=80);if(high.length>=2){put('pos','高脚力を複数回記録',`対象${high.length}走で脚力80以上`,high.slice(0,3));}else if(high.length===1)put('neutral','高脚力の上限あり','高脚力は対象1走のみ。再現は未検証',high);
 let dual=rows.filter(r=>num(r[9][3])&&r[9][3]>=75&&num(r[9][4])&&r[9][4]>=70);if(dual.length)put(dual.length>=2?'pos':'neutral','脚力とギアを同時発揮',`同一走で脚75以上・ギア70以上を${dual.length}回`,dual.slice(0,3));
 let wet=rows.filter(r=>isWet(r[5])&&r[6]&&r[6]<=3&&num(r[9][3])&&r[9][3]>=70);if(wet.length)put('neutral','道悪での好走実績',`稍重〜不良で3着以内かつ脚力70以上が${wet.length}走。ただし芝・ダで指数の変化方向が異なるため、これだけで道悪適性とは判定しない`,wet.slice(0,3));
 let good=rows.filter(r=>num(r[9][3]));if(good.length>=5){let a=avg(rows,3,3),old=rows.slice(3,8).filter(r=>num(r[9][3]));let oldAvg=old.length>=2?old.reduce((x,y)=>x+y[9][3],0)/old.length:null;if(a.v!==null&&oldAvg!==null&&oldAvg-a.v>=20)put('neg','近走脚力が低下',`直近3走平均${fmt(a.v)}、それ以前の収録${old.length}走平均${fmt(oldAvg)}。原因は未確定`,rows.slice(0,Math.min(8,rows.length))); if(a.v!==null&&oldAvg!==null&&a.v-oldAvg>=20)put('pos','近走脚力が上昇',`直近3走平均${fmt(a.v)}、それ以前の収録${old.length}走平均${fmt(oldAvg)}`,rows.slice(0,Math.min(8,rows.length)));}
 let front=rows.filter(r=>parsePass(r).length&&parsePass(r)[0]<=2&&r[6]>=7&&num(r[9][3])&&r[9][3]<45);if(front.length)put('neg','先行時に終い低下',`前方通過後に7着以下・脚力45未満が${front.length}走。先行負荷が原因かは未確定`,front.slice(0,3));
 let pursuitStrong=rows.filter(r=>num(r[9][2])&&r[9][2]>=75&&num(r[9][3])&&r[9][3]>=70&&num(r[9][4])&&r[9][4]>=60);if(pursuitStrong.length)put('pos','高追走負荷でも脚・ギア発揮',`追走指数75以上の負荷を経験した走りで脚力70以上・ギア60以上が${pursuitStrong.length}走。能力上限と再現性は別評価`,pursuitStrong.slice(0,3));
 let pursuit=rows.filter(r=>num(r[9][2])&&r[9][2]>=75&&num(r[9][3])&&r[9][3]<45&&num(r[9][4])&&r[9][4]<25);if(pursuit.length)put('neg','高追走負荷下で終い低調',`追走指数75以上の負荷を経験した走りで脚力45未満・ギア25未満が${pursuit.length}走。負荷が原因かはこの組み合わせだけでは断定できない`,pursuit.slice(0,3));
 const loadRelief=loadReliefPair(rows);
  if(loadRelief)put('neutral','追走負荷軽減側で脚力上昇',`同じ芝ダ・距離帯・馬場状態で追走−${fmt(loadRelief.loadDrop)}、脚力＋${fmt(loadRelief.legGain)}。過去2走の比較。原因は未確定`,[loadRelief.high,loadRelief.low]);
  let flip=rows.filter(r=>num(r[9][4])&&r[9][4]>=70);if(flip.length)put('neutral','ギアを使えた実績',`ギア70以上を${flip.length}走で記録。今回の再現確度はコースや位置取り次第`,flip.slice(0,3));
 if(turf.length&&dirt.length)put('neutral','芝・ダート両方の履歴あり','芝指数をダート能力に直接加算しない。高速ダートへの転用は別途検証',[...turf.slice(0,1),...dirt.slice(0,1)]);
 return signal;
}
function evidenceText(r){let vals=r[9];return `${runSummary(r)}：脚${fmt(vals[3])}、ギア${fmt(vals[4])}、先${fmt(vals[1])}、追${fmt(vals[2])}`;}
function renderEvidence(sig){return `<details class="evidence"><summary>根拠の過去走を確認 (${sig.refs.length}件表示)</summary><ul>${sig.refs.map(r=>`<li>${safe(evidenceText(r))}</li>`).join('')}</ul></details>`;}
function renderSignal(sig){return `<div class="tagitem ${sig.type==='pos'?'pos':sig.type==='neg'?'neg':'neutral'}"><b>${sig.type==='pos'?'＋':sig.type==='neg'?'－':'・'}</b>${safe(sig.label)}</div><div class="smallnote" style="margin:3px 0 7px">${safe(sig.desc)}</div>${renderEvidence(sig)}`;}
function initFilters(){let venues=new Set;Object.values(app.db).forEach(h=>h[2].forEach(r=>{if(r[1])venues.add(r[1])})); let cur=$('venue').value;$('venue').innerHTML='<option value="all">すべて</option>'+[...venues].sort((a,b)=>a.localeCompare(b,'ja')).map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(venues.has(cur))$('venue').value=cur;}
function selectHorse(name,reset=true){if(!app.db[name])return;app.current=name;$('query').value=name;if(reset){$('surface').value=surfaces(horseRows(name)).length===1?surfaces(horseRows(name))[0]:(horseRows(name)[0]?.[3]||'芝');$('venue').value='all';$('dist').value='all';$('going').value='all';}renderHorse();if(location.hash!==`#${encodeURIComponent(name)}`)history.replaceState(null,'',`#${encodeURIComponent(name)}`);}
function lookup(){let q=$('query').value.trim(),names=Object.keys(app.db);if(!q)return;let name=app.db[q]?q:names.find(x=>x.includes(q))||names.find(x=>x.toLowerCase().includes(q.toLowerCase()));if(name)selectHorse(name,true);else $('horse-title').textContent='該当する馬がありません';}
function svgChart(rows){let n=rows.length,series=app.chartSeries,w=680,h=250,pad=36;let rev=rows.slice().reverse();const x=i=>pad+(w-2*pad)*(n===1?.5:i/(n-1));let ys=rev.flatMap(r=>series.map(i=>r[9][i])).filter(num);let min=Math.min(-10,...ys),max=Math.max(110,...ys);min=Math.floor(min/20)*20;max=Math.ceil(max/20)*20;const y=v=>h-pad-(v-min)/(max-min)*(h-2*pad);const lineVals=[];for(let z=min;z<=max;z+=20){lineVals.push(`<line x1="${pad}" x2="${w-pad}" y1="${y(z)}" y2="${y(z)}" stroke="#dfe9e2"/><text x="${pad-7}" y="${y(z)+4}" text-anchor="end" font-size="12" fill="#7a8f83">${z}</text>`)}let paths=[];series.forEach(i=>{let part='',prev=false;rev.forEach((r,j)=>{let val=r[9][i];if(num(val)){part+=(prev?' L':' M')+x(j).toFixed(1)+','+y(val).toFixed(1);prev=true;paths.push(`<circle cx="${x(j)}" cy="${y(val)}" r="3.6" fill="${colors[i]}"><title>${safe(date(r[0]))} ${labels[i]} ${fmt(val)}</title></circle>`)}else prev=false});paths.push(`<path d="${part}" fill="none" stroke="${colors[i]}" stroke-width="2.8" stroke-linejoin="round"/>`)});let dates=rev.length>1?`<text x="${pad}" y="${h-8}" font-size="11" fill="#788b7e">${date(rev[0][0])}</text><text x="${w-pad}" text-anchor="end" y="${h-8}" font-size="11" fill="#788b7e">${date(rev[rev.length-1][0])}</text>`:'';return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="直近10走の指数推移">${lineVals.join('')}${paths.join('')}${dates}</svg>`;}
function bars(rows,idx){let groups=[['場別',r=>r[1]],['距離別',r=>r[4]?r[4]+'m':'不明'],['馬場別',r=>r[5]]];return groups.map(([title,key])=>{let map={};for(let r of rows){let v=r[9][idx];if(!num(v))continue;let k=key(r);(map[k]||(map[k]=[])).push(v);}let arr=Object.entries(map).map(([k,vs])=>({k,n:vs.length,mean:vs.reduce((a,b)=>a+b,0)/vs.length})).sort((a,b)=>b.n-a.n||b.mean-a.mean).slice(0,5);return `<div class="chartcard"><div class="section-title" style="font-size:13px;margin:0 0 10px">${title} ${labels[idx]}指数</div><div class="factorlist">${arr.map(x=>`<div class="factor"><span>${safe(x.k)}<small>${x.n}走</small></span><div class="bartrack"><i style="width:${Math.max(2,Math.min(100,x.mean))}%"></i></div><b style="text-align:right">${x.n>=2?fmt(x.mean):'<small>1走</small>'}</b></div>`).join('')||'<span class="muted">対象なし</span>'}</div></div>`}).join('')}
function sourceDetails(r){let c=r[12];if(!c)return '';return `<details class="single-source-warning"><summary>原本数値の差異・詳細を見る</summary><div class="notice">同じ過去走について複数号の指数新聞で数値が異なっています。左の数値は試作DBの採用値、以下は異なる版で確認できた値です。現時点ではどちらが確定値か未判定です。<ul>${Object.entries(c).map(([key,arr])=>`<li>${safe(labels[keys.indexOf(key)]||key)}：${arr.map(a=>safe(a.f)+'＝'+fmt(a.v)).join('、')}</li>`).join('')}</ul></div></details>`;}
function renderRows(rows){return rows.map((r,i)=>{let notes=rowTags(r);return `<tr id="run-${i}"><td>${safe(date(r[0]))}</td><td>${safe(r[1])}${r[2]||''}R<br><small>${safe(r[10]||'')}</small></td><td>${safe(r[3])}${r[4]}m</td><td>${safe(r[5])}</td><td>${r[6]??'—'}</td><td>${safe(r[7]||'—')}</td><td>${safe(r[8]||'—')}</td>${r[9].map(v=>`<td class="num ${!num(v)?'':v>=90?'hi':v<0?'low':''}">${fmt(v)}</td>`).join('')}<td class="notes-cell">${notes.filter(x=>x.type!=='warn').length?notes.filter(x=>x.type!=='warn').map(x=>`<span class="mini ${x.type==='neg'?'neg':''}">${safe(x.label)}</span>`).join(''):(r[12]?'':'<span class="muted">明確な特徴なし</span>')}${sourceDetails(r)}</td></tr>`}).join('')}
function renderHorse(){let horse=getHorse(app.current);if(!horse)return;let all=horse[2],rows=all.filter(filt);let different=surfaces(rows).length>1;
 $('horse-title').textContent=app.current;$('horse-meta').textContent=`${safe(horse[0]||'性別未記録')}・${horse[1]||'?'}歳（新聞時点）　収録${all.length}走・表示${rows.length}走`;$('horse-condition').textContent=rows.length?`${rows.length}走が条件一致`:'該当する走なし';
 $('average-caption').textContent=`条件一致の新しい${app.avgN}走で平均を計算。最低3走・各指数の欠損値は除外。過去10走の最高値とは分離。`;
 $('metrics').innerHTML=labels.map((name,i)=>{let a=avg(rows,i,app.avgN),peak=getPeak(rows,i);return `<div class="metric"><span>${name}</span><b>${different?'—':fmt(a.v)}</b><small>${different?'芝ダ混在':a.v===null?'標本不足':`n=${a.n}`}</small><small>最高 ${peak?fmt(peak[9][i]):'—'}</small></div>`}).join('');
 let positive=[],negative=[],neutral=[];if(!different){let signals=getSignals(rows);positive=signals.filter(x=>x.type==='pos');negative=signals.filter(x=>x.type==='neg');neutral=signals.filter(x=>x.type==='neutral');}
 $('diagnosis').innerHTML=`<div class="diagblock"><strong style="color:#137e5d">＋ 走れる条件・強み</strong>${positive.map(renderSignal).join('')||'<span class="hint">条件一致の過去走から、確認できる強い根拠はまだありません。</span>'}</div><div class="diagblock"><strong style="color:#ab5146">－ 注意したい条件・弱点</strong>${negative.map(renderSignal).join('')||'<span class="hint">明確なマイナス傾向は未検出。弱点がないという意味ではありません。</span>'}</div>${neutral.length?`<div class="diagblock" style="grid-column:1/-1"><strong>検証・保留</strong>${neutral.map(renderSignal).join('')}</div>`:''}`;
 $('series-picker').innerHTML=labels.map((label,i)=>`<button class="${app.chartSeries.includes(i)?'on':''}" data-s="${i}" style="--series:${colors[i]}">${label}</button>`).join('');
 $('series-picker').querySelectorAll('button').forEach(b=>b.onclick=()=>{let n=Number(b.dataset.s);if(app.chartSeries.includes(n)) {if(app.chartSeries.length>1)app.chartSeries=app.chartSeries.filter(x=>x!==n);}else app.chartSeries=[...app.chartSeries,n];renderHorse()});
 $('curve').innerHTML=rows.length?svgChart(rows):'<p class="hint">一致する履歴なし</p>';
 $('plot-legend').innerHTML=app.chartSeries.map(i=>`<span style="--c:${colors[i]}">${labels[i]}</span>`).join('');
 $('bar-index').value=String(app.chartIndex);$('condition-bars').innerHTML=rows.length?bars(rows,app.chartIndex):'<p class="hint">一致する履歴なし</p>';
 $('run-count').textContent=`${rows.length} / ${all.length}走`;
 $('rows').innerHTML=renderRows(rows);
 $('data-warning').textContent=rows.some(r=>r[12])?'注意：表示中の過去走に原本間の指数差があります。備考欄の「原本数値の差異・詳細を見る」で確認できます。':'過去走の指数は出典新聞に基づく暫定値です。';
}
function discoverSurface(){const v=$('discover-surface').value;return v==='race'?(activeRace()?.[1]||'all'):v;}
function selectedWet(g){return $('discover-wetlevel').value==='heavy'?['重','不','不良'].includes(g):isWet(g);}
function raceWeekKey(day){
 if(!day)return '';
 const dt=new Date(day+'T00:00:00Z');if(Number.isNaN(dt.valueOf()))return '';
 // 土曜から翌月曜までをひとつのJRA開催週として扱う（祝日月曜を含む）。
 const offset=(dt.getUTCDay()+1)%7;dt.setUTCDate(dt.getUTCDate()-offset);
 return dt.toISOString().slice(0,10);
}
function scopedRunners(){
 const scope=$('discover-scope').value;
 const result=new Map();
 const cards=raceEntries().filter(e=>scope==='week'?raceWeekKey(e.day)===raceWeekKey(app.raceDate):scope==='day'?e.day===app.raceDate:scope==='race'?e.key===app.raceKey:false);
 for(const card of cards){
  for(const runner of (card.card[3]||[])){
   const name=runner[1];if(!name||result.has(name))continue;
   result.set(name,{day:card.day,venue:card.venue,no:card.no,race:card.card[0],surface:card.card[1],distance:card.card[2]});
  }
 }
 return {scope,entries:result,cards};
}
function distBand(distance){if(!Number.isFinite(Number(distance)))return '';const n=Number(distance);return n<=1400?'短距離（1400m以下）':n===1600?'マイル（1600m）':n<=2200?'中距離（1800〜2200m）':'長距離（2400m以上）';}
// Compare a horse's change from firm to wet against other horses on the same surface and distance band.
// 逃・先・追走・脚力・ギアの絶対値を芝ダ横断で比較しない。脚力指数[3]のみ使用。
function goingPairs(rows,surface){
 const byBand=new Map();
 for(const r of rows){
  if(r[3]!==surface||!num(r[9]?.[3])||!r[4])continue;
  if(app.cutoff&&r[0]&&r[0]>=app.cutoff)continue;
  const band=distBand(r[4]);if(!band)continue;
  if(!byBand.has(band))byBand.set(band,{good:[],wet:[]});
  const group=byBand.get(band);
  if(r[5]==='良')group.good.push(r);
  else if(selectedWet(r[5]))group.wet.push(r);
 }
 const out=[];
 for(const [band,v] of byBand){
  if(v.good.length<2||v.wet.length<1)continue;
  const goodAvg=v.good.reduce((a,r)=>a+r[9][3],0)/v.good.length;
  const wetAvg=v.wet.reduce((a,r)=>a+r[9][3],0)/v.wet.length;
  out.push({surface,band,good:v.good,wet:v.wet,goodAvg,wetAvg,delta:wetAvg-goodAvg});
 }
 return out;
}
function median(a){if(!a.length)return null;const z=a.slice().sort((a,b)=>a-b);const m=z.length>>1;return z.length%2?z[m]:(z[m-1]+z[m])/2;}
function goingCohort(surface){
 const pool={};
 for(const h of Object.values(app.db))for(const x of goingPairs(h[2],surface))(pool[x.band]||(pool[x.band]=[])).push(x.delta);
 return Object.fromEntries(Object.entries(pool).map(([band,values])=>[band,{n:values.length,median:median(values)}]));
}
function candidateRows(h){
 // 過去走の絞り込み。芝ダ条件はここで独立して明示する。
 const surface=discoverSurface(), venue=$('venue').value,dist=$('dist').value,going=$('going').value;
 return (h[2]||[]).filter(r=>{
  if(app.cutoff&&r[0]&&r[0]>=app.cutoff)return false;
  if(surface!=='all'&&r[3]!==surface)return false;
  if(venue!=='all'&&r[1]!==venue)return false;
  if(going!=='all'&&r[5]!==going)return false;
  return dist==='all'||dist==='s'&&r[4]<=1400||dist==='m'&&r[4]===1600||dist==='i'&&r[4]>=1800&&r[4]<=2200||dist==='l'&&r[4]>=2400;
 });
}
// 同じ馬の芝ダ・距離帯・馬場状態をそろえた過去走を比較。因果は未判定。
function loadReliefPair(rows,minP=15,minL=20,minUsableLeg=60){
 const groups=new Map();
 const band=n=>n<=1400?'1400m以下':n<=1600?'1500〜1600m':n<=2200?'1800〜2200m':'2400m以上';
 const ground=g=>g==='稍重'?'稍':g==='不良'?'不':g;
 for(const r of rows){
  if(!['芝','ダ'].includes(r[3])||!num(r[9]?.[2])||!num(r[9]?.[3])||!Number.isFinite(Number(r[4]))||!r[4])continue;
  const key=[r[3],band(Number(r[4])),ground(r[5])].join('/');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 const pairs=[];
 for(const [key,part] of groups){
  for(let i=0;i<part.length;i++)for(let j=i+1;j<part.length;j++){
   const a=part[i],b=part[j];
   if(a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2])continue;
   const low=a[9][2]<b[9][2]?a:b,high=low===a?b:a;
   const loadDrop=high[9][2]-low[9][2],legGain=low[9][3]-high[9][3];
   if(loadDrop<minP||legGain<minL||low[9][3]<minUsableLeg)continue;
   pairs.push({key,high,low,loadDrop,legGain,sameVenue:high[1]===low[1],newerLow:String(low[0])>String(high[0])});
  }
 }
 pairs.sort((a,b)=>b.legGain-a.legGain||b.loadDrop-a.loadDrop);
 return pairs.length?{...pairs[0],matches:pairs.length}:null;
}
function candidateKind(name,h,cohort){
 const rows=candidateRows(h),p=getPeak(rows,3),recent=avg(rows,3,3),ago=rows.slice(3,8).map(r=>r[9][3]).filter(num),olderMean=ago.length>=2?ago.reduce((a,b)=>a+b,0)/ago.length:null;
 const wet=rows.filter(r=>selectedWet(r[5])&&r[6]&&r[6]<=3&&num(r[9][3])&&r[9][3]>=70);
 const weak=rows.filter(r=>parsePass(r)[0]<=2&&r[6]>=7&&num(r[9][3])&&r[9][3]<45);
 const pursuit=rows.filter(r=>num(r[9][2])&&r[9][2]>=75&&num(r[9][3])&&r[9][3]<45&&num(r[9][4])&&r[9][4]<25);
 const dual=rows.filter(r=>num(r[9][3])&&r[9][3]>=75&&num(r[9][4])&&r[9][4]>=70);
 let kind=app.preset,match=false,evidence=null,reason='',sortValue=p?.[9][3]??null;
 if(kind==='revival'){match=!!p&&p[9][3]>=80&&recent.v!==null&&p[9][3]-recent.v>=25;evidence=p;reason=`脚最高${fmt(p?.[9][3])}／直近3走平均${fmt(recent.v)}`;}
 if(kind==='same'){match=$('venue').value!=='all'&&!!p&&p[9][3]>=80;evidence=p;reason=`${p?p[1]:''}で脚力${p?fmt(p[9][3]):'—'}`;}
 if(kind==='wet'){match=wet.length>0;evidence=wet[0];reason=`道悪好走実績${wet.length}走・脚${fmt(wet[0]?.[9][3])}（道悪適性判定ではない）`;}
 if(kind==='dirtwet'){const d=wet.filter(r=>r[3]==='ダ');match=d.length>0;evidence=d[0];reason=`ダート道悪好走実績${d.length}走・脚${fmt(d[0]?.[9][3])}（上昇幅未比較）`;}
 if(kind==='frontweak'){match=weak.length>=1;evidence=weak[0];reason=`先行後の7着以下・脚力45未満が${weak.length}走`;}
 if(kind==='pursuitweak'){match=pursuit.length>=1;evidence=pursuit[0];reason=`追走高値＋終い低下${pursuit.length}走`;}
 if(kind==='loadrelief'){
  const best=loadReliefPair(rows,Number($('load-pursuit-gap').value),Number($('load-leg-gain').value),Number($('load-min-leg').value));
  if(best){
   match=true;evidence=best.low;sortValue=best.legGain;
   const sign=n=>(n>=0?'+':'')+fmt(n);
   const describe=r=>`${date(r[0])} ${r[1]}${r[2]||''}R 追走${fmt(r[9][2])}・脚力${fmt(r[9][3])}`;
   reason=`【${best.key}】高負荷側 ${describe(best.high)} → 低負荷側 ${describe(best.low)}。追走${sign(-best.loadDrop)}・脚力${sign(best.legGain)}。${best.sameVenue?'同じ競馬場での比較。':'競馬場が異なるため再現性に注意。'}${best.newerLow?'後の走りで追走負荷が低い。':'時間順の負荷低下ではなく、過去走間の条件差。'}${best.high[12]||best.low[12]?'指数に出典差あり。':''}2走比較の仮説であり、クラス・相手関係・33・ペースを未調整。`;
  }
 }
 if(kind==='dual'){match=dual.length>0;evidence=dual[0];reason=`同一走の脚${fmt(dual[0]?.[9][3])} ギ${fmt(dual[0]?.[9][4])}`;}
 if(['turfstable','turfweak','dirtgain','dirtweak'].includes(kind)){
  const surface=kind.startsWith('turf')?'芝':'ダ';
  const pairs=goingPairs(h[2],surface).filter(x=>{
   const v=$('dist').value;
   if(v==='s'&&!x.band.startsWith('短'))return false;
   if(v==='m'&&!x.band.startsWith('マイル'))return false;
   if(v==='i'&&!x.band.startsWith('中'))return false;
   if(v==='l'&&!x.band.startsWith('長'))return false;
   if($('venue').value!=='all'&&![...x.good,...x.wet].some(r=>r[1]===$('venue').value))return false;
   const filter=discoverSurface();
   return filter==='all'||filter===surface;
  });
  const candidates=pairs.map(x=>({...x,ref:cohort[x.band],relative:x.delta-(cohort[x.band]?.median??0)}))
    .filter(x=>x.ref&&x.ref.n>=20&&Number.isFinite(x.relative));
  const rule=x=>kind==='turfstable'?x.relative>=8:
    kind==='turfweak'?x.relative<=-8:
    kind==='dirtgain'?x.relative>=8&&x.delta>0:
    x.relative<=-8;
  const ok=candidates.filter(rule).sort((a,b)=>kind.endsWith('weak')?a.relative-b.relative:b.relative-a.relative);
  const best=ok[0];
  if(best){
    match=true;evidence=best.wet[0];sortValue=kind.endsWith('weak')?-best.relative:best.relative;
    const sign=n=>(n>=0?'+':'')+fmt(n);
    const tag=kind==='turfstable'?'芝・道悪で相対的に下がりにくい':kind==='turfweak'?'芝・道悪で相対的な下げ幅が大きい':kind==='dirtgain'?'ダート・道悪で相対的な上昇幅が大きい':'ダート・道悪で相対的な上昇幅が小さい';
    reason=`${tag}（暫定）／${best.band}　良${best.good.length}走 平均${fmt(best.goodAvg)} → 道悪${best.wet.length}走 平均${fmt(best.wetAvg)}。自身の変化${sign(best.delta)}／他馬の変化中央値${sign(best.ref.median)}（相対差${sign(best.relative)}）${best.wet.length<2?'・道悪1走のため要検証':''}`;
  }
 }
 return match?{name,n:rows.length,evidence,reason,peak:sortValue}:null;
}
function renderDiscover(){
 $('load-relief-controls').classList.toggle('hidden',app.preset!=='loadrelief');
 const scoped=scopedRunners(),all=app.db;
 const nameList=scoped.scope==='all'?Object.keys(all):[...scoped.entries.keys()];
 const cohort=app.preset.startsWith('turf')?goingCohort('芝'):['dirtgain','dirtweak'].includes(app.preset)?goingCohort('ダ'):{};
 let candidates=[];
 for(const name of nameList){const h=all[name];if(!h)continue;const c=candidateKind(name,h,cohort);if(c){c.entry=scoped.entries.get(name);candidates.push(c)}}
 candidates.sort((a,b)=>(b.peak??-999)-(a.peak??-999));
 $('found-count').textContent=`${candidates.length.toLocaleString()}頭`;
 const targetLabel={week:'開催週',race:'選択レース',day:'選択日',all:'全登録馬'}[scoped.scope];
 const surfaced=discoverSurface();const known=nameList.filter(name=>!!all[name]).length;
 const sourceLine=scoped.scope==='all'?`DB登録 ${known.toLocaleString()}頭`:`${app.raceDate||'日付未設定'} ${targetLabel}の出走馬 ${nameList.length.toLocaleString()}頭（指数DBに履歴あり ${known.toLocaleString()}頭）`;
 $('discover-target-summary').textContent=`${sourceLine}　／　指数：${surfaced==='all'?'芝・ダ両方':surfaced||'不明'}　／　該当 ${candidates.length}頭`;
 let arr=candidates.slice(0,app.discoveryLimit);
 $('candidates').innerHTML=arr.map(c=>`<button class="candidate" data-horse="${safe(c.name)}"><strong>${safe(c.name)}</strong><span class="micro">対象${c.n}走</span><p class="reason">${safe(c.reason)}</p><div class="micro">${c.entry?safe(c.entry.day+' '+c.entry.venue+' '+c.entry.no+'R '+(c.entry.race||''))+' ／ ':''}根拠：${c.evidence?safe(runSummary(c.evidence)):'—'}</div></button>`).join('')||'<p class="hint">該当馬がいません。検索対象の開催週・芝ダ・道悪条件を調整してください。</p>';
 document.querySelectorAll('[data-horse]').forEach(b=>b.onclick=()=>{nav('horse');selectHorse(b.dataset.horse,true)});
 $('more-candidates').classList.toggle('hidden',candidates.length<=app.discoveryLimit);
}
function init(){let meta=app.meta||{};$('stats-h').textContent=(meta.horses||Object.keys(app.db).length).toLocaleString();$('stats-r').textContent=(meta.runs||Object.values(app.db).reduce((x,h)=>x+h[2].length,0)).toLocaleString();$('stats-source').textContent=(meta.source_count||'—')+'冊';$('last-asof').textContent=meta.as_of||'—';initFilters();let names=Object.keys(app.db).sort((a,b)=>a.localeCompare(b,'ja'));let dl=$('names');dl.innerHTML=names.map(n=>`<option value="${safe(n)}"></option>`).join('');
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>nav(b.dataset.nav));$('search-btn').onclick=()=>lookup();$('query').addEventListener('keydown',e=>{if(e.key==='Enter')lookup()});$('query').addEventListener('change',()=>lookup());
 for(let id of ['surface','venue','dist','going'])$(id).onchange=()=>{renderHorse();if(app.tab==='discover')renderDiscover()};
 document.querySelectorAll('[data-avg]').forEach(b=>b.onclick=()=>{app.avgN=Number(b.dataset.avg);document.querySelectorAll('[data-avg]').forEach(x=>x.classList.toggle('on',x===b));renderHorse()});
 $('bar-index').onchange=e=>{app.chartIndex=Number(e.target.value);renderHorse()};$('preset').onchange=e=>{app.preset=e.target.value;app.discoveryLimit=32;if(app.preset.startsWith('turf'))$('discover-surface').value='芝';else if(app.preset.startsWith('dirt'))$('discover-surface').value='ダ';renderDiscover()};
 for(const id of ['load-pursuit-gap','load-leg-gain','load-min-leg'])$(id).onchange=()=>{app.discoveryLimit=32;renderDiscover()};
  for(const id of ['discover-scope','discover-surface','discover-wetlevel'])$(id).onchange=()=>{app.discoveryLimit=32;renderDiscover()};$('more-candidates').onclick=()=>{app.discoveryLimit+=40;renderDiscover()};
 $('file-input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;$('upload-status').textContent='読み込み中…';try{let parsed=JSON.parse(await f.text());if(parsed.horses&&parsed.meta&&Object.values(parsed.horses)[0]?.runs){let compact={};for(let [name,h] of Object.entries(parsed.horses))compact[name]=[h.sex,h.age_as_of_latest_paper,h.runs.map(r=>[r.date,r.venue,r.race_no,r.surface,r.distance,r.going,r.finish,r.passing,r.last3f,keys.map(k=>r.indices?.[k]??null),(r.race_name||'').split('　')[0].slice(0,25),r.sources?.length||1,r.conflicts||null])];parsed={meta:parsed.meta,horses:compact};}if(!parsed.horses||Object.keys(parsed.horses).length<1||!Array.isArray(Object.values(parsed.horses)[0]?.[2]))throw Error('対応するCHARANIZE DB形式ではありません');app.db=parsed.horses;app.meta=parsed.meta;initFilters();init();selectHorse(app.db[app.current]?app.current:Object.keys(app.db)[0]);$('upload-status').textContent=`${f.name} を読み込みました。更新は現在の画面内に反映されています。保持するには更新済みHTMLの再生成が必要です。`;}catch(err){$('upload-status').textContent='読み込めませんでした：'+err.message}};
 $('evidence-dialog').querySelector('[data-close]').onclick=()=>$('evidence-dialog').close();
 let start=decodeURIComponent(location.hash.replace(/^#/,'')),def=app.db[start]?start:app.db['アージュドール']?'アージュドール':names[0];selectHorse(def,true);
 }

// v0.4: source newspaper race -> runners -> one-tap horse analysis
const RACE_INDEX=RACE_SOURCE;
app.races=RACE_INDEX.races||{};app.raceDate='';app.raceVenue='';app.raceNo='';app.raceKey='';app.cutoff='';
function raceEntries(){return Object.keys(app.races).map(k=>{const [day,venue,no]=k.split('|');return {key:k,day,venue,no:Number(no),card:app.races[k]}}).sort((a,b)=>b.day.localeCompare(a.day)||a.venue.localeCompare(b.venue,'ja')||a.no-b.no)}
function activeRace(){return app.races[app.raceKey]||null}
function currentRunners(){return activeRace()?.[3]||[]}
function initRaces(keep=false){
 const entries=raceEntries(),dates=[...new Set(entries.map(e=>e.day))];
 if(!entries.length){$('race-title').textContent='登録済みの出走表なし';return}
 const dd=$('race-date');dd.innerHTML=dates.map(d=>`<option value="${safe(d)}">${safe(d.slice(0,4)+'年'+Number(d.slice(5,7))+'月'+Number(d.slice(8,10))+'日')}</option>`).join('');
 if(!keep||!dates.includes(app.raceDate))app.raceDate=dates[0];dd.value=app.raceDate;
 let dayItems=entries.filter(e=>e.day===app.raceDate),venues=[...new Set(dayItems.map(e=>e.venue))];
 if(!keep||!venues.includes(app.raceVenue))app.raceVenue=venues.includes('東京')?'東京':venues[0];
 dd.onchange=e=>{app.raceDate=e.target.value;app.raceVenue='';app.raceNo='';renderRaces(true)};
 renderRaces(!keep);
}
function renderRaces(pickFirst=false){
 let all=raceEntries(),dd=$('race-date');if(dd.value!==app.raceDate)dd.value=app.raceDate;
 let daily=all.filter(e=>e.day===app.raceDate),venues=[...new Set(daily.map(e=>e.venue))].sort((a,b)=>(['東京','京都','新潟','中山','阪神','中京','福島','小倉','札幌','函館'].indexOf(a)-['東京','京都','新潟','中山','阪神','中京','福島','小倉','札幌','函館'].indexOf(b)));
 if(!venues.includes(app.raceVenue))app.raceVenue=venues[0]||'';
 $('race-venues').innerHTML=venues.map(v=>`<button type="button" class="${v===app.raceVenue?'active':''}" data-venue="${safe(v)}">${safe(v)}</button>`).join('');
 $('race-venues').querySelectorAll('button').forEach(b=>b.onclick=()=>{app.raceVenue=b.dataset.venue;app.raceNo='';renderRaces(true)});
 let list=daily.filter(e=>e.venue===app.raceVenue).sort((a,b)=>a.no-b.no);
 if(!list.some(e=>e.no===Number(app.raceNo)))app.raceNo=list.find(e=>e.no===11)?.no||list[0]?.no;
 $('race-numbers').innerHTML=list.map(e=>`<button type="button" data-race="${e.no}" class="${e.no===Number(app.raceNo)?'active':''}">${e.no}R ${safe(e.card[0]||'')}</button>`).join('');
 $('race-numbers').querySelectorAll('button').forEach(b=>b.onclick=()=>{app.raceNo=Number(b.dataset.race);renderRaces(true)});
 const activeChip=$('race-numbers').querySelector('.active');if(activeChip){const strip=$('race-numbers');strip.scrollLeft=activeChip.offsetLeft-strip.offsetLeft-strip.clientWidth/2+activeChip.offsetWidth/2;}
 app.raceKey=`${app.raceDate}|${app.raceVenue}|${app.raceNo}`;
 if(app.compareRaceKey!==app.raceKey){app.compareList=[];app.compareRaceKey=app.raceKey;}

 let card=activeRace();if(!card){$('race-title').textContent='レース未登録';$('race-horses').innerHTML='';return}
 app.cutoff=app.raceDate;
 $('race-title').textContent=`${app.raceVenue} ${app.raceNo}R  ${card[0]}`;
 $('race-detail').textContent=`${card[1]||'条件未収録'}${card[2]||'—'}m ／ ${card[3].length}頭 ／ ${app.raceDate}の予想時点`;
 if(pickFirst||!card[3].some(x=>x[1]===app.current)){
   $('surface').value=['芝','ダ'].includes(card[1])?card[1]:'all';$('venue').value='all';$('dist').value='all';$('going').value='all';
   const starter=card[3].find(x=>app.db[x[1]])||card[3][0];app.current='';if(starter)selectRaceHorse(starter[1],false);
 }
 renderRaceHorses();
}
function selectRaceHorse(name,scrollToDetails=true){
 if(!name)return;
 app.current=name;
 const c=activeRace();if(c){const surface=c[1];if(['芝','ダ'].includes(surface)&&$('surface').value==='all')$('surface').value=surface;}
 if(app.db[name])selectHorse(name,false);
 else{$('horse-title').textContent=name;$('horse-meta').textContent='過去指数がDBに未収録';$('horse-condition').textContent='指数未収録';['metrics','diagnosis','curve','plot-legend','condition-bars','rows'].forEach(id=>$(id).innerHTML='');$('run-count').textContent='0走';$('average-caption').textContent='この馬について一致する過去指数がありません。推測で補完しません。';$('data-warning').textContent='';}
 renderRaceHorses();
 if(scrollToDetails&&window.innerWidth<741){$('horse-title').scrollIntoView({block:'start',behavior:'smooth'});}
}
function renderRaceHorses(){
 const c=activeRace();if(!c)return;const runners=c[3];let idx=runners.findIndex(x=>x[1]===app.current);
 $('race-horses').innerHTML=runners.map(([no,name])=>{let found=app.db[name];let prior=found?.[2]?.filter(r=>r[0]&&r[0]<app.raceDate)||[];let label=prior.length?`${prior.length}走の指数履歴`:'過去指数未収録';let picked=app.compareList.includes(name);return `<div class="horse-choice"><button type="button" data-horse="${safe(name)}" class="${name===app.current?'active':''}"><span class="hn"><span class="horse-n">${no??'—'}</span>${safe(name)}</span><span class="horse-hint">${label}</span></button><button type="button" data-pick="${safe(name)}" aria-pressed="${picked}" class="add-compare ${picked?'selected':''}" ${!picked&&app.compareList.length>=3?'disabled':''}>${picked?'✓ 比較中・解除':'＋ 比較'}</button></div>`}).join('');
 $('race-horses').querySelectorAll('button[data-horse]').forEach(b=>b.onclick=()=>selectRaceHorse(b.dataset.horse));
 $('race-horses').querySelectorAll('button[data-pick]').forEach(b=>b.onclick=()=>toggleCompare(b.dataset.pick));
 renderPickedCompare();
 $('horse-position').textContent=idx<0?'出走馬から選択':`${idx+1} / ${runners.length}頭`;
 $('hero-race-position').textContent=idx<0?'全馬検索':`${idx+1} / ${runners.length}頭`;
 const herop=$('hero-prev'),heron=$('hero-next');herop.disabled=runners.length<2;heron.disabled=runners.length<2;herop.onclick=()=>selectRaceHorse(runners[(idx-1+runners.length)%runners.length][1],false);heron.onclick=()=>selectRaceHorse(runners[(idx+1)%runners.length][1],false);
 let prev=$('horse-previous'),next=$('horse-next');prev.disabled=runners.length<2;next.disabled=runners.length<2;
 prev.onclick=()=>selectRaceHorse(runners[(idx-1+runners.length)%runners.length][1]);next.onclick=()=>selectRaceHorse(runners[(idx+1)%runners.length][1]);
 if($('race-comparison-open')?.open)renderRaceComparison();
 const details=document.querySelector('.race-comparison');if(details?.open)renderRaceComparison();
}

function toggleCompare(name){
 if(!currentRunners().some(x=>x[1]===name))return;
 if(app.compareList.includes(name))app.compareList=app.compareList.filter(n=>n!==name);
 else if(app.compareList.length<3)app.compareList.push(name);
 else return;
 renderRaceHorses();
}
function compareRows(name){
 const c=activeRace(),h=app.db[name]; if(!c||!h)return [];
 return h[2].filter(r=>r[0]&&r[0]<app.raceDate&&(['芝','ダ'].includes(c[1])?r[3]===c[1]:true));
}
function renderPickedCompare(){
 const output=$('picked-comparison'),summary=$('picked-summary');
 if(!output||!summary)return;
 $('pick-counter').textContent=app.compareList.length+' / 3頭';
 const c=activeRace(),numByName=Object.fromEntries((c?.[3]||[]).map(([no,n])=>[n,no??'—']));
 summary.innerHTML=app.compareList.map(n=>`<span class="pick-tag">${safe(numByName[n])} ${safe(n)}</span>`).join('');
 if(app.compareList.length<2){output.innerHTML='';$('pick-help').textContent='出走馬の「＋ 比較」を押し、2〜3頭を選んでください。';return;}
 $('pick-help').textContent='同じ芝・ダートの過去走を比較。各馬の直近5走平均と10走最高値は別々に表示しています。';
 let cols=app.compareList.map(n=>({name:n,rows:compareRows(n)})),rows=[];
 const cell=(r,kind)=>{
  if(!r.rows.length)return '未収録';
  if(kind==='n')return `${r.rows.length}走`;
  let i=kind.slice(1)*1;
  if(kind.startsWith('a')){const v=avg(r.rows,i,5);return v.v===null?`標本不足（${v.n}走）`:`${fmt(v.v)}（${v.n}走）`}
  if(kind.startsWith('p')){let values=r.rows.map(x=>x[9][i]).filter(num);return values.length?fmt(Math.max(...values)):'—'}
  return '—'
 };
 const add=(label,kind)=>rows.push(`<tr><td>${label}</td>${cols.map(r=>`<td>${cell(r,kind)}</td>`).join('')}</tr>`);
 add('指数収録数','n');
 for(const [i,key] of labels.entries())add(`${safe(key)}・5走平均`,'a'+i);
 for(const [i,key] of labels.entries())add(`${safe(key)}・10走最高`,'p'+i);
 output.innerHTML=`<div class="picked-grid"><table><thead><tr><th>比較項目</th>${cols.map(r=>`<th>${safe(numByName[r.name])} ${safe(r.name)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div><div class="picked-note">※レース前に得られた指数のみ。芝・ダートは混合せず、平均3走未満は標本不足。追走指数は負荷経験であり、総合能力順位ではありません。別競馬場・異距離の高指数をそのまま今回へ適用しません。</div>`;
}
function renderRaceComparison(){
 const card=activeRace();if(!card)return;
 const text=card[3].map(([no,name])=>{
 const horse=app.db[name];if(!horse)return `<button data-cmphorse="${safe(name)}" class="${app.current===name?'current':''}"><span class="cmp-title">${no??'—'} ${safe(name)}</span><span class="cmp-data">指数未収録</span></button>`;
 let rows=horse[2].filter(r=>r[0]&&r[0]<app.raceDate&&(!card[1]||r[3]===card[1]));let a=avg(rows,3,5),peak=getPeak(rows,4),note=rows.filter(r=>r[12]).length;
 return `<button data-cmphorse="${safe(name)}" class="${app.current===name?'current':''}"><span class="cmp-title">${no??'—'} ${safe(name)}</span><span class="cmp-data">脚5走平均：${a.v===null?'標本不足':fmt(a.v)}（${a.n}走） ／ ギア最高：${peak?fmt(peak[9][4]):'—'}</span><span class="cmp-warning">${rows.length}走の履歴 ${note?'・指数原本差異あり':''}</span></button>`;
 });
 $('race-compare').innerHTML='<div class="comparison-grid">'+text.join('')+'</div>';
 $('race-compare').querySelectorAll('button').forEach(b=>b.onclick=()=>selectRaceHorse(b.dataset.cmphorse));
}
function initRaceUX(){
 const details=document.querySelector('.race-comparison');details.addEventListener('toggle',()=>{if(details.open)renderRaceComparison()});
 const u=$('race-file-input');if(u)u.onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let p=JSON.parse(await f.text());if(!p.races||!Object.keys(p.races).length)throw Error('racesを含む出走表JSONではありません');app.races=p.races;initRaces(true);$('race-upload-status').textContent=`${f.name}：${Object.keys(app.races).length}レースを画面内へ反映（保存には再生成が必要）`;}catch(err){$('race-upload-status').textContent='読み込み失敗：'+err.message}};
 const originalLookup=lookup;lookup=function(){app.cutoff='';originalLookup();renderRaceHorses()};
 initRaces(false);
}

init();
initRaceUX();
})();