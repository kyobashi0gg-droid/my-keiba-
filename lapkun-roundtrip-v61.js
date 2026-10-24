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
    if(!result) return '<div class="v61-empty">まだ分析結果は保存されていません。「分析用データをコピー」から始めます。</div>';
    const scenarioNames={MAIN:'本線',FAST:'速い側',SLOW:'遅い側'};
    const roleNames={A:'軸・本線・相手',B:'広げる',X:'見送り'};
    const scenarios=result.scenarios||[], horses=result.horses||[], pairs=result.pairs||[];
    const main=scenarios.find(x=>x.kind==='MAIN');
    const roleRank=h=>/軸/.test(h.role||'')?0:/本線/.test(h.role||'')?1:/相手/.test(h.role||'')?2:3;
    const aHorses=horses.filter(h=>h.tier==='A').sort((a,b)=>roleRank(a)-roleRank(b));
    const circled=n=>{
      const x=Number(n);
      return Number.isInteger(x)&&x>=1&&x<=20?String.fromCodePoint(9311+x):String(n||'—');
    };
    const horseByName=new Map(horses.map(h=>[norm(h.name),h]));
    const horseTitle=name=>{
      const h=horseByName.get(norm(name));
      return h?`${circled(h.number)} ${h.name}`:String(name||'');
    };
    const selected=[];
    const add=p=>{if(p&&!selected.includes(p)&&selected.length<2)selected.push(p);};
    add(pairs.find(p=>p.kind==='A+A'&&p.scenario==='MAIN'));
    add(pairs.find(p=>p.kind==='B+B'));
    for(const p of pairs) add(p);
    const pairCompact=p=>`<div class="v64-pair-brief">
        <span class="v64-pair-meta">${esc(p.kind)} <span>${esc(scenarioNames[p.scenario]||p.scenario)}</span></span>
        <strong>${esc(horseTitle(p.a))} ＋ ${esc(horseTitle(p.b))}</strong>
      </div>`;
    const detailedPairs=pairs.length?pairs.map(p=>`<div class="v61-final-pair">
      <b>${esc(p.kind)} <small>${esc(scenarioNames[p.scenario]||p.scenario)}</small></b>
      <strong>${esc(horseTitle(p.a))} ＋ ${esc(horseTitle(p.b))}</strong>
      <p>${esc(p.reason)}</p></div>`).join(''):'<p class="v61-empty">該当する2頭セットは設定されていません。無理に組み合わせない判断です。</p>';
    const detailHorses=['A','B','X'].map(tier=>{
      const list=horses.filter(h=>h.tier===tier);
      if(!list.length)return '';
      return `<div class="v64-group-title">${esc(roleNames[tier])} <small>${list.length}頭</small></div>
      ${list.map(h=>`<div class="v61-horse-card">
        <span class="v61-horse-tier ${esc(h.tier)}">${esc(h.tier)}</span>
        <div><b>${esc(circled(h.number))} ${esc(h.name)} — ${esc(h.role)}</b><p>${esc(h.reason)}</p></div>
      </div>`).join('')}`;
    }).join('');
    const nameChips=aHorses.length?`<div class="v64-axis-list">${aHorses.slice(0,4).map(h=>`<div class="v64-axis-chip">
          <strong>${esc(circled(h.number))} ${esc(h.name)}</strong>
          <small>${esc(h.role)}</small>
        </div>`).join('')}${aHorses.length>4?`<span class="v64-more">ほか${aHorses.length-4}頭は全馬評価へ</span>`:''}</div>`:'<p class="v64-muted">A評価は未設定です。無理に軸を作りません。</p>';
    const scenarioDetail=scenarios.map(s=>`<div class="v64-scenario-line">
        <strong>${esc(scenarioNames[s.kind]||s.kind)} ${esc(fmt(s.lo))}〜${esc(fmt(s.hi))}</strong>
        <p>${esc(s.reason)}</p>
      </div>`).join('');
    return `<section class="v61-analysis v64-analysis">
      <div class="v64-topline">
        <strong>ラップ君の事前分析</strong>
        <small>${esc(result.updatedAt?.slice(0,10)||'')}</small>
      </div>
      <div class="v64-overview">
        <div class="v64-main-range"><span>本線33</span>
          <strong>${main?`${esc(fmt(main.lo))}〜${esc(fmt(main.hi))}`:'未設定'}</strong>
        </div>
        <div class="v64-overview-divider"></div>
        <div class="v64-overview-title">軸・本線・相手候補 <small>${aHorses.length}頭</small></div>
        ${nameChips}
      </div>
      <div class="v64-pairs-top">
        <div class="v64-overview-title">注目の同時好走2頭</div>
        ${selected.length?`<div class="v64-pairs-brief">${selected.map(pairCompact).join('')}</div>
          ${pairs.length>selected.length?`<p class="v64-muted">ほか${pairs.length-selected.length}組は「全2頭セットの詳細」で確認</p>`:''}`:'<p class="v64-muted">現時点で組み合わせ候補なし。見送りも選択肢です。</p>'}
      </div>
      <div class="v64-details-heading">詳細分析 <small>必要な項目だけ開いて確認</small></div>
      <div class="v64-accordion">
        <details class="v64-detail">
          <summary>33予測と展開根拠 <span class="v64-arrow" aria-hidden="true"></span></summary>
          <div class="v64-detail-body">
            ${scenarioDetail}
            ${result.note?`<div class="v64-checks"><strong>未確認事項・買い方の注意</strong><p>${esc(result.note)}</p></div>`:''}
          </div>
        </details>
        <details class="v64-detail">
          <summary>全${horses.length}頭の評価と理由 <span class="v64-arrow" aria-hidden="true"></span></summary>
          <div class="v64-detail-body v64-horses">${horses.length?detailHorses:'<p class="v61-empty">馬別評価は未登録です。</p>'}</div>
        </details>
        <details class="v64-detail">
          <summary>全${pairs.length}組の2頭セット詳細 <span class="v64-arrow" aria-hidden="true"></span></summary>
          <div class="v64-detail-body v61-final-pairs">${detailedPairs}</div>
        </details>
      </div>
      <p class="v64-qualifier">※各馬の適合・能力・条件を評価した保存結果です。確定買い目ではありません。</p>
    </section>`;
  }
  async function copy(text){
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(e){console.warn('Clipboard API unavailable',e);}
    const t=document.createElement('textarea');
    t.value=text;t.style.position='fixed';t.style.opacity='0';
    document.body.appendChild(t);t.focus();t.select();
    let ok=false;
    try{ok=!!document.execCommand?.('copy');}catch{}
    t.remove();
    return ok;
  }
  function draw(panel,r){
    const result=load(r),body=panel.querySelector('.v61-inside');
    if(!body)return;
    body.innerHTML=`<p class="v61-help">CHARANIZEの新聞スクショはこのチャットに送ってください。サイトには指数を登録せず、ラップ君がDB・展開・調教と合わせて分析し、その結果だけをここへ保存します。</p>
    ${summaryHTML(result)}
    <div class="v61-step"><strong>① ラップ君に相談する</strong><p>従来の全馬・DB33・調教・テン順などをまとめた依頼文を作ります。CHARANIZEの画像は別途チャットへ送ります。</p>
      <div class="v65-send-actions"><button type="button" class="v65-share">スマホで共有</button><button type="button" class="v61-copy">コピー</button></div>
      <p class="v61-readiness" role="status" aria-live="polite">準備状況：待機中。ボタンを押すと全馬データの生成・照合・コピーまで自動で行います。</p>
      <details class="v61-preview" hidden><summary>生成した相談文の全文を確認する</summary>
        <textarea readonly rows="9" aria-label="生成した相談文" class="v61-preview-text"></textarea>
      </details>
      <p class="v61-help">「スマホで共有」はAndroidの共有メニューを開きます。ChatGPTが共有先に出ない場合は「コピー」して、このチャットに貼り付けてください。CHARANIZE画像は従来どおり別送です。</p></div>
    <div class="v61-step"><strong>② ラップ君の結果をサイトへ戻す</strong><p>返信中の「MYKEIBA_PAIRRESULT_V1」から「【結果ブロック終わり】」までを貼り付けます。</p>
      <div class="v65-receive-actions"><button type="button" class="v65-paste">クリップボードから保存</button><button type="button" class="v65-manual" aria-expanded="false">手動で貼り付け</button></div>
      <div class="v65-manual-wrap" hidden><textarea class="v61-input" rows="5" placeholder="MYKEIBA_PAIRRESULT_V1&#10;RACE|東京|11|富士S&#10;SCENARIO|MAIN|+0.3|+0.9|..."></textarea>
      <button type="button" class="v61-import">貼り付けた結果を確認・保存</button></div></div>
    <div class="v61-status" role="status" aria-live="polite"></div>
    <p class="v61-help">※スマホ共有・クリップボード読み込みは端末操作の補助です。ChatGPTへの自動送信・自動取得ではありません。レース名と馬番を照合し、保存前に確認します。</p>`;
    const status=body.querySelector('.v61-status');
    const copyButton=body.querySelector('.v61-copy');
    const shareButton=body.querySelector('.v65-share');
    const readiness=body.querySelector('.v61-readiness');
    const preview=body.querySelector('.v61-preview');
    const previewText=body.querySelector('.v61-preview-text');
    const input=body.querySelector('.v61-input');
    const setWorking=busy=>{
      copyButton.disabled=busy;shareButton.disabled=busy;
      copyButton.textContent=busy?'準備中…':'コピー';
      shareButton.textContent=busy?'準備中…':'スマホで共有';
    };
    async function prepareRequest(){
      readiness.textContent='準備中：DB33と展開シミュレーションのモジュールを確認しています。';
      await Promise.all([
        ensureModule('db-result-bridge-v44.js','MyKeibaDbResultBridgeV44'),
        ensureModule('pace-sim-v42.js','MyKeibaPaceSimV42')
      ]);
      if(!window.MyKeibaLapkunV6?.buildConsultText){
        throw Error('従来の全馬データ生成機能が未読み込みです。ページを再読み込みしてください。');
      }
      const data=dataText(r),start=data.indexOf('■全馬データ'),end=data.indexOf('■データ上の事実メモ',start);
      const horses=r.horses||[];
      const allHorses=start>=0&&end>start&&horses.length>0
        &&horses.every(h=>data.slice(start,end).includes('|'+h.name+'|'));
      if(!allHorses||!data.includes('【サイトへ戻す分析結果】')){
        throw Error('全馬データの照合が完了していません。コピー・共有を停止しました。');
      }
      preview.hidden=false;previewText.value=data;
      const saved=window.MyKeibaDbResultBridgeV44?.savedFor?.(r);
      const dbNote=saved?'DB33保存結果あり':'DB33評価はサイト内未保存';
      const missingTen=horses.filter(h=>!h.tenRank).length;
      readiness.textContent='生成完了：'+horses.length+'頭分・'+dbNote+'・テン順未登録'+missingTen+'頭。';
      return {data,horses,dbNote};
    }
    async function sendRequest(mode){
      if(copyButton.disabled||shareButton.disabled)return;
      setWorking(true);
      try{
        const {data,horses,dbNote}=await prepareRequest();
        if(mode==='share'&&typeof navigator.share==='function'){
          try{
            await navigator.share({title:'MY KEIBA LAB '+r.track+r.raceNo+'R '+r.raceName,text:data});
            readiness.textContent='共有メニューの操作が完了しました。ChatGPTで相談文が送信されたか確認してください。';
            return;
          }catch(e){
            if(e?.name==='AbortError'){
              readiness.textContent='共有をキャンセルしました。データは送信していません。';return;
            }
            // Unsupported or too-long native shares fall back to copy.
          }
        }
        const ok=await copy(data);
        if(ok){
          readiness.textContent='コピー完了：'+horses.length+'頭分（'+data.length.toLocaleString('ja-JP')+'文字）・'+dbNote+'。ChatGPTのこのチャットに貼り付けてください。';
        }else{
          readiness.textContent='相談文は生成できましたが自動コピーできませんでした。「全文を確認する」を開いて長押しでコピーしてください。';
          preview.open=true;
        }
      }catch(e){
        console.warn('Lapkun request could not be prepared',e);
        readiness.textContent='未完了：'+String(e?.message||'必要なデータを読み込めませんでした。')+' 不完全な相談文は送っていません。';
        status.textContent='全馬照合が未完了のため中止しました。';
      }finally{setWorking(false);}
    }
    shareButton.addEventListener('click',()=>sendRequest('share'));
    copyButton.addEventListener('click',()=>sendRequest('copy'));
    const manual=body.querySelector('.v65-manual');
    const manualWrap=body.querySelector('.v65-manual-wrap');
    manual.addEventListener('click',()=>{
      manualWrap.hidden=!manualWrap.hidden;
      manual.setAttribute('aria-expanded',String(!manualWrap.hidden));
      if(!manualWrap.hidden)input.focus();
    });
    function confirmAndSave(text,source){
      const value=parse(text,r);
      const main=value.scenarios.find(x=>x.kind==='MAIN');
      const message='次の内容を現在のレースへ保存します。'+
        '\\n'+r.track+' '+r.raceNo+'R '+r.raceName+
        '\\n本線33：'+fmt(main.lo)+'〜'+fmt(main.hi)+
        '\\n馬別評価：'+value.horses.length+'頭／2頭セット：'+value.pairs.length+'組'+
        (load(r)?'\\n既存のラップ君保存結果は上書きされます。':'')+
        '\\n保存してよいですか？';
      if(!window.confirm(message)){status.textContent='保存をキャンセルしました。既存データは変更していません。';return;}
      store(r,value);
      draw(panel,r);
      panel.querySelector('.v61-status').textContent='保存完了：'+source+'から本線33・馬別評価'+value.horses.length+'頭・2頭セット'+value.pairs.length+'組を反映しました。';
    }
    body.querySelector('.v65-paste').addEventListener('click',async()=>{
      try{
        if(!navigator.clipboard?.readText)throw Error('この端末ではクリップボードの自動読み取りが利用できません。');
        const text=await navigator.clipboard.readText();
        if(!text.trim())throw Error('クリップボードが空です。');
        confirmAndSave(text,'クリップボード');
      }catch(e){
        status.textContent='取り込めません：'+String(e?.message||e)+'「手動で貼り付け」からも読み込めます。';
      }
    });
    body.querySelector('.v61-import').addEventListener('click',()=>{
      try{confirmAndSave(input.value,'貼り付け');}
      catch(e){status.textContent='取り込めません：'+e.message;}
    });

  }
  function ensureModule(src,globalName){
    if(window[globalName])return Promise.resolve();
    let script=document.querySelector('script[data-v61-load="'+src+'"]')
      ||document.querySelector('script[src^="'+src+'"]');
    if(!script){
      script=document.createElement('script');
      script.src=src;script.async=true;script.dataset.v61Load=src;
      document.head.appendChild(script);
    }
    return new Promise((resolve,reject)=>{
      if(window[globalName])return resolve();
      let finished=false;
      const done=(error)=>{
        if(finished)return;
        finished=true;clearTimeout(timeout);
        script.removeEventListener('load',onload);
        script.removeEventListener('error',onerror);
        if(error&&script.dataset?.v61Load===src)script.remove?.();
        if(error)reject(error);else resolve();
      };
      const onload=()=>done(window[globalName]?null:Error(src+' の初期化が完了していません。'));
      const onerror=()=>done(Error(src+' を読み込めません。'));
      const timeout=setTimeout(()=>done(window[globalName]?null:Error(src+' の読み込みが時間切れです。')),3500);
      script.addEventListener('load',onload,{once:true});
      script.addEventListener('error',onerror,{once:true});
      if(window[globalName])done();
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
  .v61-readiness{font-size:11px;line-height:1.7;color:#276547;font-weight:800;padding:8px 10px;margin:8px 0;border:1px solid #dceadf;border-radius:10px;background:#f5faf6}
  .v61-panel button:disabled{opacity:.5;cursor:wait}
  .v65-send-actions,.v65-receive-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}
  .v65-send-actions button,.v65-receive-actions button{min-height:44px;min-width:0;white-space:normal;line-height:1.35}
  .v65-send-actions .v65-share,.v65-receive-actions .v65-paste{background:#198754;color:#fff;border-color:#198754}
  .v65-manual-wrap[hidden]{display:none}
  .v61-preview{margin:9px 0;border:1px solid #dce7e0;border-radius:10px;padding:9px}
  .v61-preview summary{font-size:11px;font-weight:900;color:#286044;cursor:pointer}
  .v61-preview-text{width:100%;box-sizing:border-box;margin-top:9px;border:1px solid #dde8df;border-radius:9px;resize:vertical;font-size:10px;line-height:1.5;padding:8px}
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
  /* v64 compact saved-result dashboard; data format and import unchanged */
  .v64-analysis{margin:0 0 16px}
  .v64-topline{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:8px 0 10px}
  .v64-topline strong{font-size:14px;color:#1b6040}.v64-topline small{font-size:10px;color:#789187}
  .v64-overview{background:#f2f8f4;border:1px solid #e0ece4;border-radius:15px;padding:12px}
  .v64-main-range{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .v64-main-range span{font-size:12px;font-weight:900;color:#4c7661}
  .v64-main-range strong{font-size:20px;font-weight:950;letter-spacing:.01em;color:#164f34}
  .v64-overview-divider{height:1px;background:#d8e6dc;margin:10px 0}
  .v64-overview-title{font-size:12px;font-weight:950;color:#23563c;margin:0 0 8px}
  .v64-overview-title small{font-size:10px;color:#739080;font-weight:700}
  .v64-axis-list{display:flex;flex-wrap:wrap;gap:7px}
  .v64-axis-chip{display:flex;flex-direction:column;gap:3px;padding:7px 9px;border-radius:10px;background:#fff;border:1px solid #d9e7dc;max-width:100%}
  .v64-axis-chip strong{font-size:12px;color:#24563b;line-height:1.4;overflow-wrap:anywhere}
  .v64-axis-chip small{font-size:10px;color:#708678}
  .v64-more{font-size:10px;color:#6a8372;align-self:center}
  .v64-pairs-top{padding:14px 0 3px}
  .v64-pairs-brief{display:grid;gap:7px}
  .v64-pair-brief{display:flex;align-items:flex-start;gap:7px;flex-wrap:wrap;padding:9px 10px;border:1px solid #dce8df;border-radius:11px;background:#fff}
  .v64-pair-meta{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:900;color:#286245}
  .v64-pair-meta span{padding:2px 5px;border-radius:5px;background:#eaf4ed}
  .v64-pair-brief>strong{min-width:0;flex:1 1 155px;font-size:12px;line-height:1.55;overflow-wrap:anywhere;color:#234c34}
  .v64-muted{font-size:10px;color:#73867a;line-height:1.6;margin:7px 1px 0}
  .v64-details-heading{font-size:13px;font-weight:950;color:#245c41;margin:16px 0 8px}
  .v64-details-heading small{font-size:10px;color:#87978c;font-weight:500;display:block;margin-top:3px}
  .v64-accordion{display:grid;gap:7px}
  .v64-detail{border:1px solid #dae8dd;border-radius:12px;overflow:hidden;background:#f8faf8}
  .v64-detail>summary{display:flex!important;align-items:center;justify-content:space-between;gap:9px;padding:12px!important;font-size:12px!important;font-weight:900;line-height:1.45;color:#25583f;cursor:pointer;list-style:none}
  .v64-detail>summary::-webkit-details-marker{display:none}
  .v64-arrow{display:block;flex:0 0 8px;width:8px;height:8px;border-right:2px solid #5b7b68;border-bottom:2px solid #5b7b68;transform:rotate(45deg);transition:transform .12s ease}
  .v64-detail[open] .v64-arrow{transform:rotate(225deg)}
  .v64-detail[open]{background:#fff}
  .v64-detail-body{padding:0 10px 11px;border-top:1px solid #e9efea}
  .v64-scenario-line{padding:10px 0;border-bottom:1px solid #edf1ed}
  .v64-scenario-line:last-child{border-bottom:0}
  .v64-scenario-line strong{font-size:12px;color:#235940}
  .v64-scenario-line p,.v64-checks p{font-size:11px;line-height:1.65;margin:5px 0 0;color:#536e5d;overflow-wrap:anywhere}
  .v64-checks{background:#f5f8f5;border-radius:9px;padding:9px;margin-top:9px}
  .v64-checks strong{font-size:11px;color:#376047}
  .v64-horses{display:grid;gap:8px}
  .v64-group-title{font-size:12px;font-weight:900;color:#325f45;padding:10px 0 0}
  .v64-group-title small{font-size:10px;font-weight:600;color:#7a9481}
  .v64-horses .v61-horse-card{margin:0}
  .v64-detail-body.v61-final-pairs{display:grid;gap:8px}
  .v64-qualifier{font-size:10px;line-height:1.5;color:#829187;margin:10px 0 0}
  .v61-advanced{margin-top:12px;border-top:1px solid #e4eee7;padding-top:9px}.v61-advanced p{font-size:10px;color:#83948a}`;
  document.head.appendChild(style);
  schedule();
  window.MyKeibaRoundtripV61={dataText,parse,summaryHTML,decorate,load,openConsult};
})();
