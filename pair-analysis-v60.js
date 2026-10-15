(function pairAnalysisV60(){
  if(window.__MYKEIBA_PAIR_ANALYSIS_V60__) return;
  window.__MYKEIBA_PAIR_ANALYSIS_V60__=true;
  const APP_KEY='my-keiba-lab-v2';
  const BACKUP_KEY='my-keiba-pair-analysis-v60';
  const MARKER='■同時好走2頭分析（33共通帯・仮説比較）';
  const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const norm=x=>window.MyKeibaDataV16?.normalizeHorseName?window.MyKeibaDataV16.normalizeHorseName(x):String(x||'').normalize('NFKC').replace(/[\s　・･]/g,'').trim();
  const finite=x=>{if(x==null||String(x).trim()==='')return null;const n=Number(String(x).normalize('NFKC').replace('−','-'));return Number.isFinite(n)?n:null;};
  const fmt=x=>x==null?'未設定':(x>=0?'+':'')+Math.round(x*10)/10;
  function races(){try{return (typeof state!=='undefined'?state.races:window.state?.races)||[];}catch{return window.state?.races||[];}}
  function currentRace(){
    const id=document.querySelector('#v4DetailBody [data-v4-expand]')?.dataset.v4Expand;
    return id?races().find(r=>(r.horses||[]).some(h=>h.id===id)):null;
  }
  const key=r=>[r?.v3DateLabel||r?.date||'',r?.track||'',r?.raceNo||'',r?.raceName||''].map(x=>String(x).trim()).join('|');
  function loadData(r){
    let a={};
    try{a=JSON.parse(localStorage.getItem(BACKUP_KEY)||'{}')||{};}catch{}
    const d=r.v60PairAnalysis||a[key(r)]||{};
    return {target:d.target??'',tiers:{...(d.tiers||{})},chara:{...(d.chara||{})}};
  }
  function saveData(r,d){
    r.v60PairAnalysis=d;
    try{
      const all=JSON.parse(localStorage.getItem(BACKUP_KEY)||'{}')||{};
      all[key(r)]=d;
      localStorage.setItem(BACKUP_KEY,JSON.stringify(all));
      if(typeof state!=='undefined')localStorage.setItem(APP_KEY,JSON.stringify(state));
    }catch(e){console.warn('pair analysis save',e);}
  }
  function avg33(r){
    for(const x of [r?.v3Avg33,r?.avg33,r?.average33]){
      const n=finite(x);if(n!=null)return n;
    }
    try{
      const p=window.MyKeibaPaceSimV42?.paceProfile?.(r);
      if(p?.base!=null)return p.base;
    }catch{}
    return null;
  }
  function parseZone(text){
    const s=String(text||'').normalize('NFKC').replace(/[−–]/g,'-');
    const arr=s.match(/[+-]?\d+(?:\.\d+)?/g)?.map(Number)||[];
    if(!arr.length)return null;
    return {lo:Math.min(...arr),hi:Math.max(...arr)};
  }
  function distance(z,target){
    if(!z||target==null)return Infinity;
    return target<z.lo?z.lo-target:target>z.hi?target-z.hi:0;
  }
  function tier(h,d){
    const set=d.tiers[norm(h.name)];
    if(['A','B','X'].includes(set))return set;
    if(['◎','○','▲'].includes(h.userMark))return 'A';
    if(['☆','△'].includes(h.userMark))return 'B';
    return '';
  }
  function dbFor(r){
    try{
      const data=window.MyKeibaDbResultBridgeV44?.savedFor?.(r)||window.MyKeibaDbResultBridgeV38?.saved?.();
      if(!data||String(data.race?.track)!==String(r.track)||Number(data.race?.raceNo)!==Number(r.raceNo))return new Map();
      return new Map((data.horses||[]).map(h=>[norm(h.name),h]));
    }catch{return new Map();}
  }
  function candidateRows(r,d,target){
    const db=dbFor(r);
    return (r.horses||[]).map(h=>{
      const n=norm(h.name),found=db.get(n),z=parseZone(found?.zone),gap=distance(z,target);
      return {h,name:n,db:found,zone:z,gap,tier:tier(h,d),c:d.chara[n]||null};
    });
  }
  function pairsFor(r,d,target){
    const rows=candidateRows(r,d,target).filter(x=>x.gap<=0.25);
    const result=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const a=rows[i],b=rows[j];
      const kind=a.tier&&b.tier?`${a.tier}＋${b.tier}`:'区分未設定';
      if(a.tier==='X'||b.tier==='X')continue;
      let conflict='';
      const ar=finite(a.h.tenRank),br=finite(b.h.tenRank);
      const escapeA=finite(a.c?.escape),escapeB=finite(b.c?.escape);
      if(ar!=null&&br!=null&&ar<=2&&br<=2)conflict='テン上位同士。先行競合を確認';
      else if(escapeA!=null&&escapeB!=null){
        const vals=rows.map(x=>finite(x.c?.escape)).filter(x=>x!=null).sort((x,y)=>y-x);
        const second=vals.length>=2?vals[1]:null;
        if(second!=null&&escapeA>=second&&escapeB>=second)conflict='逃指数上位2頭。同型競合を確認';
      }
      const score=(a.tier==='A'?2:a.tier==='B'?1:0)+(b.tier==='A'?2:b.tier==='B'?1:0)+(a.gap===0?2:1)+(b.gap===0?2:1);
      result.push({a,b,kind,conflict,score});
    }
    return {rows,pairs:result.sort((x,y)=>y.score-x.score||x.a.gap+x.b.gap-y.a.gap-y.b.gap).slice(0,8),allCount:result.length,fitCount:rows.length};
  }
  function charaText(c){
    if(!c)return '未取込';
    return `逃${c.escape??'—'} / 先${c.front??'—'} / 追${c.follow??'—'} / 脚${c.leg??'—'} / ギア${c.gear??'—'}`;
  }
  function report(r,d,target){
    const m=pairsFor(r,d,target),arr=[
      MARKER,`${r.track}${r.raceNo}R ${r.raceName}`,`比較33：${fmt(target)}（実33予測ではない）`,
      `共通コア近接馬：${m.fitCount}頭 / 組合せ：${m.allCount}組`,
      ...m.pairs.map((p,i)=>{
        const a=p.a,b=p.b;
        return `${i+1}. ${a.h.number||'—'} ${a.h.name} ＋ ${b.h.number||'—'} ${b.h.name} [${p.kind}]`
          +` / DB33 ${a.db?.zone||'—'} & ${b.db?.zone||'—'}`
          +` / DB分類 ${a.db?.groupLabel||a.db?.label||'未取得'} & ${b.db?.groupLabel||b.db?.label||'未取得'}`
          +` / テン順 ${a.h.tenRank||'—'}・${b.h.tenRank||'—'}`
          +(p.conflict?` / 注意 ${p.conflict}`:'');
      }),
      '※「共通コア」は33帯の近接のみ。レースレベル・同級実績・馬場・途中進出・再加速・競馬場間の指数再現性を確認し、能力で勝てるか別途判定。',
      '※テン順・CHARANIZE逃先は初動位置の補助。追走は負荷、脚指数は差し有利の偏りがあるため絶対能力点にしない。',
      '※異なる条件でしか浮上しない馬同士は組み合わせない。33の本線は隊列から別途予測する。'
    ];
    return arr.join('\n');
  }
  function draw(box,r,d){
    const base=avg33(r),target=finite(d.target)??base,rows=candidateRows(r,d,target);
    const calc=target==null?null:pairsFor(r,d,target);
    const selectOptions=([{k:'',label:'未分類'},{k:'A',label:'A 軸・本線・相手'},{k:'B',label:'B 広げる'},{k:'X',label:'保留・除外'}]);
    box.innerHTML=`<div class="v60-help">この比較は<strong>33予測ではありません</strong>。テン1F未登録でもテン順・CHARANIZEの入力済み項目と、保存済みDBコア33から候補を表示します。</div>
      <div class="v60-tools"><label>比較する33 <input class="v60-target" type="number" step="0.1" inputmode="decimal" value="${target==null?'':esc(target)}" placeholder="例 +0.5"></label>
      <button type="button" class="v60-run">比較する</button></div>
      <p class="v60-note">新聞平均33：${fmt(base)}。速い側・遅い側は値を変えて比較してください。コア近接許容幅±0.25秒。値を変えただけでは既存のDB33評価印は再計算しません。</p>
      ${calc?`<p class="v60-count">共通適合：${calc.fitCount}頭 / 成立可能な組合せ：${calc.allCount}組</p>
       <div class="v60-pairs">${calc.pairs.length?calc.pairs.map(p=>`<div class="v60-pair">
       <strong>${esc(p.a.h.number||'—')} ${esc(p.a.h.name)} ＋ ${esc(p.b.h.number||'—')} ${esc(p.b.h.name)}</strong>
       <span>${esc(p.kind)} / コア ${esc(p.a.db?.zone||'—')} ＆ ${esc(p.b.db?.zone||'—')}</span>
       <span>分類 ${esc(p.a.db?.groupLabel||p.a.db?.label||'—')} ＆ ${esc(p.b.db?.groupLabel||p.b.db?.label||'—')}</span>
       ${p.conflict?`<em>⚠ ${esc(p.conflict)}</em>`:''}</div>`).join(''):'<p>2頭とも33帯が近接する組合せはありません。能力型は別途壁打ちで検討。</p>'}</div>
       <button type="button" class="v60-copy">2頭セットをラップ君にコピー</button>`:'<p>比較33が未設定です。値を入力してください。</p>'}
      <details class="v60-extra"><summary>候補区分 A/B とCHARANIZE取り込み</summary>
      <p>印の◎○▲は仮にA、☆△はBと表示します。ここで選ぶ区分が優先され、元の予想印は変更しません。</p>
      <div class="v60-horses">${rows.map(x=>`<label><span>${esc(x.h.number||'—')} ${esc(x.h.name)}<small> / ${esc(charaText(x.c))}</small></span>
      <select data-v60-tier="${esc(x.name)}">${selectOptions.map(o=>`<option value="${o.k}" ${x.tier===o.k?'selected':''}>${o.label}</option>`).join('')}</select></label>`).join('')}</div>
      <p>CHARANIZEをスクショから文字にして貼り付けます（馬番｜馬名｜逃｜先｜追走｜脚｜ギア）。芝ダ・競馬場の違いによる指数再現性は別に判断してください。</p>
      <textarea class="v60-paste" rows="5" placeholder="MYKEIBA_CHARANIZE_V1&#10;馬番|馬名|逃|先|追走|脚|ギア&#10;1|サンプルホース|60|72|85|91|70"></textarea>
      <button type="button" class="v60-import">CHARANIZEを反映</button><span class="v60-status" aria-live="polite"></span></details>`;
    box.querySelector('.v60-run')?.addEventListener('click',()=>{
      const n=finite(box.querySelector('.v60-target')?.value);
      if(n==null){box.querySelector('.v60-target').focus();return;}
      d.target=n;saveData(r,d);draw(box,r,d);
    });
    box.querySelector('.v60-copy')?.addEventListener('click',async()=>{
      const t=report(r,d,target);
      try{await navigator.clipboard.writeText(t);box.querySelector('.v60-copy').textContent='コピーしました';}
      catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');}catch{}a.remove();box.querySelector('.v60-copy').textContent='コピーを試みました';}
    });
    box.querySelectorAll('[data-v60-tier]').forEach(s=>s.addEventListener('change',()=>{
      d.tiers[s.dataset.v60Tier]=s.value;saveData(r,d);
      const opened=box.querySelector('.v60-extra')?.open;
      draw(box,r,d);if(opened)box.querySelector('.v60-extra').open=true;
    }));
    box.querySelector('.v60-import')?.addEventListener('click',()=>{
      const lines=String(box.querySelector('.v60-paste').value||'').trim().split(/\r?\n/);
      const horses=r.horses||[];let good=0;const bad=[];
      for(const raw of lines){
        if(!raw.trim()||/MYKEIBA_CHARANIZE|^馬番[|\t]/i.test(raw.trim()))continue;
        const c=raw.split(/[|\t]/).map(x=>x.trim());
        if(c.length!==7){bad.push(raw.slice(0,40));continue;}
        const [no,name]=c;
        const hits=horses.filter(h=>norm(h.name)===norm(name)&&(no===''||String(h.number||'')===no));
        const vals=c.slice(2).map(finite);
        if(hits.length!==1||vals.every(x=>x==null)||vals.some(x=>x!=null&&(x<0||x>500))){
          bad.push(`${no} ${name}`);continue;
        }
        d.chara[norm(hits[0].name)]={escape:vals[0],front:vals[1],follow:vals[2],leg:vals[3],gear:vals[4]};
        good++;
      }
      if(good)saveData(r,d);
      const st=box.querySelector('.v60-status');
      st.textContent=`${good}頭取り込み${bad.length?`／未照合${bad.length}行（馬名・馬番を確認）`:''}`;
      if(good){const opened=box.querySelector('.v60-extra')?.open;draw(box,r,d);if(opened)box.querySelector('.v60-extra').open=true;box.querySelector('.v60-status').textContent=`${good}頭取り込み${bad.length?`／未照合${bad.length}行`:''}`;}
    });
  }
  function decorate(){
    const r=currentRace(),body=document.querySelector('#v4DetailBody');
    if(!r||!body)return;
    let panel=body.querySelector('#v60PairPanel');
    if(!panel){
      panel=document.createElement('section');panel.id='v60PairPanel';panel.className='v60-panel';
      const table=body.querySelector('.v4-table-wrap')||body.querySelector('.v4-table');
      const pace=body.querySelector('#v42PaceSim');
      if(pace)pace.insertAdjacentElement('afterend',panel);else table?.insertAdjacentElement('beforebegin',panel);
      panel.innerHTML='<details class="v60-root"><summary>展開・同時好走2頭分析 <small>軽量版</small></summary><div class="v60-content"></div></details>';
      panel.querySelector('.v60-root')?.addEventListener('toggle',e=>{
        if(e.target.open){
          const race=currentRace();if(race)draw(panel.querySelector('.v60-content'),race,loadData(race));
        }
      });
    }
  }
  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,150);}
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-v4-race],.v4-race-card,[data-v4-expand],.v4-nav'))schedule();
  },true);
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('mykeiba:resume',schedule);
  window.addEventListener('mykeiba:modules-ready',schedule);
  window.addEventListener('mykeiba:db-result-decorated',schedule);
  const css=document.createElement('style');
  css.textContent=`.v60-panel{margin:12px 0;border:1px solid #d9e8df;border-radius:17px;background:#fff;padding:12px}
  .v60-root>summary{font-size:14px;font-weight:900;color:#24583a;cursor:pointer}.v60-root>summary small{font-size:10px;color:#65866f}
  .v60-content{margin-top:10px;font-size:12px;color:#405549}.v60-help,.v60-note{font-size:11px;line-height:1.65;color:#65796e}
  .v60-tools{display:flex;gap:9px;align-items:end;flex-wrap:wrap;margin:10px 0}.v60-tools label{font-weight:800}
  .v60-tools input{display:block;max-width:125px;margin-top:3px;padding:8px;border:1px solid #c7d6ce;border-radius:9px;font-size:14px}
  .v60-panel button{border:1px solid #bcd8c7;background:#e5f3e9;border-radius:11px;color:#20593a;padding:9px 12px;font-weight:900;font-size:12px;cursor:pointer}
  .v60-count{font-weight:900;color:#245e41}.v60-pairs{display:grid;gap:7px;margin:9px 0}
  .v60-pair{border:1px solid #dce8e0;border-radius:12px;padding:9px 10px;background:#f8fbf9;display:grid;gap:3px}
  .v60-pair strong{font-size:12px;color:#234c34}.v60-pair span{font-size:10px;color:#607468}.v60-pair em{font-size:10px;color:#ad6631;font-style:normal}
  .v60-extra{margin-top:12px;border-top:1px solid #e5eee7;padding-top:10px}
  .v60-extra summary{font-weight:900;color:#365e48;cursor:pointer}.v60-extra p{font-size:10px;line-height:1.5;color:#6a776e}
  .v60-horses{max-height:250px;overflow:auto;border:1px solid #e2eae5;border-radius:11px}
  .v60-horses label{display:flex;justify-content:space-between;align-items:center;gap:7px;padding:5px 7px;border-bottom:1px solid #eff2ef;font-size:11px}
  .v60-horses label span{flex:1;min-width:0}.v60-horses small{display:block;font-size:9px;color:#799087;line-height:1.4}
  .v60-horses select{max-width:132px;padding:5px;border:1px solid #ccdbd1;border-radius:7px;background:#fff;font-size:10px}
  .v60-paste{display:block;width:100%;box-sizing:border-box;border:1px solid #c9d8ce;border-radius:10px;font-size:11px;padding:8px}
  .v60-status{font-size:10px;color:#31744c;margin-left:6px}`;
  document.head.appendChild(css);
  schedule();
  window.MyKeibaPairAnalysisV60={pairsFor,report,decorate};
})();
