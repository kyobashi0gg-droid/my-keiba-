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
  function dbMap(r){
    try{
      const d=window.MyKeibaDbResultBridgeV44?.savedFor?.(r)||window.MyKeibaDbResultBridgeV38?.saved?.();
      if(!d||norm(d.race?.track)!==norm(r.track)||Number(d.race?.raceNo)!==Number(r.raceNo))return new Map();
      return new Map((d.horses||[]).map(x=>[norm(x.name),x]));
    }catch{return new Map();}
  }
  function charaMap(r){
    const i=r.v60PairAnalysis;
    if(i?.chara)return i.chara;
    try{
      const saved=JSON.parse(localStorage.getItem('my-keiba-pair-analysis-v60')||'{}');
      const k=[r.v3DateLabel||r.date||'',r.track||'',r.raceNo||'',r.raceName||''].map(x=>String(x).trim()).join('|');
      return saved[k]?.chara||{};
    }catch{return {};}
  }
  function tiers(r){
    const i=r.v60PairAnalysis;
    if(i?.tiers)return i.tiers;
    try{
      const saved=JSON.parse(localStorage.getItem('my-keiba-pair-analysis-v60')||'{}');
      const k=[r.v3DateLabel||r.date||'',r.track||'',r.raceNo||'',r.raceName||''].map(x=>String(x).trim()).join('|');
      return saved[k]?.tiers||{};
    }catch{return {};}
  }
  function dataText(r){
    const db=dbMap(r),cm=charaMap(r),ts=tiers(r);
    const lines=[
      '【MY KEIBA LAB / ラップ君 事前展開・同時好走分析】',
      `対象: ${r.track} ${r.raceNo}R ${r.raceName}`,
      `登録日付: ${r.v3DateLabel||'未取得'}`,
      `条件: ${r.v3Course||'未取得'} / 馬場: ${r.going||'未設定'} / 天気: ${r.weather||'未設定'}`,
      `新聞平均33: ${fmt(num(r.v3Avg33))} / 展開・馬場メモ: ${safe(r.paceMemo)}`,
      '※新聞PDF掲載オッズは採用しない。確認済み実オッズが無ければ人気・オッズ妙味を断定しない。',
      '※テン1Fの欠損は欠損として扱い、テン順・CHARANIZE逃先と実通過順で初動先行圧を検証。',
      '※33はラスト6Fの前半3F−後半3F。1400mは1F目を除外し2F〜4Fを前半3Fとして扱う。',
      '※事前33予測を先に確定し、DB適合が増えるように予測値を動かさない。',
      '※DBコア帯の重なりは「同時に勝ち負けする根拠」ではない。過去走総評・格・相手関係・勝ち方・クラス昇級・競馬場移動を個別に調べる。',
      '馬番|馬名|テン1F過去|テン1F前走|テン順|上がり順|調教印|調教採点|前走比|DB33印|DB分類|コア33|全好走33|CHAR逃|CHAR先|CHAR追走|CHAR脚|CHARギア|仮候補区分',
    ];
    for(const h of r.horses||[]){
      const d=db.get(norm(h.name)),c=cm[norm(h.name)]||{},t=ts[norm(h.name)]||'';
      lines.push([
        h.number||'—',h.name,h.tenPast1f||'—',h.tenPrev1f||'—',h.tenRank||'—',h.agariRank||'—',
        h.mark||'—',h.trainingScore||'—',h.diff??'—',
        d?.mark||'—',d?.groupLabel||d?.label||'—',d?.zone||'—',d?.allZone||'—',
        c.escape??'—',c.front??'—',c.follow??'—',c.leg??'—',c.gear??'—',
        t||(/^[◎○▲]$/.test(h.userMark||'')?'A':/^[☆△]$/.test(h.userMark||'')?'B':'未分類')
      ].map(safe).join('|'));
    }
    const pace=window.MyKeibaPaceSimV42?.consultSection?.(r);
    if(pace)lines.push('',pace);
    lines.push(
      '',
      '【ラップ君への分析指示】',
      '1. 今回の実33を、初動先行圧と33区間先行圧を分離し、区間開始地点、緩みの位置、途中進出、直線再加速を因果で予測。本線・速い側・遅い側の範囲を確定する。',
      '2. 各馬のDB過去走・総評（ハイ/超ハイはレースの質）・上級相手関係と勝ち切り能力を精査。元データに無いものは未確認とする。',
      '3. CHARANIZE追走は負荷、脚指数は差し有利傾向。指数は他場での再現性を確認する。芝ダ混用不可。',
      '4. 本線・相手・広げるを個別評価し、A+A、B+B、A+Bを「2頭が同時に好走する因果」がある場合だけ提案する。別展開専用同士は買い目にしない。',
      '5. 次の形式で最後にコピペできる結果ブロックを作る。縦棒|は列区切り専用。理由文では使わず、改行しない。対象外馬や組合せは無理に出さない。',
      '',
      'MYKEIBA_PAIRRESULT_V1',
      `RACE|${safe(r.track)}|${safe(r.raceNo)}|${safe(r.raceName)}`,
      'SCENARIO|MAIN|+0.0|+0.8|33区間前半の緩み位置と後半の再加速を記述（数値は実際に予測した値に置換）',
      'SCENARIO|FAST|-0.8|-0.1|速い側に振れる原因を記述',
      'SCENARIO|SLOW|+1.0|+1.6|遅い側に振れる原因を記述',
      'HORSE|馬番|馬名|A|軸|能力・適合・位置取りの根拠（実在の馬に置換）',
      'HORSE|馬番|馬名|B|広げる|能力・条件付き浮上の根拠（実在の馬に置換）',
      'PAIR|A+A|1頭目の馬名|2頭目の馬名|MAIN|2頭とも好走する因果（実在の組合せに置換）',
      'PAIR|B+B|1頭目の馬名|2頭目の馬名|FAST|条件が揃えば同時浮上する理由',
      'NOTE|現時点の未確認材料と見送り判断',
      '【結果ブロック終わり】',
      '',
      '※シナリオ数値・馬番・馬名・根拠は必ず今回の分析で置換する。不要な行は省略可。'
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
    ${result.horses.length?`<details><summary>軸・本線・広げる／能力評価（${result.horses.length}頭）</summary><div class="v61-horses">${result.horses.map(h=>`<div><b>${esc(h.tier)} ${esc(h.number)} ${esc(h.name)}：${esc(h.role)}</b><p>${esc(h.reason)}</p></div>`).join('')}</div></details>`:''}
    ${result.note?`<p class="v61-final-note">${esc(result.note)}</p>`:''}</div>`;
  }
  function copy(text,feedback){
    navigator.clipboard?.writeText(text).then(()=>{feedback.textContent='コピーしました。ChatGPTのラップ君に貼り付けてください。';}).catch(()=>{
      const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();
      const ok=document.execCommand?.('copy');t.remove();
      feedback.textContent=ok?'コピーしました。':'コピーに失敗しました。長押しして文章をコピーしてください。';
    });
  }
  function draw(panel,r){
    const result=load(r),body=panel.querySelector('.v61-inside');
    if(!body)return;
    body.innerHTML=`<p class="v61-help">①ラップ君が隊列・33・能力・2頭の同時好走を検討 → ②分析結果を貼り付けて反映。自動予想ではありません。</p>
    ${summaryHTML(result)}
    <div class="v61-step"><strong>① ラップ君へ送る</strong><p>レース・テン順・DB33・CHARANIZE・調教をまとめた分析依頼を作ります。</p>
      <button type="button" class="v61-copy">分析用データをコピー</button>
      <p class="v61-help">コピーした文章をこのChatGPTに貼り付けてください。ラップ君が分析結果の取込用ブロックを返します。</p></div>
    <div class="v61-step"><strong>② ラップ君の結果をサイトへ戻す</strong><p>返信中の「MYKEIBA_PAIRRESULT_V1」から「【結果ブロック終わり】」までを貼り付けます。</p>
      <textarea class="v61-input" rows="5" placeholder="MYKEIBA_PAIRRESULT_V1&#10;RACE|東京|11|富士S&#10;SCENARIO|MAIN|+0.3|+0.9|..."></textarea>
      <button type="button" class="v61-import">結果を反映する</button></div>
    <div class="v61-status" role="status" aria-live="polite"></div>
    <details class="v61-advanced"><summary>参考：DBコア一致候補・CHARANIZE取り込み（旧比較機能）</summary>
      <button type="button" class="v61-legacy">旧比較パネルを表示する</button><p>先にCHARANIZE指数を登録したい場合に使います。従来の機械的なペア一覧は補助材料です。</p></details>`;
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
    body.querySelector('.v61-legacy')?.addEventListener('click',()=>{
      const legacy=document.querySelector('#v60PairPanel');
      if(!legacy){status.textContent='旧比較パネルは準備中です。';return;}
      legacy.classList.toggle('v61-show-legacy');
      body.querySelector('.v61-legacy').textContent=legacy.classList.contains('v61-show-legacy')?'旧比較パネルを閉じる':'旧比較パネルを表示する';
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
    panel.innerHTML='<details class="v61-root"><summary>ラップ君分析・同時好走2頭 <small>展開33・能力・A＋A/B＋B</small></summary><div class="v61-inside"></div></details>';
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
  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,110);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-v4-race],.v4-race-card,[data-v4-expand],.v4-nav'))schedule();},true);
  for(const ev of ['pageshow','mykeiba:resume','mykeiba:modules-ready','mykeiba:db-result-decorated'])window.addEventListener(ev,schedule);
  const style=document.createElement('style');
  style.textContent=`.v60-panel:not(.v61-show-legacy){display:none!important}
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
  .v61-horses>div{border-bottom:1px solid #e8eee8;padding:7px 0}.v61-horses p{margin:4px 0;font-size:11px;color:#627e6b}
  .v61-final-note,.v61-empty{background:#f6f8f6;padding:9px 10px;border-radius:10px;color:#60756b;line-height:1.6;font-size:11px}
  .v61-analysis details{margin-top:12px}.v61-analysis summary,.v61-advanced summary{font-size:11px;font-weight:900;cursor:pointer}
  .v61-advanced{margin-top:12px;border-top:1px solid #e4eee7;padding-top:9px}.v61-advanced p{font-size:10px;color:#83948a}`;
  document.head.appendChild(style);
  schedule();
  window.MyKeibaRoundtripV61={dataText,parse,summaryHTML,decorate,load};
})();
