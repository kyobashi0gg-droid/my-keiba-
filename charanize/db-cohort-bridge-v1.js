/* CHARANIZE Lab: read-only same-browser class benchmarks from CHARANIZE DB Lab.
 * Does not transfer PDF/horse data, modify private DB, or send data over a network.
 * Scope: same origin + same browser storage profile, not different devices.
 */
(function(){
  'use strict';
  const DB_NAME='CHARANIZE_DB_LAB_PRIVATE_V1', STORE='settings', KEY='private-pack';
  const MODE_KEY='charanize-lab-class-cohort-source-v1';
  const axisIndex={nige:0,sen:1,tsui:2,ashi:3,gear:4};
  const venues={東:'東京',新:'新潟',京:'京都',阪:'阪神',中:'中山',小:'小倉',札:'札幌',函:'函館',名:'中京',福:'福島'};
  let mode='auto';
  try{const saved=localStorage.getItem(MODE_KEY);if(['auto','db','paper'].includes(saved))mode=saved;}catch(_){}
  const info={loaded:false,loading:false,error:'DB LAB未確認',rows:[],total:0,classKnown:0,horses:0,last:0};
  const originalCohort=window.v6ClassCohort;
  const originalOverview=window.v9ClassOverview;
  if(typeof originalCohort!=='function'||typeof originalOverview!=='function')return;
  function klass(name){
    if(!name)return null;
    try{return v6Class(String(name).normalize('NFKC'));}catch(_){return null;}
  }
  function venueName(x){return venues[x]||x||'';}
  function storedClass(pack,r){
    let label=klass(r[10]);
    if(label)return label;
    const key=String(r[0]||'')+'|'+venueName(r[1])+'|'+String(r[2]||'');
    const card=pack.races?.[key];
    if(card&&typeof card==='object')return klass(card.name||card.race_name||card.class_name||'');
    return null;
  }
  function compile(pack){
    const out=[],seen=new Set(), horses=pack?.horses;
    if(!horses||typeof horses!=='object'||Array.isArray(horses))throw Error('DB LABの保存形式を確認できません');
    let all=0,unknown=0;
    for(const [horse,h] of Object.entries(horses)){
      if(!Array.isArray(h)||!Array.isArray(h[2]))continue;
      for(const r of h[2]){
        if(!Array.isArray(r)||!['芝','ダ'].includes(r[3])||!Number.isFinite(Number(r[4])))continue;
        if(!Array.isArray(r[9]))continue;
        const values=r[9].map(v=>typeof v==='number'&&Number.isFinite(v)?v:null);
        if(!values.some(v=>v!==null))continue;
        const key=[horse,r[0],venueName(r[1]),r[2],r[3],r[4]].join('|');
        if(seen.has(key))continue;
        seen.add(key);all++;
        const cls=storedClass(pack,r);
        if(!cls){unknown++;continue;}
        out.push({horse,cls,sf:r[3],dist:Number(r[4]),values});
      }
    }
    return {rows:out,total:all,classKnown:all-unknown,horses:Object.keys(horses).length};
  }
  function dbCohort(r){
    if(!info.loaded)return {valid:false,className:null,reason:info.error,source:'db'};
    if(v6IsJumpRace(r))return {valid:false,className:null,reason:'障害は比較対象外',source:'db'};
    const cls=v6TargetClass(r),sf=String(r.condition||'').charAt(0);
    const dist=Number((String(r.condition||'').match(/\d+/)||[])[0]);
    if(!cls||!['芝','ダ'].includes(sf)||!dist)return {valid:false,className:cls,reason:'今回のクラス・距離が不明',source:'db'};
    const data=info.rows.filter(o=>o.sf===sf&&o.cls===cls);
    const exact=data.filter(o=>o.dist===dist);
    const near=data.filter(o=>groupDistance(o.dist)===groupDistance(dist));
    let chosen,scope;
    if(exact.length>=20){chosen=exact;scope='同クラス・同芝ダ・同距離';}
    else if(near.length>=30){chosen=near;scope='同クラス・同芝ダ・同距離帯';}
    else if(data.length>=40){chosen=data;scope='同クラス・同芝ダ（距離混合）';}
    else return {valid:false,className:cls,reason:'DB LABのクラス判明走が不足：'+data.length+'走（同距離'+exact.length+'走）。推測でクラスを補いません。',source:'db'};
    const stats={};
    for(const [k] of labs)stats[k]=measure(chosen.map(o=>o.values[axisIndex[k]]).filter(Number.isFinite));
    return {className:cls,valid:true,stats,scope,records:chosen.length,
      horses:new Set(chosen.map(o=>o.horse)).size,source:'db'};
  }
  window.v6ClassCohort=function(r){
    if(mode==='paper')return Object.assign({},originalCohort(r),{source:'paper'});
    const db=dbCohort(r);
    if(mode==='db'||db.valid)return db;
    return Object.assign({},originalCohort(r),{source:'paper',dbReason:db.reason});
  };
  function esc(x){return String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  window.v9ClassOverview=function(d,co){
    originalOverview(d,co);
    const root=document.getElementById('classRaceOverview');
    if(!root)return;
    const p=document.createElement('div');
    p.style.cssText='margin:10px 0 14px;padding:11px 12px;border:1px solid #d3e5e0;border-radius:10px;background:#f7fbfa;font-size:12px;line-height:1.7;color:#294c48';
    const source=co.source==='db'?'CHARANIZE DB LABの蓄積データ':'CHARANIZE Labの現在の指数新聞';
    const stateText=info.loading?'DB LABを確認中…':info.loaded
      ?'DB LAB：指数付き'+info.total+'走／クラス判明'+info.classKnown+'走／登録'+info.horses+'頭'
      :'DB LAB：'+info.error;
    p.innerHTML='<label for="charaClassSourceV1" style="font-weight:700;margin-right:8px">②の比較基準</label>'+
      '<select id="charaClassSourceV1" style="padding:7px 9px;border:1px solid #a6c8be;border-radius:7px;background:white">'+
      '<option value="auto">DB LAB優先（不足時は新聞）</option><option value="db">DB LABのみ</option><option value="paper">今の指数新聞のみ</option></select>'+
      '<button type="button" id="charaClassReloadV1" style="margin-left:7px;padding:7px;border:1px solid #a6c8be;border-radius:7px;background:white">DB再読込</button>'+
      '<div style="margin-top:7px">使用中：<b>'+esc(source)+'</b>／'+esc(stateText)+'</div>'+
      (co.dbReason?'<div>DB LABを使わない理由：'+esc(co.dbReason)+'</div>':'')+
      '<div style="color:#637c78">クラス不明の過去走は除外。同じ端末・同じブラウザのDBのみ参照。比較基準は公的なクラス平均ではありません。</div>';
    root.prepend(p);
    const sel=p.querySelector('#charaClassSourceV1');
    sel.value=mode;
    sel.addEventListener('change',()=>{mode=sel.value;try{localStorage.setItem(MODE_KEY,mode);}catch(_){} charRender();});
    p.querySelector('#charaClassReloadV1').addEventListener('click',()=>load(true));
  };
  function readPack(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('ブラウザの保存領域が利用できません'));return;}
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        // No DB LAB has been installed in this browser. Do not create empty storage.
        try{request.transaction.abort();}catch(_){}
      };
      request.onerror=()=>reject(new Error('同じブラウザにDB LABの保存データがありません'));
      request.onsuccess=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE)){db.close();reject(new Error('DB LABの保存形式が異なります'));return;}
        let transaction;
        try{transaction=db.transaction(STORE,'readonly');}catch(e){db.close();reject(e);return;}
        const q=transaction.objectStore(STORE).get(KEY);
        q.onsuccess=()=>{const result=q.result;db.close();if(result?.horses)resolve(result);else reject(new Error('同じブラウザにDB LABの登録馬がありません'));};
        q.onerror=()=>{db.close();reject(new Error('DB LABのデータが読み込めません'));};
      };
    });
  }
  async function load(force){
    if(info.loading||(!force&&info.last&&Date.now()-info.last<2000))return;
    info.loading=true;
    if(typeof charRender==='function')charRender();
    try{const parsed=compile(await readPack());Object.assign(info,parsed,{loaded:true,error:'',last:Date.now()});}
    catch(e){Object.assign(info,{loaded:false,rows:[],error:String(e?.message||e),last:Date.now()});}
    info.loading=false;
    if(typeof charRender==='function')charRender();
  }
  window.addEventListener('focus',()=>{if(Date.now()-info.last>5000)load(false);});
  load(false);
})();
