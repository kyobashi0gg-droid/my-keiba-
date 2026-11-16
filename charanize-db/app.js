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
// v0.6: Explain running style separately from the finishing result. Observational only.
// v0.7: Show only evidenced, horse-specific characteristics. No compulsory four-card report.
// Cross-check the horse's performance in race-wide 33 with its actual recorded position changes.
// Causal classifications (burst/sustained/gradual) still require sectionals or video.
function individualLapStory(name,rows){
 if(!name||!window.__CH_PRIVATE?.lapRuns?.byHorse)return null;
 const matches=lapMatches(name,rows);
 if(matches.length<2)return null;
 const signed=v=>(v>0?'+':'')+fmt(v);
 const pass=x=>parsePass(x.ch);
 const valid=matches.filter(x=>pass(x).length>=2);
 const wins=matches.filter(x=>Number(x.ch[6])>=1&&Number(x.ch[6])<=3);
 if(!valid.length||!wins.length)return null;
 const winsValid=valid.filter(x=>Number(x.ch[6])>=1&&Number(x.ch[6])<=3);
 const advance=winsValid.filter(x=>{const p=pass(x);return p[0]-p[p.length-1]>=2});
 const stay=winsValid.filter(x=>{const p=pass(x);return p[0]-p[p.length-1]<2});
 const early=winsValid.filter(x=>pass(x)[0]<=2);
 const later=winsValid.filter(x=>pass(x)[0]>=6);
 const poor=valid.filter(x=>Number(x.ch[6])>=7);
 const lo=Math.min(...wins.map(x=>x.raw[4])),hi=Math.max(...wins.map(x=>x.raw[4]));
 const observations=[];
 if(advance.length)observations.push('途中から順位を上げて3着以内'+advance.length+'走（例：'+pass(advance[0]).join('-')+'、実33'+signed(advance[0].raw[4])+'）');
 if(stay.length)observations.push('コーナー間の順位上昇が2つ未満でも3着以内'+stay.length+'走（例：'+pass(stay[0]).join('-')+'、実33'+signed(stay[0].raw[4])+'）');
 if(!observations.length)return null;
 let body='レース全体の実33'+signed(lo)+'〜'+signed(hi)+'で3着以内'+wins.length+'走。'+observations.join('。')+'。';
 if(advance.length&&stay.length)body+='途中進出と位置を大きく上げない競馬の両方で好走実績があります。';
 const gear= wins.filter(x=>num(x.ch[9]?.[4])&&x.ch[9][4]>=65);
 if(gear.length>=2){
  const a=Math.min(...gear.map(x=>x.raw[4])),b=Math.max(...gear.map(x=>x.raw[4]));
  body+='そのうちギア65以上'+gear.length+'走の実33は'+signed(a)+'〜'+signed(b)+'。';
 }
 if(poor.length>=2){
  const pLo=Math.min(...poor.map(x=>x.raw[4])),pHi=Math.max(...poor.map(x=>x.raw[4]));
  body+='一方7着以下'+poor.length+'走の実33は'+signed(pLo)+'〜'+signed(pHi)+'。ただし同じ位置取りや相手の強さを揃えないと、33による敗因とは言えません。';
 }
 const sharedVenues=[...new Set(wins.map(x=>x.raw[1]).filter(Boolean))];
 if(sharedVenues.length===1&&wins.length>=2)body+='好走は'+sharedVenues[0]+'に集中しており、他場での再現は別途確認が必要です。';
 body+='実33はレース全体の値で、馬自身の加速区間や瞬発・持続の型を確定するものではありません。';
 const refs=[...new Set([...advance.slice(0,2),...stay.slice(0,2),...poor.slice(0,1)].map(x=>x.ch))];
 return {title:'実33と位置取りから見た好走パターン',body,refs};
}
function characterInsights(rows){
 if(!rows.length)return '<p class="hint">対象の過去走がないため、馬キャラは判定できません。</p>';
 if(surfaces(rows).length>1)return '<p class="hint">芝・ダート混在では判定しません。芝かダートを選択してください。</p>';
 const band=r=>{const d=Number(r[4]);return !d?'距離不明':d<=1400?'1400m以下':d===1600?'1600m':d<=2200?'1800〜2200m':'2400m以上'};
 const groups=new Map();
 for(const r of rows){const k=band(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const [distanceBand,part]=[...groups].sort((a,b)=>b[1].length-a[1].length)[0];
 const positionData=part.map(r=>({r,p:parsePass(r)})).filter(x=>x.p.length);
 const nearFront=positionData.filter(x=>x.p[0]<=2);
 const fromBack=positionData.filter(x=>x.p[0]>=6);
 const mid=positionData.filter(x=>x.p[0]>=3&&x.p[0]<=5);
 const share=positionData.length;
 const good=r=>Number(r[6])>=1&&Number(r[6])<=3;
 const poor=r=>Number(r[6])>=7;
 const cards=[];
 const evidence=new Set();
 function add(title,body,refs=[]){
  if(cards.length>=3)return;
  cards.push({title,body});
  refs.forEach(r=>evidence.add(r));
 }
 const style=share>=2&&nearFront.length>=2&&nearFront.length/share>=.5?'front':
  share>=2&&fromBack.length>=2&&fromBack.length/share>=.5?'back':
  share>=3&&mid.length>=2&&mid.length/share>=.5?'mid':
  share>=3&&nearFront.length&&fromBack.length?'variable':'unknown';
 const lapCharacter=individualLapStory(app.current,part);
 if(lapCharacter)add(lapCharacter.title,lapCharacter.body,lapCharacter.refs);
 if(style==='front'){
  const now=nearFront.map(x=>x.r);
  let body=part.length+'走中、通過順を確認できる'+share+'走のうち'+nearFront.length+'走で、最初の記録コーナーを2番手以内で通過。';
  const g=now.filter(good),b=now.filter(poor);
  if(g.length&&b.length)body+='同じ前方位置から3着以内'+g.length+'走と7着以下'+b.length+'走があり、先手を取ることだけでは成績差を説明できません。';
  else if(g.length>=2)body+='そのうち'+g.length+'走で3着以内。前方で運ぶ形は好走実績がありますが、最善のペース配分は未確認です。';
  else body+='逃げ・先行が基本的な位置取りの候補です。前で走った結果の良し悪しは断定しません。';
  add('先手を取って運ぶ傾向',body,now.slice(0,3));
 }else if(style==='back'){
  const now=fromBack.map(x=>x.r);
  let body='記録がある'+share+'走中'+fromBack.length+'走で、最初の記録コーナーが6番手以下。後方から脚を使う形が比較的多い馬です。';
  const before4=fromBack.filter(x=>x.p.length>=2&&x.p[0]-x.p[x.p.length-1]>=3);
  const stayBack=fromBack.filter(x=>x.p.length>=2&&x.p[x.p.length-1]>=6);
  if(before4.length>=2)body+='うち'+before4.length+'走は最終コーナーまでに3つ以上順位を上げており、道中〜コーナーで進出する傾向があります。';
  else if(stayBack.length>=2)body+='うち'+stayBack.length+'走は最終コーナーも6番手以下で、直線まで脚を温存する形が多くなっています。';
  add('差し・追込の位置取り',body,now.slice(0,3));
 }else if(style==='mid'){
  add('中団から運ぶ傾向','通過順を確認できる'+share+'走中'+mid.length+'走で、最初の記録コーナーが3〜5番手。逃げ切り型や最後方一気型とは区別して評価します。',mid.slice(0,3).map(x=>x.r));
 }else if(style==='variable'){
  add('位置取りが一定しないタイプ','前方2番手以内と6番手以下の両方の記録があります。どちらが能力を発揮しやすいかは、好走時と凡走時を同じ条件で比較して判定します。',[nearFront[0].r,fromBack[0].r]);
 }
 const highGear=part.filter(r=>num(r[9]?.[4])&&r[9][4]>=65);
 const highLeg=part.filter(r=>num(r[9]?.[3])&&r[9][3]>=75);
 const dual=part.filter(r=>num(r[9]?.[4])&&r[9][4]>=65&&num(r[9]?.[3])&&r[9][3]>=70);
 const legGearLow=part.filter(r=>num(r[9]?.[3])&&r[9][3]>=75&&num(r[9]?.[4])&&r[9][4]<60);
 const stress=part.filter(r=>num(r[9]?.[2])&&r[9][2]>=75&&num(r[9]?.[3])&&r[9][3]>=70);
 const canBeCloser=style==='back'||style==='mid';
 if(canBeCloser&&dual.length>=2){
  const named=dual.slice(0,3);
  let body='同じ走りで脚力70以上・ギア65以上を'+dual.length+'走記録。末脚と加速性能を同時に示した実績があります。';
  const venue=Object.create(null);for(const r of dual)venue[r[1]]=(venue[r[1]]||0)+1;
  const max=[...Object.entries(venue)].sort((a,b)=>b[1]-a[1])[0];
  if(max&&max[1]===dual.length&&dual.length>=2)body+='ただし、この高値は'+max[0]+'に集中しており、他場での再現性は別確認です。';
  body+='瞬間的な一脚なのか長く使える脚なのかは、区間ラップがないため未確定です。';
  add('加速力を伴う末脚が武器（候補）',body,named);
 }else if(canBeCloser&&legGearLow.length>=2){
  add('脚力型の差し・持続型を検証','脚力75以上でもギア60未満だった走りが'+legGearLow.length+'走あります。瞬間的な加速より一定の速い脚を続けるタイプという仮説は考えられますが、実際の持続区間を区間ラップで確認するまでは確定しません。',legGearLow.slice(0,3));
 }else if(canBeCloser&&highGear.length>=2){
  add('ギアを使える差し（候補）','ギア65以上を'+highGear.length+'走記録。加速力を発揮した履歴がありますが、瞬発的なキレか、徐々に加速するかはこの指数だけでは区別できません。',highGear.slice(0,3));
 }else if(canBeCloser&&highLeg.length>=2){
  add('繰り返し脚力を発揮','脚力75以上を'+highLeg.length+'走記録。末脚能力の再現例はありますが、末脚を使う時間の長さや加速過程は未確認です。',highLeg.slice(0,3));
 }
 if(style==='front'){
  const strongStart=part.filter(r=>num(r[9]?.[0])&&r[9][0]>=65);
  const strongAfter=part.filter(r=>num(r[9]?.[1])&&r[9][1]>=65);
  const strongBoth=part.filter(r=>num(r[9]?.[0])&&r[9][0]>=65&&num(r[9]?.[1])&&r[9][1]>=65);
  if(strongBoth.length>=2)add('初速とその後の先行力の両立','ゲートの出を含む逃指数65以上と、その後の先行指数65以上を同じ走りで'+strongBoth.length+'走記録。先手を取る能力構成が確認できます。',strongBoth.slice(0,3));
  else if(strongStart.length>=2)add('ゲートを含む初速が特徴','逃指数65以上を'+strongStart.length+'走記録。ゲートを含む初速が高い履歴です。楽にハナを取ったあとに緩めるべきかは、区間ラップを確認する必要があります。',strongStart.slice(0,3));
  else if(strongAfter.length>=2)add('二の脚・その後の先行力が特徴','先行指数65以上を'+strongAfter.length+'走記録。初速の後に前へ出る力を示していますが、ゲートで後手を踏んだ時の回復力は通過順だけでは確定できません。',strongAfter.slice(0,3));
 }
 if(cards.length<3&&stress.length>=2){
  add('高い追走負荷でも脚力を記録','追走指数75以上の負荷と脚力70以上を同時に'+stress.length+'走記録。負荷経験と末脚の両立は確認できますが、速いペースへの適性そのものは区間ラップと着差で別に評価します。',stress.slice(0,3));
 }
 // Show outcome contrasts only when both sides have relevant examples.
 const similar=style==='front'?nearFront.map(x=>x.r):style==='back'?fromBack.map(x=>x.r):style==='mid'?mid.map(x=>x.r):part;
 const positives=similar.filter(good),negatives=similar.filter(poor);
 if(cards.length<3&&positives.length>=2&&negatives.length>=2){
  const avg=(rr,k)=>{const vals=rr.map(r=>r[9]?.[k]).filter(num);return vals.length>=2?vals.reduce((a,b)=>a+b,0)/vals.length:null};
  const pLeg=avg(positives,3),nLeg=avg(negatives,3),pGear=avg(positives,4),nGear=avg(negatives,4);
  let body='似た位置取りの3着以内'+positives.length+'走と7着以下'+negatives.length+'走を比較。';
  if(pLeg!=null&&nLeg!=null)body+='脚力の平均は'+fmt(pLeg)+'対'+fmt(nLeg)+'。';
  if(pGear!=null&&nGear!=null)body+='ギアの平均は'+fmt(pGear)+'対'+fmt(nGear)+'。';
  body+='結果を分けた原因は指数だけでは特定できません。';
  add('同じ走り方でも成績が分かれる',body,[...positives.slice(0,2),...negatives.slice(0,2)]);
 }
 if(!cards.length){
  add('特徴判定は保留','今回の絞り込みでは同じ芝ダ・距離帯に'+part.length+'走の記録がありますが、位置取りや指数の再現性について十分な根拠が揃っていません。対象を広げるか過去走を確認してください。');
 }
 // Concise first-screen summary, detailed evidence only on demand.
 const validWithPosition=part.filter(r=>parsePass(r).length>=2);
 const progressed=validWithPosition.filter(r=>{const p=parsePass(r);return p[0]-p[p.length-1]>=2&&good(r)});
 const held=validWithPosition.filter(r=>{const p=parsePass(r);return p[0]-p[p.length-1]<2&&good(r)});
 const type=style==='front'?'逃げ・先行型':style==='back'?'後方差し型':style==='mid'?'中団差し型':style==='variable'?'位置取り自在型':'脚質判定保留';
 const mean=(rr,k)=>{const v=rr.map(r=>r[9]?.[k]).filter(num);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
 const leg=mean(part,3),gear=mean(part,4);
 const positionText=style==='back'?'序盤は後方から運ぶ傾向があります。':
  style==='front'?'序盤に前方を確保する競馬が中心です。':
  style==='mid'?'中団から競馬を進める傾向があります。':
  style==='variable'?'レースによって序盤の位置取りが変わります。':'位置取りの記録が不足しています。';
 const movementText=progressed.length>=2&&held.length?'途中から順位を上げても、位置を大きく変えずに運んでも好走実績があります。':
  progressed.length>=2?'コーナー間で順位を上げて好走する形が複数あります。':
  held.length>=2?'大きく位置を上げずに好走した実績が複数あります。':'進出のタイミングはまだ特定できません。';
 const strength=style==='front'?
  (part.filter(r=>num(r[9]?.[0])&&r[9][0]>=65).length>=2?'ゲートを含む初速を複数回発揮しています。':
   part.filter(r=>num(r[9]?.[1])&&r[9][1]>=65).length>=2?'その後の先行力を複数回発揮しています。':'初速と二の脚のどちらが武器かは未確定です。'):
  (leg!==null&&gear!==null&&dual.length>=2?'脚力とギアを同時に高水準で記録しています。':
   highLeg.length>=2?'末脚の高指数を繰り返し記録しています。':
   highGear.length>=2?'加速に関係するギアの高指数を複数回記録しています。':'末脚の特徴を判断する指数標本は限定的です。');
 const synopsis=positionText+movementText+strength;
 const lapRange=(()=>{
  const matched=lapMatches(app.current,part).filter(x=>good(x.ch));
  if(!matched.length)return '';
  const min=Math.min(...matched.map(x=>x.raw[4])),max=Math.max(...matched.map(x=>x.raw[4]));
  const signed=v=>(v>0?'+':'')+fmt(v);
  return '実33'+signed(min)+'〜'+signed(max)+'で3着以内'+matched.length+'走（レース全体値）。';
 })();
 const details=cards.map(x=>'<div class="chara-detail-row"><b>'+safe(x.title)+'</b><p>'+safe(x.body)+'</p></div>').join('');
 const selected=[...evidence];
 const evidenceHtml=selected.length?'<details class="chara-evidence"><summary>根拠の過去走を見る（'+selected.length+'走）</summary><ul>'+selected.map(r=>'<li>'+safe(runSummary(r))+'／通過 '+safe(r[7]||'—')+'／逃 '+fmt(r[9]?.[0])+'・先 '+fmt(r[9]?.[1])+'・追 '+fmt(r[9]?.[2])+'・脚 '+fmt(r[9]?.[3])+'・ギ '+fmt(r[9]?.[4])+'</li>').join('')+'</ul></details>':'';
 return '<div class="chara-observe-scope">対象：'+safe(part[0][3])+' '+safe(distanceBand)+'／'+part.length+'走</div>'+
 '<div class="horse-character-summary"><div class="horse-character-type">'+safe(type)+'</div>'+
 '<p class="horse-character-description">'+safe(synopsis)+'</p>'+
 (lapRange?'<p class="horse-character-lap">'+safe(lapRange)+'</p>':'')+
 '<p class="horse-character-caution">加速の瞬発型・持続型・漸進型は区間ラップ不足のため未確定です。</p></div>'+
 '<details class="horse-character-more"><summary>詳しい分析と判断根拠を開く（'+cards.length+'項目）</summary>'+details+evidenceHtml+'</details>'+
 '<p class="help-line">※逃指数はゲートを含む初速、先行指数はその後の先行力。コーナー順位の変化は個別の加速を直接示しません。</p>';
}
// Race-level 33 is supplied by MY KEIBA DB LAB. It is not an individual horse split.
function lapMatches(name,rows){
 const lib=window.CHARA_LAP_SYNC,pack=window.__CH_PRIVATE?.lapRuns;
 if(!lib||!pack?.byHorse)return [];
 const matched=[];
 for(const r of rows){
  const result=lib.match(name,r,pack);
  if(!result)continue;
  const x=result.data;
  const finish=Number(r[6]),sourceFinish=x[6];
  if(Number.isFinite(finish)&&finish>0&&sourceFinish!=null&&finish!==sourceFinish)continue;
  const going=x[9]==='稍重'?'稍':x[9]==='不良'?'不':x[9];
  const ownGoing=r[5]==='稍重'?'稍':r[5]==='不良'?'不':r[5];
  if(going&&ownGoing&&going!==ownGoing)continue;
  matched.push({ch:r,raw:x,courseConfirmed:result.courseConfirmed});
 }
 return matched;
}
function lapPanel(name,rows){
 const pack=window.__CH_PRIVATE?.lapRuns;
 if(!pack?.byHorse)return '<p class="hint">MY KEIBA DB LABの実33データはまだ取り込まれていません。「データ更新」から全件書き出しJSONを追加すると、指数新聞の同じ過去走と照合します。</p>';
 if(!rows.length)return '<p class="hint">この条件で表示する過去走がありません。</p>';
 const matches=lapMatches(name,rows);
 if(!matches.length)return '<p class="hint">表示中の過去走と実33を照合できませんでした。日付・競馬場・芝ダ・距離・着順・馬場の整合性を優先し、不確かな一致は表示しません。</p>';
 const good=matches.filter(x=>Number(x.ch[6])>=1&&Number(x.ch[6])<=3);
 const poor=matches.filter(x=>Number(x.ch[6])>=7);
 const avg33=a=>a.reduce((sum,x)=>sum+x.raw[4],0)/a.length;
 const signed=v=>(v>0?'+':'')+fmt(v);
 const summary=[];
 if(good.length>=2&&poor.length>=2){
  summary.push('3着以内'+good.length+'走の実33平均は'+signed(avg33(good))+'、7着以下'+poor.length+'走では'+signed(avg33(poor))+'。この差は結果との関連であり、33だけが原因とは断定できません。');
 }else if(good.length){
  const values=good.map(x=>x.raw[4]);
  summary.push('3着以内'+good.length+'走を確認。好走時の実33は'+signed(Math.min(...values))+'〜'+signed(Math.max(...values))+'。同クラス・同コースでの再現性は別に確認します。');
 }else{
  summary.push('表示した'+matches.length+'走に3着以内がないため、33の好走帯は判定しません。');
 }
 const gearCases=matches.filter(x=>num(x.ch[9]?.[4])&&x.ch[9][4]>=65);
 if(gearCases.length>=2){
  const lo=Math.min(...gearCases.map(x=>x.raw[4])),hi=Math.max(...gearCases.map(x=>x.raw[4]));
  summary.push('ギア指数65以上を記録した'+gearCases.length+'走のレース実33は'+signed(lo)+'〜'+signed(hi)+'。速い脚を使った区間の長さは未確認です。');
 }
 const courseProven=matches.filter(x=>x.courseConfirmed).length;
 const warning='実33はレース全体のラスト6F前半3F－後半3Fです。大逃げ・隊列分離では、この馬自身が受けた実効33と異なる可能性があります。レース全体の33だけでは中弛みや再加速の位置は特定できません。';
 const detail=matches.slice(0,12).map(x=>{
  const r=x.raw,ch=x.ch;
  return '<tr><td>'+safe(r[0])+'</td><td>'+safe(r[1]||ch[1])+'</td><td>'+safe(r[7]||'—')+'</td><td>'+safe(r[2])+safe(r[3])+'m</td><td>'+safe(ch[6]??'—')+'</td><td><strong>'+signed(r[4])+'</strong></td><td>'+safe(ch[7]||r[5]||'—')+'</td><td>'+safe(r[8]||'—')+'</td></tr>';
 }).join('');
 return '<div class="chara-observe-scope">指数と実33の照合：'+matches.length+' / '+rows.length+'走（競馬場確認済み'+courseProven+'走）</div>'+
 '<p class="lap-story-summary">'+safe(summary.join(' '))+'</p>'+
 '<details class="chara-evidence"><summary>照合した過去走・実33を見る（最大12走）</summary><div class="table-scroll"><table><thead><tr><th>日付</th><th>場</th><th>レース</th><th>条件</th><th>着</th><th>実33</th><th>通過順</th><th>レース総評</th></tr></thead><tbody>'+detail+'</tbody></table></div></details>'+
 '<p class="help-line">'+safe(warning)+'</p>';
}
function evidenceText(r){let vals=r[9];return `${runSummary(r)}：脚${fmt(vals[3])}、ギア${fmt(vals[4])}、先${fmt(vals[1])}、追${fmt(vals[2])}`;}
function renderEvidence(sig){return `<details class="evidence"><summary>根拠の過去走を確認 (${sig.refs.length}件表示)</summary><ul>${sig.refs.map(r=>`<li>${safe(evidenceText(r))}</li>`).join('')}</ul></details>`;}
function renderSignal(sig){return `<div class="tagitem ${sig.type==='pos'?'pos':sig.type==='neg'?'neg':'neutral'}"><b>${sig.type==='pos'?'＋':sig.type==='neg'?'－':'・'}</b>${safe(sig.label)}</div><div class="smallnote" style="margin:3px 0 7px">${safe(sig.desc)}</div>${renderEvidence(sig)}`;}
function initFilters(){let venues=new Set;Object.values(app.db).forEach(h=>h[2].forEach(r=>{if(r[1])venues.add(r[1])})); let cur=$('venue').value;$('venue').innerHTML='<option value="all">すべて</option>'+[...venues].sort((a,b)=>a.localeCompare(b,'ja')).map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(venues.has(cur))$('venue').value=cur;}
function selectHorse(name,reset=true){if(!app.db[name])return;app.current=name;$('query').value=name;if(reset){$('surface').value=surfaces(horseRows(name)).length===1?surfaces(horseRows(name))[0]:(horseRows(name)[0]?.[3]||'芝');$('venue').value='all';$('dist').value='all';$('going').value='all';}renderHorse();if(location.hash!==`#${encodeURIComponent(name)}`)history.replaceState(null,'',`#${encodeURIComponent(name)}`);}
function lookup(){let q=$('query').value.trim(),names=Object.keys(app.db);if(!q)return;let name=app.db[q]?q:names.find(x=>x.includes(q))||names.find(x=>x.toLowerCase().includes(q.toLowerCase()));if(name)selectHorse(name,true);else $('horse-title').textContent='該当する馬がありません';}
function svgChart(rows){let n=rows.length,series=app.chartSeries,w=680,h=250,pad=36;let rev=rows.slice().reverse();const x=i=>pad+(w-2*pad)*(n===1?.5:i/(n-1));let ys=rev.flatMap(r=>series.map(i=>r[9][i])).filter(num);let min=Math.min(-10,...ys),max=Math.max(110,...ys);min=Math.floor(min/20)*20;max=Math.ceil(max/20)*20;const y=v=>h-pad-(v-min)/(max-min)*(h-2*pad);const lineVals=[];for(let z=min;z<=max;z+=20){lineVals.push(`<line x1="${pad}" x2="${w-pad}" y1="${y(z)}" y2="${y(z)}" stroke="#dfe9e2"/><text x="${pad-7}" y="${y(z)+4}" text-anchor="end" font-size="12" fill="#7a8f83">${z}</text>`)}let paths=[];series.forEach(i=>{let part='',prev=false;rev.forEach((r,j)=>{let val=r[9][i];if(num(val)){part+=(prev?' L':' M')+x(j).toFixed(1)+','+y(val).toFixed(1);prev=true;paths.push(`<circle cx="${x(j)}" cy="${y(val)}" r="3.6" fill="${colors[i]}"><title>${safe(date(r[0]))} ${labels[i]} ${fmt(val)}</title></circle>`)}else prev=false});paths.push(`<path d="${part}" fill="none" stroke="${colors[i]}" stroke-width="2.8" stroke-linejoin="round"/>`)});let dates=rev.length>1?`<text x="${pad}" y="${h-8}" font-size="11" fill="#788b7e">${date(rev[0][0])}</text><text x="${w-pad}" text-anchor="end" y="${h-8}" font-size="11" fill="#788b7e">${date(rev[rev.length-1][0])}</text>`:'';return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="直近10走の指数推移">${lineVals.join('')}${paths.join('')}${dates}</svg>`;}
function bars(rows,idx){let groups=[['場別',r=>r[1]],['距離別',r=>r[4]?r[4]+'m':'不明'],['馬場別',r=>r[5]]];return groups.map(([title,key])=>{let map={};for(let r of rows){let v=r[9][idx];if(!num(v))continue;let k=key(r);(map[k]||(map[k]=[])).push(v);}let arr=Object.entries(map).map(([k,vs])=>({k,n:vs.length,mean:vs.reduce((a,b)=>a+b,0)/vs.length})).sort((a,b)=>b.n-a.n||b.mean-a.mean).slice(0,5);return `<div class="chartcard"><div class="section-title" style="font-size:13px;margin:0 0 10px">${title} ${labels[idx]}指数</div><div class="factorlist">${arr.map(x=>`<div class="factor"><span>${safe(x.k)}<small>${x.n}走</small></span><div class="bartrack"><i style="width:${Math.max(2,Math.min(100,x.mean))}%"></i></div><b style="text-align:right">${x.n>=2?fmt(x.mean):'<small>1走</small>'}</b></div>`).join('')||'<span class="muted">対象なし</span>'}</div></div>`}).join('')}
// The same run may be printed in different weekly issues. Compare the adopted
// value and all recorded variants; a difference is not an ability penalty.
function largeSourceDifference(r){
 const conflicts=r?.[12],base=r?.[9];
 let largest=0, affected=[];
 if(!conflicts||!base)return {large:false,max:0,affected:[]};
 for(const [key,versions] of Object.entries(conflicts)){
  const idx=keys.indexOf(key);
  if(idx<0||!Array.isArray(versions))continue;
  const values=[base[idx],...versions.map(v=>v?.v)].filter(num);
  if(values.length<2)continue;
  const gap=Math.max(...values)-Math.min(...values);
  if(gap>=10){
   largest=Math.max(largest,gap);
   affected.push({key,label:labels[idx],gap});
  }
 }
 return {large:affected.length>0,max:largest,affected};
}
function pastSourceDifferences(rows){
 return (rows||[]).filter(r=>(!app.cutoff||!r[0]||r[0]<app.cutoff)&&largeSourceDifference(r).large);
}
function sourceDetails(r){
 const c=r[12];if(!c||!Object.keys(c).length)return '';
 const conflict=largeSourceDifference(r);
 const heading=conflict.large
  ?`⚠ 指数差10以上・要原本確認（最大${fmt(conflict.max)}）`
  :'原本数値の差異・詳細を見る';
 const description=conflict.large
  ?'この過去走は同じ馬・同じレースで指数差10以上。算定基準更新だけでは説明できない可能性があるため、発行元確認まで採用値を自動変更しません。現在の平均・条件検索は採用値に基づく暫定計算です。馬の能力に対する減点ではありません。'
  :'同一過去走の別版に数値差があります。基準タイムや馬場差の更新による変動の可能性があり、直ちに誤記とは判断しません。';
 const details=Object.entries(c).map(([key,arr])=>{
  const i=keys.indexOf(key);
  const adopted=i>=0?r[9]?.[i]:null;
  const variants=Array.isArray(arr)?arr:[];
  const gap=conflict.affected.find(x=>x.key===key);
  return `<li>${safe(i<0?key:labels[i])}：現行採用値 ${fmt(adopted)} ／ 別版 ${variants.map(v=>safe(v.f)+'＝'+fmt(v.v)).join('、')}${gap?` ／ <strong>最大差 ${fmt(gap.gap)}</strong>`:''}</li>`;
 }).join('');
 return `<details class="single-source-warning"><summary${conflict.large?' style="color:#a35900;font-weight:800"':''}>${heading}</summary><div class="notice">${description}<ul>${details}</ul></div></details>`;
}
function renderRows(rows){return rows.map((r,i)=>{let notes=rowTags(r);return `<tr id="run-${i}"><td>${safe(date(r[0]))}</td><td>${safe(r[1])}${r[2]||''}R<br><small>${safe(r[10]||'')}</small></td><td>${safe(r[3])}${r[4]}m</td><td>${safe(r[5])}</td><td>${r[6]??'—'}</td><td>${safe(r[7]||'—')}</td><td>${safe(r[8]||'—')}</td>${r[9].map(v=>`<td class="num ${!num(v)?'':v>=90?'hi':v<0?'low':''}">${fmt(v)}</td>`).join('')}<td class="notes-cell">${notes.filter(x=>x.type!=='warn').length?notes.filter(x=>x.type!=='warn').map(x=>`<span class="mini ${x.type==='neg'?'neg':''}">${safe(x.label)}</span>`).join(''):(r[12]?'':'<span class="muted">明確な特徴なし</span>')}${sourceDetails(r)}</td></tr>`}).join('')}
function renderHorse(){let horse=getHorse(app.current);if(!horse)return;let all=horse[2],rows=all.filter(filt);let different=surfaces(rows).length>1;
 $('horse-title').textContent=app.current;const majorSourceRows=pastSourceDifferences(all);
  $('horse-meta').textContent=`${safe(horse[0]||'性別未記録')}・${horse[1]||'?'}歳（新聞時点）　収録${all.length}走・表示${rows.length}走`+(majorSourceRows.length?`　⚠指数差10以上 ${majorSourceRows.length}走・要確認`:'');$('horse-condition').textContent=rows.length?`${rows.length}走が条件一致`:'該当する走なし';
 $('average-caption').textContent=`条件一致の新しい${app.avgN}走で平均を計算。最低3走・各指数の欠損値は除外。過去10走の最高値とは分離。`;
 $('metrics').innerHTML=labels.map((name,i)=>{let a=avg(rows,i,app.avgN),peak=getPeak(rows,i);return `<div class="metric"><span>${name}</span><b>${different?'—':fmt(a.v)}</b><small>${different?'芝ダ混在':a.v===null?'標本不足':`n=${a.n}`}</small><small>最高 ${peak?fmt(peak[9][i]):'—'}</small></div>`}).join('');
 let positive=[],negative=[],neutral=[];if(!different){let signals=getSignals(rows);positive=signals.filter(x=>x.type==='pos');negative=signals.filter(x=>x.type==='neg');neutral=signals.filter(x=>x.type==='neutral');}
 $('character-report').innerHTML=characterInsights(rows);
 $('lap-report').innerHTML=lapPanel(app.current,rows);
 $('diagnosis').innerHTML=`<div class="diagblock"><strong style="color:#137e5d">＋ 走れる条件・強み</strong>${positive.map(renderSignal).join('')||'<span class="hint">条件一致の過去走から、確認できる強い根拠はまだありません。</span>'}</div><div class="diagblock"><strong style="color:#ab5146">－ 注意したい条件・弱点</strong>${negative.map(renderSignal).join('')||'<span class="hint">明確なマイナス傾向は未検出。弱点がないという意味ではありません。</span>'}</div>${neutral.length?`<div class="diagblock" style="grid-column:1/-1"><strong>検証・保留</strong>${neutral.map(renderSignal).join('')}</div>`:''}`;
 $('series-picker').innerHTML=labels.map((label,i)=>`<button class="${app.chartSeries.includes(i)?'on':''}" data-s="${i}" style="--series:${colors[i]}">${label}</button>`).join('');
 $('series-picker').querySelectorAll('button').forEach(b=>b.onclick=()=>{let n=Number(b.dataset.s);if(app.chartSeries.includes(n)) {if(app.chartSeries.length>1)app.chartSeries=app.chartSeries.filter(x=>x!==n);}else app.chartSeries=[...app.chartSeries,n];renderHorse()});
 $('curve').innerHTML=rows.length?svgChart(rows):'<p class="hint">一致する履歴なし</p>';
 $('plot-legend').innerHTML=app.chartSeries.map(i=>`<span style="--c:${colors[i]}">${labels[i]}</span>`).join('');
 $('bar-index').value=String(app.chartIndex);$('condition-bars').innerHTML=rows.length?bars(rows,app.chartIndex):'<p class="hint">一致する履歴なし</p>';
 $('run-count').textContent=`${rows.length} / ${all.length}走`;
 $('rows').innerHTML=renderRows(rows);
 $('data-warning').textContent=majorSourceRows.length
    ?`⚠ 要確認：この馬には同一レースの指数が10以上異なる過去走が${majorSourceRows.length}走あります。備考欄に具体的な差と出典を記載。採用値・平均・適性検索は暫定で、能力評価の減点ではありません。`
    :rows.some(r=>r[12])
     ?'表示中の過去走に新聞間の指数差があります。備考欄で採用値と別版の値を確認できます。小差は基準値更新の可能性があります。'
     :'過去走の指数は出典新聞に基づく暫定値です。';
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
 for(const name of nameList){const h=all[name];if(!h)continue;const c=candidateKind(name,h,cohort);if(c){c.entry=scoped.entries.get(name);c.largeSourceDiffCount=pastSourceDifferences(h[2]).length;candidates.push(c)}}
 candidates.sort((a,b)=>(b.peak??-999)-(a.peak??-999));
 $('found-count').textContent=`${candidates.length.toLocaleString()}頭`;
 const targetLabel={week:'開催週',race:'選択レース',day:'選択日',all:'全登録馬'}[scoped.scope];
 const surfaced=discoverSurface();const known=nameList.filter(name=>!!all[name]).length;
 const sourceLine=scoped.scope==='all'?`DB登録 ${known.toLocaleString()}頭`:`${app.raceDate||'日付未設定'} ${targetLabel}の出走馬 ${nameList.length.toLocaleString()}頭（指数DBに履歴あり ${known.toLocaleString()}頭）`;
 $('discover-target-summary').textContent=`${sourceLine}　／　指数：${surfaced==='all'?'芝・ダ両方':surfaced||'不明'}　／　該当 ${candidates.length}頭`;
 let arr=candidates.slice(0,app.discoveryLimit);
 $('candidates').innerHTML=arr.map(c=>`<button class="candidate" data-horse="${safe(c.name)}"><strong>${safe(c.name)}</strong><span class="micro">対象${c.n}走</span><p class="reason">${safe(c.reason)}</p>${c.largeSourceDiffCount?`<p class="micro" style="color:#a35900;font-weight:800">⚠ 同一過去走の指数差10以上：${c.largeSourceDiffCount}走（要確認・判定暫定）</p>`:''}<div class="micro">${c.entry?safe(c.entry.day+' '+c.entry.venue+' '+c.entry.no+'R '+(c.entry.race||''))+' ／ ':''}根拠：${c.evidence?safe(runSummary(c.evidence)):'—'}</div></button>`).join('')||'<p class="hint">該当馬がいません。検索対象の開催週・芝ダ・道悪条件を調整してください。</p>';
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
 else{$('horse-title').textContent=name;$('horse-meta').textContent='過去指数がDBに未収録';$('horse-condition').textContent='指数未収録';['metrics','character-report','lap-report','diagnosis','curve','plot-legend','condition-bars','rows'].forEach(id=>$(id).innerHTML='');$('run-count').textContent='0走';$('average-caption').textContent='この馬について一致する過去指数がありません。推測で補完しません。';$('data-warning').textContent='';}
 renderRaceHorses();
 if(scrollToDetails&&window.innerWidth<741){$('horse-title').scrollIntoView({block:'start',behavior:'smooth'});}
}
function renderRaceHorses(){
 const c=activeRace();if(!c)return;const runners=c[3];let idx=runners.findIndex(x=>x[1]===app.current);
 $('race-horses').innerHTML=runners.map(([no,name])=>{let found=app.db[name];let prior=found?.[2]?.filter(r=>r[0]&&r[0]<app.raceDate)||[];let major=prior.filter(r=>largeSourceDifference(r).large).length;let label=(prior.length?`${prior.length}走の指数履歴`:'過去指数未収録')+(major?`　⚠指数差10以上${major}走・要確認`:'');let picked=app.compareList.includes(name);return `<div class="horse-choice"><button type="button" data-horse="${safe(name)}" class="${name===app.current?'active':''}"><span class="hn"><span class="horse-n">${no??'—'}</span>${safe(name)}</span><span class="horse-hint">${label}</span></button><button type="button" data-pick="${safe(name)}" aria-pressed="${picked}" class="add-compare ${picked?'selected':''}" ${!picked&&app.compareList.length>=3?'disabled':''}>${picked?'✓ 比較中・解除':'＋ 比較'}</button></div>`}).join('');
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
// Show the last completed import after a reload. Only metadata is stored, never PDF pages.
const lastImport=window.__CH_PRIVATE?.meta;
if(lastImport?.last_pdf_import && lastImport?.last_pdf_import_stats && $('upload-status')){
 const a=lastImport.last_pdf_import_stats;
 $('upload-status').textContent=`前回PDF: ${lastImport.last_pdf_import}｜追加${a.added||0}走・照合${a.matched||0}走・更新${a.horses||0}頭・指数差異${a.conflicts||0}件・指数未掲載${a.skipped||0}走。差異は既存値を維持しています。`;
}
})();