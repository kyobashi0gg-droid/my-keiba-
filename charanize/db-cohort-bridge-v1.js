/* Same-origin, read-only reference to CHARANIZE DB Lab's private IndexedDB.
   No cross-device sync, no network transfer, no DB writes. */
(function(){
'use strict';
const DB_NAME='CHARANIZE_DB_LAB_PRIVATE_V1',STORE='settings',KEY='private-pack';
const MODE_KEY='charanize-lab-class-cohort-source-v1';
const index={nige:0,sen:1,tsui:2,ashi:3,gear:4};
const venues={東:'東京',新:'新潟',京:'京都',阪:'阪神',中:'中山',小:'小倉',札:'札幌',函:'函館',名:'中京',福:'福島'};
let mode='auto',update=()=>{},last=0,loading=false,loaded=false,issue='この端末のDB LABは未確認',rows=[],total=0,known=0,horseCount=0;
try{let x=localStorage.getItem(MODE_KEY);if(['auto','db','paper'].includes(x))mode=x;}catch(_){}
function getClass(s){
 s=String(s||'').normalize('NFKC').replace(/ｸﾗｽ/g,'クラス');
 if(/障|ジャンプ/.test(s))return null;
 if(/(?:G1|GI|GⅠ)/i.test(s))return 'G1';
 if(/(?:G2|GII|GⅡ)/i.test(s))return 'G2';
 if(/(?:G3|GIII|GⅢ)/i.test(s))return 'G3';
 if(/(?:OP|オープン|\(L\)|（L）)/i.test(s))return 'OP/L';
 for(const c of ['3勝','2勝','1勝','未勝利','新馬'])if(s.includes(c))return c;
 return null;
}
function courseVenue(s){return venues[s]||s||'';}
function classify(pack,r){
 const own=getClass(r[10]);if(own)return own;
 const card=pack.races?.[String(r[0]||'')+'|'+courseVenue(r[1])+'|'+String(r[2]||'')];
 return card&&typeof card==='object'?getClass(card.name||card.race_name||card.class_name):null;
}
function compile(pack){
 if(!pack?.horses||typeof pack.horses!=='object'||Array.isArray(pack.horses))throw Error('保存形式が一致しません');
 let result=[],set=new Set(),all=0,identified=0;
 for(const [horse,h] of Object.entries(pack.horses)){
   if(!Array.isArray(h?.[2]))continue;
   for(const r of h[2]){
     if(!Array.isArray(r)||!['芝','ダ'].includes(r[3])||!Number.isFinite(Number(r[4]))||!Array.isArray(r[9]))continue;
     const vals=r[9].map(v=>typeof v==='number'&&Number.isFinite(v)?v:null);
     if(!vals.some(v=>v!==null))continue;
     const id=[horse,r[0],courseVenue(r[1]),r[2],r[3],r[4]].join('|');
     if(set.has(id))continue;set.add(id);all++;
     const cls=classify(pack,r);if(!cls)continue;
     identified++;
     result.push({horse,cls,sf:r[3],dist:Number(r[4]),vals});
   }
 }
 return {rows:result,total:all,known:identified,horseCount:Object.keys(pack.horses).length};
}
function openPack(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(Error('IndexedDB非対応'));return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{try{req.transaction.abort();}catch(_){}};
  req.onerror=()=>reject(Error('このブラウザにDB LABの保存データがありません'));
  req.onsuccess=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains(STORE)){db.close();reject(Error('保存領域が見つかりません'));return;}
    const q=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
    q.onsuccess=()=>{const data=q.result;db.close();data?.horses?resolve(data):reject(Error('登録済みDBが見つかりません'));};
    q.onerror=()=>{db.close();reject(Error('DB LABの読み取りに失敗'));};
  };
 });
}
async function load(cb,force=false){
 if(typeof cb==='function')update=cb;
 if(loading||(!force&&Date.now()-last<3000))return;
 loading=true;update();
 try{
  const parsed=compile(await openPack());
  ({rows,total,known,horseCount}=parsed);
  loaded=true;issue='';
 }catch(e){loaded=false;rows=[];issue=String(e?.message||e);}
 last=Date.now();loading=false;update();
}
function cohort(r,deps){
 const {targetClass,groupDistance,measure,labs,isJump}=deps;
 if(!loaded)return {valid:false,source:'db',reason:issue,className:null};
 if(isJump(r))return {valid:false,source:'db',reason:'障害は標本対象外',className:null};
 const cls=targetClass(r),sf=String(r.condition||'').charAt(0);
 const dist=Number((String(r.condition||'').match(/\d+/)||[])[0]);
 if(!cls||!['芝','ダ'].includes(sf)||!dist)return {valid:false,source:'db',reason:'クラス・芝ダ・距離が特定できません',className:cls};
 const data=rows.filter(o=>o.cls===cls&&o.sf===sf);
 const exact=data.filter(o=>o.dist===dist),near=data.filter(o=>groupDistance(o.dist)===groupDistance(dist));
 let chosen,scope;
 if(exact.length>=20){chosen=exact;scope='同クラス・同芝ダ・同距離';}
 else if(near.length>=30){chosen=near;scope='同クラス・同芝ダ・同距離帯';}
 else if(data.length>=40){chosen=data;scope='同クラス・同芝ダ（距離混合）';}
 else return {valid:false,className:cls,source:'db',reason:'DB LABのクラス判明走が不足：同クラス'+data.length+'走、同距離'+exact.length+'走。'};
 const stats={};
 for(const [k] of labs)stats[k]=measure(chosen.map(o=>o.vals[index[k]]).filter(Number.isFinite));
 return {valid:true,className:cls,source:'db',stats,scope,records:chosen.length,horses:new Set(chosen.map(o=>o.horse)).size};
}
function choose(r,paper,deps){
 if(mode==='paper')return {...paper,source:'paper'};
 const db=cohort(r,deps);
 if(mode==='db'||db.valid)return db;
 return {...paper,source:'paper',dbReason:db.reason};
}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function decorate(root,co){
 if(!root)return;
 const p=document.createElement('div');
 p.style.cssText='margin:10px 0 14px;padding:11px 12px;border:1px solid #d3e5e0;border-radius:10px;background:#f7fbfa;font-size:12px;line-height:1.7;color:#294c48';
 const source=co.source==='db'?'CHARANIZE DB LABの蓄積指数':'CHARANIZE Labの現在の指数新聞';
 const status=loading?'DB LABを読み込み中…':loaded?'DB LAB：指数付き'+total+'走／クラス判明'+known+'走／登録'+horseCount+'頭':'DB LAB：'+issue;
 p.innerHTML='<label for="charaClassSourceV1" style="font-weight:700;margin-right:8px">②の比較基準</label>'+
  '<select id="charaClassSourceV1" style="padding:7px 9px;border:1px solid #a6c8be;border-radius:7px;background:white">'+
  '<option value="auto">DB LAB優先（不足時は新聞）</option><option value="db">DB LABのみ</option><option value="paper">今の指数新聞のみ</option></select>'+
  '<button type="button" id="charaClassReloadV1" style="margin-left:7px;padding:7px;border:1px solid #a6c8be;border-radius:7px;background:white">DB再読込</button>'+
  '<div style="margin-top:7px">使用中：<b>'+esc(source)+'</b>／'+esc(status)+'</div>'+
  (co.dbReason?'<div>DB LABが使えない理由：'+esc(co.dbReason)+'</div>':'')+
  '<div style="color:#637c78">クラス不明の履歴は除外。同じ端末・同じブラウザのDBだけを参照し、DB内容は変更しません。公式のクラス平均ではありません。</div>';
 root.prepend(p);
 p.querySelector('#charaClassSourceV1').value=mode;
 p.querySelector('#charaClassSourceV1').onchange=e=>{
   mode=e.target.value;try{localStorage.setItem(MODE_KEY,mode);}catch(_){}update();
 };
 p.querySelector('#charaClassReloadV1').onclick=()=>load(null,true);
}
window.CHARA_DB_COHORT_BRIDGE={choose,decorate,load};
window.addEventListener('focus',()=>{if(Date.now()-last>5000)load();});
})();
