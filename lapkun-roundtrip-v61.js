(function roundtripV61(){
  if(window.__MYKEIBA_ROUNDTRIP_V61__)return;
  window.__MYKEIBA_ROUNDTRIP_V61__=true;
  const BACKUP='my-keiba-lapkun-results-v61',APP='my-keiba-lab-v2';
  const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　・･]/g,'').trim();
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const num=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).normalize('NFKC').replace(/[−–]/g,'-'));return Number.isFinite(n)?n:null;};
  const fmt=v=>v==null?'未設定':(v>=0?'+':'')+Math.round(v*10)/10;
  const safe=v=>String(v??'').replace(/[\r\n|]+/g,' / ').slice(0,1000).trim();
  function races(){try{return (typeof state!=='undefined'?state.races:window.state?.races)||[];}catch{return window.state?.races||[];}}
  function currentRace(){const h=document.querySelector('#v4DetailBody [data-v4-expand]')?.dataset.v4Expand;return h?races().find(r=>(r.horses||[]).some(x=>x.id===h)):null;}
  function key(r){return [r.v3DateLabel||r.date||'',r.track,r.raceNo,r.raceName].map(norm).join('|');}
  function load(r){
    if(r.v61Roundtrip?.version===1)return r.v61Roundtrip;
    try{const saved=JSON.parse(localStorage.getItem(BACKUP)||'{}');const x=saved[key(r)];return x?.version===1?x:null;}catch{return null;}
  }
  function store(r,value){
    r.v61Roundtrip=value;
    try{
      const all=JSON.parse(localStorage.getItem(BACKUP)||'{}')||{};
      all[key(r)]=value;localStorage.setItem(BACKUP,JSON.stringify(all));
      if(typeof state!=='undefined')localStorage.setItem(APP,JSON.stringify(state));
    }catch(e){console.warn('Roundtrip save failed',e);}
  }
  function dataText(r){
    const detailed=window.MyKeibaLapkunV6?.buildConsultText?.(r);
    const lines=[
      '【MY KEIBA LAB｜ラップ君・事前予想＆サイト保存】',
      `開催・レース：${r.track} ${r.raceNo}R ${r.raceName}`,
      `開催日：${r.v3DateLabel||'未設定'}`,
      '【情報源と優先順位】',
      '・以下のMY KEIBA LAB資料はサイトの現時点の登録内容。過去走のレベル・総評・相手関係は別途DB Lab原本を確認して評価する。',
      '・CHARANIZE指数はサイトに取り込まない。この会話へ別途送った新聞画像からラップ君が読み取って組み合わせる。画像がなければ「未確認」と明記し、指数や能力を推測しない。',
      '・テン1Fが欠損でもテン順とCHARANIZEの逃・先指数、過去の実通過順を使って隊列を確認する。テン/上がり順位は33適性へ直接加点しない。',
      '・CHARANIZE追走は負荷、脚指数は差し有利の偏りに注意。芝ダを混ぜず、他場・異距離での指数再現性は慎重に扱う。',
      '・33はラスト6Fの前半3F−後半3F。芝1400mは2F目〜4F目が前半3F。',
      '・DBレース総評の「ハイ」「超ハイ」はレースの質で、新聞のペース指数とは別。',
      '・新聞PDFの人気・オッズは信用しない。最新の実オッズを確認できた場合にのみ妙味を判定。',
      '【今回の分析順序】',
      '1. 逃/先指数と実通過順から初動先行圧を確認し、33区間の緩み・途中進出・直線再加速から本線/速い側/遅い側33を先に予測。DB適合が増える方向へ予測を合わせない。',
      '2. 各馬の実績クラス・過去走総評・勝ち方・相手関係・昇級実績・成長・休養・調教を精査し、33適合と勝ち切る能力を別々に評価する。',
      '3. 軸・本線・相手（A）と広げる（B）、見送り（X）を設定。同じ33・馬場・位置取りの条件で2頭が同時好走する根拠があるA+A/B+B/A+Bだけ提示する。別シナリオでのみ好走する2頭は無理に組み合わせない。',
      '4. レース結果を参照せずに事前分析を固定する。未確認の情報は明記し、根拠が弱ければ「見送り」も提示する。',
      '',
      '【サイトから送った馬別資料】',
    ];
    if(detailed){
      lines.push(detailed);
    }else{
      lines.push(`コース: ${r.v3Course||'—'} / 平均33: ${r.v3Avg33??'—'} / 馬場: ${r.going||'未設定'}`);
      lines.push('馬番|馬名|テン順|上がり順|調教印|調教採点|前走比');
      for(const h of r.horses||[]){
        lines.push([h.number||'—',h.name,h.tenRank||'—',h.agariRank||'—',h.mark||'—',h.trainingScore||'—',h.diff??'—'].map(safe).join('|'));
      }
      lines.push('※従来の詳細DB33データは一部取得できていません。サイトでDB評価の保存状況を確認してください。');
    }
    const pace=window.MyKeibaPaceSimV42?.consultSection?.(r);
    if(pace)lines.push('', '【サイトの展開シミュレーション（補助）】',pace);
    const rank=window.MyKeibaLapConsultV46?.siteRankingSection?.();
    if(rank)lines.push('',rank);
    const c1400=window.MyKeibaLapConsultV46?.caution1400Section?.(r);
    if(c1400)lines.push('',c1400);
    lines.push(
      '',
      '【サイトへ戻す分析結果】',
      'まず通常の文章で、33形成、全馬の能力比較、A/Bの取捨理由、同時好走の可否を説明する。',
      'その最後に必ず以下の形式でコピペ用の「結果ブロック」を作る。',
      'これは入力形式の説明であり、ダミーの馬名・数値を残してはいけない。実際に評価した馬・33に置き換え、不要な行は省く。',
      '本線SCENARIOは必須。FAST/SLOWはシナリオが合理的に成立するときだけ。HORSE・PAIRは無理に増やさず、理由を具体的に。',
      '「|」は列の区切り専用。理由本文に縦棒や改行を入れない。RACE名は以下と完全一致させる。',
      '',
      'MYKEIBA_PAIRRESULT_V1',
      `RACE|${safe(r.track)}|${safe(r.raceNo)}|${safe(r.raceName)}`,
      'SCENARIO|MAIN|33下限数値|33上限数値|区間の緩みと再加速を含む根拠',
      'SCENARIO|FAST|33下限数値|33上限数値|速い側の原因（必要な場合のみ）',
      'SCENARIO|SLOW|33下限数値|33上限数値|遅い側の原因（必要な場合のみ）',
      'HORSE|実際の馬番|実際の馬名|A|軸・本線・相手の別|33適合と能力・位置取りの根拠',
      'HORSE|実際の馬番|実際の馬名|B|広げる|好走条件・能力不確実性と採用理由',
      'PAIR|A+A|1頭目の実際の馬名|2頭目の実際の馬名|MAIN|2頭が同時好走する理由',
      'PAIR|B+B|1頭目の実際の馬名|2頭目の実際の馬名|FAST|条件変化で両馬が浮上する理由（必要な場合のみ）',
      'NOTE|馬場・調教・CHARANIZE画像の未確認事項、買い目上の見送り理由',
      '【結果ブロック終わり】'
    );
    return lines.join('\n');
  }
  function parse(text,r){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const start=lines.indexOf('MYKEIBA_PAIRRESULT_V1');
    if(start<0)throw Error('MYKEIBA_PAIRRESULT_V1 の行が見つかりません。');
    const body=lines.slice(start+1);
    const allowed=new Map((r.horses||[]).map(h=>[norm(h.name),h]));
    const result={version:1,scenarios:[],horses:[],pairs:[],note:'',updatedAt:new Date().toISOString()};
    let confirmed=false;
    for(const line of body){
      if(line==='【結果ブロック終わり】'||/^※/.test(line))break;
      if(!/^(RACE|SCENARIO|HORSE|PAIR|NOTE)\|/.test(line))break;
      const col=line.split('|'),type=col[0];
      if(type==='RACE'){
        if(col.length<4||norm(col[1])!==norm(r.track)||String(Number(col[2]))!==String(Number(r.raceNo))||norm(col[3])!==norm(r.raceName)){
          throw Error('レース名・開催場・Rが現在開いているレースと一致しません。');
        }
        confirmed=true;
      }else if(type==='SCENARIO'){
        if(!confirmed)throw Error('RACE行を先頭に入れてください。');
        if(!['MAIN','FAST','SLOW'].includes(col[1])||col.length<5)throw Error('SCENARIO行の形式が正しくありません。');
        const lo=num(col[2]),hi=num(col[3]);if(lo==null||hi==null||lo>hi||Math.abs(lo)>30||Math.abs(hi)>30)throw Error('SCENARIOの33範囲が不正です。');
        if(result.scenarios.some(x=>x.kind===col[1]))throw Error(`SCENARIO ${col[1]} が重複しています。`);
        result.scenarios.push({kind:col[1],lo,hi,reason:safe(col.slice(4).join(' / '))});
      }else if(type==='HORSE'){
        if(col.length<6||!['A','B','X'].includes(col[3]))throw Error('HORSE行の区分はA・B・Xのいずれかにしてください。');
        const h=allowed.get(norm(col[2]));
        if(!h||String(h.number||'')!==String(col[1]))throw Error(`HORSE照合失敗：${col[1]} ${col[2]}`);
        if(result.horses.some(x=>norm(x.name)===norm(h.name)))throw Error(`HORSE重複：${h.name}`);
        result.horses.push({number:String(h.number||''),name:h.name,tier:col[3],role:safe(col[4]),reason:safe(col.slice(5).join(' / '))});
      }else if(type==='PAIR'){
        if(col.length<6||!['A+A','A+B','B+B'].includes(col[1])||!['MAIN','FAST','SLOW'].includes(col[4]))throw Error('PAIR行の形式または分岐が正しくありません。');
        const a=allowed.get(norm(col[2])),b=allowed.get(norm(col[3]));
        if(!a||!b||a===b)throw Error(`PAIR馬名照合失敗：${col[2]} ＋ ${col[3]}`);
        if(result.pairs.some(x=>x.kind===col[1]&&x.scenario===col[4]&&[norm(x.a),norm(x.b)].sort().join('|')===[norm(a.name),norm(b.name)].sort().join('|')))throw Error(`PAIR重複：${a.name} ＋ ${b.name}`);
        result.pairs.push({kind:col[1],a:a.name,b:b.name,scenario:col[4],reason:safe(col.slice(5).join(' / '))});
      }else if(type==='NOTE'){result.note=safe(col.slice(1).join(' / '));}
    }
    if(!confirmed)throw Error('RACE行がありません。');
    if(!result.scenarios.some(x=>x.kind==='MAIN'))throw Error('本線33のSCENARIO|MAIN行が必要です。');
    if(result.pairs.length>0){
      const scen=new Set(result.scenarios.map(x=>x.kind));
      for(const p of result.pairs){
        if(!scen.has(p.scenario))throw Error(`${p.a}＋${p.b}の${p.scenario}シナリオが未設定です。`);
        const a=result.horses.find(h=>norm(h.name)===norm(p.a)),b=result.horses.find(h=>norm(h.name)===norm(p.b));
        if(!a||!b)throw Error(`PAIR ${p.a}＋${p.b} は両馬のHORSE行が必要です。`);
        const actual=[a.tier,b.tier].sort().join('+');
        const declared=p.kind.split('+').sort().join('+');
        if(actual!==declared)throw Error(`${p.a}＋${p.b}のA/B区分がPAIR行と一致しません。`);
      }
    }
    return result;
  }
  function summaryHTML(result){
    if(!result)return '<div class="v61-empty">まだ分析結果は保存されていません。下の「①分析用データをコピー」から始めます。</div>';
    const title={MAIN:'本線',FAST:'速い側',SLOW:'遅い側'};
    return `<div class="v61-analysis"><div class="v61-result-title">ラップ君の事前分析 <small>${esc(result.updatedAt?.slice(0,10)||'')}</small></div>
    <div class="v61-scenarios">${result.scenarios.map(s=>`<div><strong>${title[s.kind]||s.kind} ${fmt(s.lo)}〜${fmt(s.hi)}</strong><p>${esc(s.reason)}</p></div>`).join('')}</div>
    <div class="v61-result-title">同時好走2頭セット</div>
    <div class="v61-final-pairs">${result.pairs.length?result.pairs.map(p=>`<div class="v61-final-pair">
      <b>${esc(p.kind)} <small>${title[p.scenario]||p.scenario}</small></b>
      <strong>${esc(p.a)} ＋ ${esc(p.b)}</strong><p>${esc(p.reason)}</p></div>`).join(''):'<div class="v61-empty">組み合わせを無理に買わない判断です。</div>'}</div>
    ${result.horses.length?`<div class="v61-result-title">軸・本線・相手 / 広げる</div><div class="v61-horses">${result.horses.map(h=>`<div class="v61-horse-card"><span class="v61-horse-tier ${esc(h.tier)}">${esc(h.tier)}</span><div><b>${esc(h.number)} ${esc(h.name)} — ${esc(h.role)}</b><p>${esc(h.reason)}</p></div></div>`).join('')}</div>`:''}
    ${result.note?`<p class="v61-final-note">${esc(result.note)}</p>`:''}</div>`;
  }
  function copy(text,feedback){
    const request=navigator.clipboard?.writeText?.(text);
    if(request){request.then(()=>{feedback.textContent='コピーしました。ChatGPTのラップ君に貼り付けてください。';}).catch(()=>{
      const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();
      const ok=document.execCommand?.('copy');t.remove();
      feedback.textContent=ok?'コピーしました。':'コピーに失敗しました。長押しして文章をコピーしてください。';
    });return;}
    const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();
    const ok=document.execCommand?.('copy');t.remove();
    feedback.textContent=ok?'コピーしました。':'コピーに失敗しました。';
  }
  function draw(panel,r){
    const result=load(r),body=panel.querySelector('.v61-inside');
    if(!body)return;
    body.innerHTML=`<p class="v61-help">CHARANIZEの新聞スクショはこのチャットに送ってください。サイトには指数を登録せず、ラップ君がDB・展開・調教と合わせて分析し、その結果だけをここへ保存します。</p>
    ${summaryHTML(result)}
    <div class="v61-step"><strong>① ラップ君に相談する</strong><p>従来の全馬・DB33・調教・テン順などをまとめた依頼文を作ります。CHARANIZEの画像は別途チャットへ送ります。</p>
      <button type="button" class="v61-copy">分析用データをコピー</button>
      <p class="v61-help">コピーした文章をこのChatGPTに貼り付けてください。ラップ君が分析結果の取込用ブロックを返します。</p></div>
    <div class="v61-step"><strong>② ラップ君の結果をサイトへ戻す</strong><p>返信中の「MYKEIBA_PAIRRESULT_V1」から「【結果ブロック終わり】」までを貼り付けます。</p>
      <textarea class="v61-input" rows="5" placeholder="MYKEIBA_PAIRRESULT_V1&#10;RACE|東京|11|富士S&#10;SCENARIO|MAIN|+0.3|+0.9|..."></textarea>
      <button type="button" class="v61-import">結果を反映する</button></div>
    <div class="v61-status" role="status" aria-live="polite"></div>
    <p class="v61-help">※結果の反映は現在コピー・貼り付け式です。ChatGPTとの自動同期は行いません。</p>`;
    const status=body.querySelector('.v61-status');
    body.querySelector('.v61-copy')?.addEventListener('click',async()=>{
      const b=body.querySelector('.v61-copy');b.textContent='データを作成中…';
      try{
        await Promise.all([
          ensureModule('db-result-bridge-v44.js','MyKeibaDbResultBridgeV44'),
          ensureModule('pace-sim-v42.js','MyKeibaPaceSimV42')
        ]);
        const data=dataText(r);
        copy(data,status);
        b.textContent='分析用データをコピー';
      }catch(e){status.textContent='データ作成時に問題が発生しました。もう一度お試しください。';b.textContent='分析用データをコピー';}
    });
    body.querySelector('.v61-import')?.addEventListener('click',()=>{
      try{
        const v=parse(body.querySelector('.v61-input').value,r);
        store(r,v);draw(panel,r);
        panel.querySelector('.v61-status').textContent=`反映しました。本線33と2頭セット${v.pairs.length}組を保存しました。`;
      }catch(e){status.textContent=`取込できません：${e.message}`;}
    });

  }
  function ensureModule(src,globalName){
    if(window[globalName])return Promise.resolve();
    const existing=document.querySelector(`script[data-v61-load="${src}"]`)||document.querySelector(`script[src^="${src}"]`);
    let s=existing;
    if(!s){s=document.createElement('script');s.src=src;s.async=true;s.dataset.v61Load=src;document.head.appendChild(s);}
    return new Promise(resolve=>{
      if(window[globalName])return resolve();
      s.addEventListener('load',resolve,{once:true});
      s.addEventListener('error',resolve,{once:true});
      setTimeout(resolve,2500);
    });
  }
  function decorate(){
    const r=currentRace(),body=document.querySelector('#v4DetailBody');
    if(!r||!body)return;
    let panel=body.querySelector('#v61RoundtripPanel');
    if(panel)return;
    panel=document.createElement('section');panel.id='v61RoundtripPanel';panel.className='v61-panel';
    panel.innerHTML='<details class="v61-root"><summary>ラップ君の分析結果 <small>本線33・能力評価・同時好走2頭／結果の取込</small></summary><div class="v61-inside"></div></details>';
    const legacy=body.querySelector('#v60PairPanel');
    const pace=body.querySelector('#v42PaceSim');
    const table=body.querySelector('.v4-table-wrap')||body.querySelector('.v4-table');
    if(pace)pace.insertAdjacentElement('afterend',panel);
    else if(legacy)legacy.insertAdjacentElement('beforebegin',panel);
    else table?.insertAdjacentElement('beforebegin',panel);
    panel.querySelector('.v61-root').addEventListener('toggle',e=>{
      if(e.target.open){const race=currentRace();if(race)draw(panel,race);}
    });
  }
  function openConsult(race) {
    const detail=document.querySelector('#v4Detail');
    if(!detail||detail.hidden)return;
    decorate();
    const panel=document.querySelector('#v61RoundtripPanel');
    const root=panel?.querySelector('.v61-root');
    if(!root)return;
    root.open=true;
    const active=currentRace()||race;
    if(active)draw(panel,active);
    panel.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,110);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-v4-race],.v4-race-card,[data-v4-expand],.v4-nav'))schedule();},true);
  for(const ev of ['pageshow','mykeiba:resume','mykeiba:modules-ready','mykeiba:db-result-decorated'])window.addEventListener(ev,schedule);
  const style=document.createElement('style');
  style.textContent=`
  .v61-panel{margin:11px 0;border:1px solid #bcdccc;border-radius:17px;background:#fff;padding:12px;color:#345b45}
  .v61-root>summary{font-size:14px;font-weight:950;cursor:pointer;color:#196141}
  .v61-root>summary small{display:block;color:#789588;font-size:10px;margin-top:3px}
  .v61-inside{margin-top:12px;font-size:12px}.v61-help{font-size:11px;line-height:1.6;color:#72877a}
  .v61-step{border-top:1px solid #dce9e0;padding-top:12px;margin-top:12px}
  .v61-step>strong{display:block;font-size:13px;color:#245b40}
  .v61-step p{font-size:11px;color:#6a8073;line-height:1.6;margin:6px 0}
  .v61-panel button{border:1px solid #a8cfb9;border-radius:11px;padding:10px 12px;color:#1b633f;background:#e8f6ec;font-weight:900;font-size:12px}
  .v61-input{display:block;width:100%;box-sizing:border-box;border:1px solid #d3e0d7;border-radius:10px;padding:9px;font-size:12px;line-height:1.5;margin:9px 0;min-height:100px;background:#fcfefd}
  .v61-status{font-size:11px;color:#166d44;line-height:1.6;white-space:pre-wrap;margin-top:9px}
  .v61-result-title{font-weight:950;font-size:12px;margin:13px 0 8px;color:#1d6040}
  .v61-result-title small{font-weight:500;color:#789187}
  .v61-scenarios{display:grid;gap:6px}.v61-scenarios>div{padding:9px 10px;border-radius:11px;background:#f4f8f5}
  .v61-scenarios strong{font-size:12px}.v61-scenarios p,.v61-final-pair p{font-size:11px;line-height:1.6;margin:5px 0 0;color:#506f5c}
  .v61-final-pairs{display:grid;gap:7px}.v61-final-pair{border:1px solid #d9eadf;border-radius:13px;padding:10px;display:grid;gap:4px}
  .v61-final-pair b{color:#247a4d}.v61-final-pair b small{border-radius:6px;background:#e7f3eb;padding:3px 5px}
  .v61-final-pair strong{font-size:13px;color:#184e32}
  .v61-horses{display:grid;gap:7px}.v61-horse-card{display:flex;align-items:flex-start;gap:9px;border:1px solid #e3ede6;border-radius:11px;padding:9px}.v61-horse-card>div{flex:1;min-width:0}.v61-horse-tier{background:#e6f4eb;border-radius:7px;font-size:13px;color:#176444;font-weight:900;padding:4px 8px}.v61-horse-tier.B{background:#fff2d8;color:#9a6818}.v61-horse-tier.X{background:#eee;color:#777}.v61-horses p{margin:4px 0;font-size:11px;color:#627e6b;line-height:1.6}
  .v61-final-note,.v61-empty{background:#f6f8f6;padding:9px 10px;border-radius:10px;color:#60756b;line-height:1.6;font-size:11px}
  .v61-analysis details{margin-top:12px}.v61-analysis summary,.v61-advanced summary{font-size:11px;font-weight:900;cursor:pointer}
  .v61-advanced{margin-top:12px;border-top:1px solid #e4eee7;padding-top:9px}.v61-advanced p{font-size:10px;color:#83948a}`;
  document.head.appendChild(style);
  schedule();
  window.MyKeibaRoundtripV61={dataText,parse,summaryHTML,decorate,load,openConsult};
})();
