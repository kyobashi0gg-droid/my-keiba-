/* MY KEIBA LAB v69 — テンP連動の比較表示と入力（既存v42は変更しない）。 */
(() => {
  'use strict';
  if (window.__MYKEIBA_TEN_PATTERN_V69__) return;
  window.__MYKEIBA_TEN_PATTERN_V69__ = true;
  const core=window.MyKeibaTenPatternCoreV69;
  if(!core) return;
  const APP='my-keiba-lab-v2';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const signed=v=>v==null?'—':(v>=0?'+':'')+v;
  const range=v=>v?signed(v.min)+'〜'+signed(v.max):'算出保留';
  const count=v=>Math.round(v*100)+'%';
  function races(){try{return (typeof state!=='undefined'?state.races:window.state?.races)||[];}catch{return window.state?.races||[];}}
  function currentRace(){
    const id=document.querySelector('#v4DetailBody [data-v4-expand]')?.dataset.v4Expand;
    return id?races().find(r=>(r.horses||[]).some(h=>h.id===id)):null;
  }
  function profile(r){
    const old=window.MyKeibaPaceSimV42?.paceProfile?.(r);
    return old?core.analyze(r,old):null;
  }
  function desc(p){
    if(!p.ready) return 'テンP取得率60%未満のため新方式の先行圧・33予測は保留。旧方式を引き続き参照。';
    return '先行圧はテンPとテン順位の複合仮説。33は初動からの参考幅で、中盤の緩み・再加速、実通過順はラップ君が別途補正。';
  }
  function options(p){
    return [['','未確認'],['15','P15'],['30','P30'],['50','P50'],['0','非該当（表示なし）']]
      .map(([v,name])=>'<option value="'+v+'"'+(p!==null&&String(p)===v?' selected':'')+'>'+name+'</option>').join('');
  }
  function item(x){
    const name=(x.h.number||'—')+' '+x.h.name;
    return '<label class="v69-item"><span><strong>'+esc(name)+'</strong><small>旧位置 '+esc(x.legacyPosition||'不明')+' ／ '+esc(x.kind)+'</small></span>'+
      '<select data-v69-horse="'+esc(x.h.id)+'" aria-label="'+esc(name)+' のテンP">'+options(x.p)+'</select></label>';
  }
  function card(p){
    const rivals=p.strong.map(x=>(x.h.number||'—')+' '+x.h.name).join(' / ')||'該当なし';
    const alerts=p.horses.filter(x=>x.needsReview).map(x=>(x.h.number||'—')+' '+x.h.name).join(' / ')||'なし';
    return '<div class="v69-title"><div><small>PACE SIM / TEN PATTERN</small><strong>テンP連動・展開シミュレーション <em>検証版</em></strong></div></div>'+
      '<div class="v69-cols"><div><small>旧方式の先行圧</small><b>'+esc(p.legacyPressure)+'</b></div><div><small>新方式の初動先行圧</small><b>'+esc(p.pressure)+'</b></div></div>'+
      '<div class="v69-count">テンP確認 '+p.knownCount+'/'+p.total+'頭（'+count(p.coverage)+'） ／ P15：'+p.p15+'頭・P30：'+p.p30+'頭・P50：'+p.p50+'頭・非該当：'+p.none+'頭</div>'+
      '<div class="v69-range"><div>旧方式の本線33：<b>'+esc(range(p.legacyMain))+'</b></div><div>新方式の参考33：<b>'+esc(range(p.reference33))+'</b></div></div>'+
      '<p class="v69-note">'+esc(desc(p))+'</p>'+
      '<p class="v69-lines"><b>先行力上位候補：</b>'+esc(rivals)+'</p>'+
      (alerts!=='なし'?'<p class="v69-alert">脚質メモとテンPの照合が必要：'+esc(alerts)+'</p>':'')+
      '<details class="v69-input"><summary>各馬のテンPを入力・確認する（未取得の馬は未確認）</summary>'+
      '<p>smartrcの「テンP」欄をそのまま選択。空欄を画面で確認した場合だけ「非該当」を選択してください。入力はこの端末のレースデータに保存されます。</p>'+
      '<div class="v69-list">'+p.horses.map(item).join('')+'</div></details>';
  }
  function decorate(){
    const r=currentRace();
    const pace=document.querySelector('#v42PaceSim');
    if(!r||!pace) return;
    const p=profile(r);if(!p)return;
    let el=document.querySelector('#v69TenPattern');
    if(!el){
      el=document.createElement('section');el.id='v69TenPattern';
      el.className='v69-card';pace.insertAdjacentElement('afterend',el);
    }
    el.innerHTML=card(p);
  }
  function consultSection(r){
    const p=profile(r);
    if(!p)return '';
    const front=p.strong.map(x=>(x.h.number||'—')+' '+x.h.name+'（P'+x.p+'）');
    const changed=p.horses.filter(x=>x.p!==null&&['逃げ候補','先行'].includes(x.legacyPosition)&&x.score<.48)
      .map(x=>(x.h.number||'—')+' '+x.h.name+'（'+(x.p===0?'非該当':'P'+x.p)+'、旧位置'+x.legacyPosition+'）');
    return [
      '■テンP連動・展開シミュレーション v69（試験版）',
      'テンP確認：'+p.knownCount+'/'+p.total+'頭、P15 '+p.p15+'頭 / P30 '+p.p30+'頭 / P50 '+p.p50+'頭 / 非該当 '+p.none+'頭 / 未確認 '+(p.total-p.knownCount)+'頭',
      '先行圧比較：旧方式 '+p.legacyPressure+' → テンP方式 '+p.pressure,
      '33比較：旧本線 '+range(p.legacyMain)+' → テンP方式・初動からの参考帯 '+range(p.reference33),
      '先行力上位候補：'+(front.join(' / ')||'なし'),
      '旧方式で先行扱いだがテンP先行根拠の弱い馬：'+(changed.join(' / ')||'なし'),
      '脚質メモと不一致：'+(p.horses.filter(x=>x.needsReview).map(x=>(x.h.number||'—')+' '+x.h.name).join(' / ')||'なし'),
      '※'+desc(p),
      '※テンPは過去の相対的先行力であり実通過順や逃げの意思とは異なる。実通過順・枠・距離替わりで初動先行圧を再確認。33区間の先行圧・緩み・途中進出は独立して予測する。'
    ].join('\n');
  }
  let timer=0;
  function schedule(ms=200){clearTimeout(timer);timer=setTimeout(()=>{try{decorate();}catch(e){console.warn('ten pattern simulation',e);}},ms);}
  document.addEventListener('change',e=>{
    const sel=e.target?.closest?.('select[data-v69-horse]');
    if(!sel)return;
    const r=currentRace();
    const h=r?.horses?.find(x=>x.id===sel.dataset.v69Horse);
    if(!h)return;
    const before=h.tenPattern;
    if(sel.value==='') delete h.tenPattern;
    else h.tenPattern=Number(sel.value);
    try{
      const st=typeof state!=='undefined'?state:window.state;
      localStorage.setItem(APP,JSON.stringify(st));
      const old=document.querySelector('#v69TenPattern .v69-input')?.open;
      decorate();
      const now=document.querySelector('#v69TenPattern .v69-input');if(now)now.open=old;
    }catch(e){
      if(before===undefined) delete h.tenPattern;else h.tenPattern=before;
      alert('テンPを保存できませんでした。空き容量を確認してください。');
      schedule(40);
    }
  });
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')){schedule(180);setTimeout(()=>schedule(100),450);}
  },true);
  ['pageshow','mykeiba:resume','mykeiba:modules-ready'].forEach(name=>window.addEventListener(name,()=>schedule(200)));
  const css=document.createElement('style');
  css.textContent='.v69-card{margin:10px 0 15px;padding:13px;border:1px solid #bcd7c7;border-radius:16px;background:#fff}.v69-title small{display:block;font-size:9px;color:#367253;letter-spacing:.1em}.v69-title strong{display:block;font-size:14px;color:#174e33}.v69-title em{font-size:9px;font-style:normal;color:#607b6b}.v69-cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.v69-cols>div{background:#edf6f0;padding:8px;border-radius:10px}.v69-cols small{display:block;font-size:10px;color:#6a8272}.v69-cols b{display:block;font-size:16px;color:#235d3b}.v69-count,.v69-note,.v69-lines,.v69-alert{font-size:11px;line-height:1.55;margin:8px 0}.v69-note{color:#65796a}.v69-alert{color:#94533e}.v69-range{padding:8px 9px;background:#f8f6f1;border-radius:10px;font-size:11px;line-height:1.65}.v69-range b{color:#244e35}.v69-input>summary{font-size:12px;font-weight:900;color:#235940;cursor:pointer;padding:9px 0}.v69-input>p{font-size:10px;color:#697b70}.v69-list{display:grid;gap:5px;margin-top:7px}.v69-item{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:7px;border-bottom:1px solid #e7efea}.v69-item span{min-width:0}.v69-item strong{display:block;font-size:11px}.v69-item small{font-size:10px;color:#728577}.v69-item select{width:138px;max-width:45%;min-height:40px;font-size:12px;background:#fff;color:#234a36;border:1px solid #cadbd0;border-radius:7px;padding:3px}';
  document.head.appendChild(css);
  window.MyKeibaTenPatternV69={profile,consultSection,decorate};
  schedule(700);
})();
