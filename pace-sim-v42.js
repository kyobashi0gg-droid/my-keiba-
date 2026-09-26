// MY KEIBA LAB v42 - テン/上がりから軽量な位置取り・展開・33ズレシナリオを可視化
(() => {
  if (window.__MYKEIBA_PACE_SIM_V42__) return;
  window.__MYKEIBA_PACE_SIM_V42__ = true;

  const num = v => {
    const m = String(v ?? '').replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const round1 = v => Math.round(v * 10) / 10;
  const signed = v => v == null ? '—' : `${v >= 0 ? '+' : ''}${round1(v)}`;
  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();
  const esc = (v='') => String(v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function races() {
    try { return (typeof state !== 'undefined' ? state.races : window.state?.races) || []; }
    catch { return window.state?.races || []; }
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return races().find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function baseAvg33(race) {
    for (const v of [race?.v3Avg33, race?.avg33, race?.average33]) {
      const n = num(v); if (n != null) return n;
    }
    try {
      const db = window.MyKeibaDbResultBridgeV44?.savedFor?.(race)
        || window.MyKeibaDbResultBridgeV38?.saved?.();
      if (db && sameRace(db.race, race)) return num(db.race.avg33);
    } catch {}
    return null;
  }

  function sameRace(a,b) {
    return !!a && !!b && String(a.track || '').trim() === String(b.track || '').trim()
      && String(Number(a.raceNo || 0)) === String(Number(b.raceNo || 0));
  }

  // 122 -> 12.2秒として扱う。すでに12.2形式ならそのまま。
  function tenSeconds(v) {
    const n = num(v);
    if (n == null) return null;
    if (n >= 100 && n < 200) return n / 10;
    return n;
  }

  function mean(values) {
    const a = values.filter(v => v != null && Number.isFinite(v));
    return a.length ? a.reduce((s,v)=>s+v,0) / a.length : null;
  }

  function parseZone(text) {
    const ns = String(text || '').match(/[+-]?\d+(?:\.\d+)?/g)?.map(Number) || [];
    if (!ns.length) return null;
    return { min: Math.min(...ns), max: Math.max(...ns) };
  }

  function gapToZone(v,z) {
    if (v == null || !z) return null;
    if (v >= z.min && v <= z.max) return 0;
    return v < z.min ? z.min - v : v - z.max;
  }

  function overlaps(range,z,pad=.25) {
    if (!range || !z) return false;
    return range.max >= z.min - pad && range.min <= z.max + pad;
  }

  function horseMetrics(race) {
    const hs = (race?.horses || []).map(h => ({
      h,
      tenRank: num(h.tenRank),
      agariRank: num(h.agariRank),
      tenPast: tenSeconds(h.tenPast1f),
      tenPrev: tenSeconds(h.tenPrev1f)
    }));
    hs.forEach(x => x.ten = mean([x.tenPast, x.tenPrev]));
    const timed = hs.filter(x => x.ten != null).sort((a,b)=>a.ten-b.ten);
    timed.forEach((x,i)=>x.speedRank=i+1);
    return { hs, timed };
  }

  function paceProfile(race) {
    const {hs,timed} = horseMetrics(race);
    const n = Math.max(1, hs.length);
    const fastest = timed[0]?.ten ?? null;
    const second = timed[1]?.ten ?? null;
    const cluster = fastest == null ? [] : timed.filter(x => x.ten - fastest <= .22);
    const frontPack = fastest == null ? [] : timed.filter(x => x.ten - fastest <= .42);
    const clearLeader = fastest != null && second != null && second - fastest >= .28;
    const coverage = timed.length / n;

    let mode = 'neutral', pace='平均', pressure='中', confidence = coverage >= .65 ? '中' : '低';
    if (coverage >= .45) {
      if (cluster.length >= 4 || (cluster.length >= 3 && frontPack.length >= 5)) {
        mode='fast'; pace='速い側'; pressure='高'; confidence=coverage>=.7?'高':'中';
      } else if (cluster.length >= 3) {
        mode='slightlyFast'; pace='やや速い側'; pressure='やや高';
      } else if (clearLeader && cluster.length === 1) {
        mode='slow'; pace='遅い側'; pressure='低'; confidence=coverage>=.65?'中':'低';
      }
    }

    const topCut = Math.max(2, Math.ceil(n * .22));
    const midFrontCut = Math.max(topCut + 1, Math.ceil(n * .42));
    const midCut = Math.max(midFrontCut + 1, Math.ceil(n * .68));
    const agariCut = Math.max(3, Math.ceil(n * .22));

    function rankOf(x) { return x.tenRank ?? x.speedRank ?? null; }
    function posOf(x) {
      const r = rankOf(x);
      if (r == null) return '不明';
      if (r === 1 && (clearLeader || cluster.length <= 2)) return '逃げ候補';
      if (r <= topCut) return '先行';
      if (r <= midFrontCut) return '中団前';
      if (r <= midCut) return '中団';
      if (x.agariRank != null && x.agariRank <= agariCut) return '差し';
      return '後方';
    }

    function flowOf(x,pos) {
      const goodAgari = x.agariRank != null && x.agariRank <= agariCut;
      const front = pos === '逃げ候補' || pos === '先行';
      const back = pos === '差し' || pos === '後方';
      if (mode === 'fast') {
        if (back && goodAgari) return {code:'tail',label:'▲展開追い風'};
        if (front && cluster.length >= 3) return {code:'head',label:'⚠展開逆風'};
      }
      if (mode === 'slightlyFast') {
        if (back && goodAgari) return {code:'tail',label:'▲展開追い風'};
      }
      if (mode === 'slow') {
        if (front) return {code:'tail',label:'▲展開追い風'};
        if (back) return {code:'head',label:'⚠展開逆風'};
      }
      return {code:'neutral',label:'展開中立'};
    }

    const horses = hs.map(x => {
      const position = posOf(x);
      return {...x, position, flow: flowOf(x, position)};
    });

    let shift = {min:-.3,max:.3}, alt={min:-.6,max:.6}, mainLabel='平均付近', altLabel='前半の競り/牽制で両振れ';
    if (mode === 'fast') {
      shift={min:-.8,max:-.3}; alt={min:.2,max:.7};
      mainLabel='前が競って速い側へ'; altLabel='隊列が早く決まれば遅い側へ';
    } else if (mode === 'slightlyFast') {
      shift={min:-.5,max:-.1}; alt={min:.2,max:.6};
      mainLabel='やや速い側へ'; altLabel='牽制なら遅い側へ';
    } else if (mode === 'slow') {
      shift={min:.2,max:.7}; alt={min:-.5,max:-.1};
      mainLabel='単騎・牽制で遅い側へ'; altLabel='想定外に競れば速い側へ';
    }

    const base = baseAvg33(race);
    const mainRange = base == null ? null : {min:round1(base+shift.min),max:round1(base+shift.max)};
    const altRange = base == null ? null : {min:round1(base+alt.min),max:round1(base+alt.max)};

    const closers = horses.filter(x => ['差し','後方'].includes(x.position) && x.agariRank != null && x.agariRank <= agariCut).length;
    let closerAdv='中';
    if (mode==='fast' && closers>=2) closerAdv='高';
    else if (mode==='slow') closerAdv='低';

    return {horses,timed,cluster,frontPack,clearLeader,coverage,mode,pace,pressure,confidence,closerAdv,base,mainRange,altRange,mainLabel,altLabel};
  }

  function dbScenarioNotes(race, profile) {
    if (profile.base == null || !profile.mainRange) return [];
    let db = null;
    try {
      db = window.MyKeibaDbResultBridgeV44?.savedFor?.(race)
        || window.MyKeibaDbResultBridgeV38?.saved?.();
    } catch {}
    if (!db || !sameRace(db.race, race)) return [];
    const byName = new Map((db.horses || []).map(h => [norm(h.name),h]));
    const out=[];
    for (const x of profile.horses) {
      const d=byName.get(norm(x.h.name));
      const z=parseZone(d?.zone);
      if(!d||!z)continue;
      const baseHit=(gapToZone(profile.base,z) ?? 99) <= .5;
      const mainHit=overlaps(profile.mainRange,z,.25);
      if(baseHit&&!mainHit) out.push({type:'down',horse:x.h,label:`${x.h.number||'—'} ${x.h.name}`,detail:'新聞平均では適合→本線展開ではズレ注意'});
      else if(!baseHit&&mainHit) out.push({type:'up',horse:x.h,label:`${x.h.number||'—'} ${x.h.name}`,detail:'新聞平均ではズレ→本線展開で適合浮上'});
    }
    return out.slice(0,6);
  }

  function rangeText(r) { return r ? `${signed(r.min)}〜${signed(r.max)}` : '—'; }
  function names(list,max=6) {
    const a=list.slice(0,max).map(x=>`${x.h.number||'—'} ${x.h.name}`);
    return a.length?a.join(' / '):'該当なし';
  }

  function groups(profile) {
    const order=['逃げ候補','先行','中団前','中団','差し','後方','不明'];
    return order.map(k=>({k,items:profile.horses.filter(x=>x.position===k)})).filter(g=>g.items.length);
  }

  function cardHtml(race,profile) {
    const notes=dbScenarioNotes(race,profile);
    const tail=profile.horses.filter(x=>x.flow.code==='tail');
    const head=profile.horses.filter(x=>x.flow.code==='head');
    return `<div class="v42-head"><div><small>PACE / POSITION SIM</small><strong>展開シミュレーション <em>試験版</em></strong></div><span>信頼度 ${esc(profile.confidence)}</span></div>
      <div class="v42-metrics">
        <span>想定ペース<b>${esc(profile.pace)}</b></span><span>先行圧<b>${esc(profile.pressure)}</b></span><span>差し有利度<b>${esc(profile.closerAdv)}</b></span>
      </div>
      <div class="v42-33"><b>新聞平均33 ${signed(profile.base)}</b><div><strong>本線：</strong>${esc(profile.mainLabel)} → <b>${rangeText(profile.mainRange)}</b></div><div><strong>逆パターン：</strong>${esc(profile.altLabel)} → <b>${rangeText(profile.altRange)}</b></div></div>
      <details><summary>想定位置取りを見る</summary><div class="v42-groups">${groups(profile).map(g=>`<div><b>${g.k}</b><span>${names(g.items,8)}</span></div>`).join('')}</div></details>
      <div class="v42-flow"><span class="tail">▲追い風 ${esc(names(tail,4))}</span><span class="head">⚠逆風 ${esc(names(head,4))}</span></div>
      ${notes.length?`<div class="v42-shift"><b>33ズレ注目</b>${notes.map(n=>`<span class="${n.type}">${esc(n.label)}：${esc(n.detail)}</span>`).join('')}</div>`:''}
      <p>テン1F過去・前走とテン順から隊列密度を推定。33の数値幅は検証用の仮説で、実戦結果を見ながら調整します。</p>`;
  }

  function decorateRows(race,profile) {
    const body=document.querySelector('#v4DetailBody');
    if(!body)return;
    const byId=new Map(profile.horses.map(x=>[x.h.id,x]));
    body.querySelectorAll('tbody > tr').forEach(tr=>{
      if(tr.classList.contains('v4-horse-detail-row'))return;
      const btn=tr.querySelector('[data-v4-expand]');
      const x=byId.get(btn?.dataset.v4Expand);
      const cell=tr.children?.[1];
      if(!x||!cell)return;
      cell.querySelectorAll('.v42-tag').forEach(e=>e.remove());
      const pos=document.createElement('span');
      pos.className='v42-tag pos'; pos.textContent=x.position; cell.appendChild(pos);
      if(x.flow.code!=='neutral'){
        const flow=document.createElement('span');
        flow.className=`v42-tag ${x.flow.code}`; flow.textContent=x.flow.label; cell.appendChild(flow);
      }
    });
  }

  function decorate() {
    const race=currentRace();
    const body=document.querySelector('#v4DetailBody');
    if(!race||!body)return;
    const profile=paceProfile(race);
    let box=body.querySelector('#v42PaceSim');
    if(!box){
      box=document.createElement('section'); box.id='v42PaceSim'; box.className='v42-card';
      const db=body.querySelector('#v38DbLabSummary');
      const table=body.querySelector('.v4-table-wrap')||body.querySelector('.v4-table');
      if(db)db.insertAdjacentElement('afterend',box); else table?.insertAdjacentElement('beforebegin',box);
    }
    box.innerHTML=cardHtml(race,profile);
    decorateRows(race,profile);
    return profile;
  }

  function consultSection(race) {
    const p=paceProfile(race);
    const notes=dbScenarioNotes(race,p);
    const tail=p.horses.filter(x=>x.flow.code==='tail');
    const head=p.horses.filter(x=>x.flow.code==='head');
    const positionLines=groups(p).map(g=>`${g.k}: ${names(g.items,10)}`);
    return [
      '',
      '■展開シミュレーション（試験版）',
      `新聞平均33: ${signed(p.base)}`,
      `想定ペース: ${p.pace} / 先行圧: ${p.pressure} / 差し有利度: ${p.closerAdv} / 信頼度: ${p.confidence}`,
      `本線33シナリオ: ${p.mainLabel} → ${rangeText(p.mainRange)}`,
      `逆パターン33: ${p.altLabel} → ${rangeText(p.altRange)}`,
      '想定位置取り:',
      ...positionLines.map(x=>`・${x}`),
      `展開追い風: ${names(tail,8)}`,
      `展開逆風: ${names(head,8)}`,
      ...(notes.length?['33ズレ注目:',...notes.map(n=>`・${n.label}: ${n.detail}`)]:['33ズレ注目: 該当なし']),
      '※新聞の平均33を固定値とせず、テンの競合・単騎化で速い側/遅い側へズレた場合も分岐して検討してください。',
      '※この数値幅は検証中の仮説です。DB33評価・KTM・人気と合わせ、過信せず壁打ち材料として扱ってください。'
    ].join('\n');
  }

  function appendConsult() {
    const ta=document.querySelector('#v6ConsultText');
    const race=currentRace();
    if(!ta||!race)return;
    const marker='■展開シミュレーション（試験版）';
    if(ta.value.includes(marker))return;
    ta.value += consultSection(race);
  }

  let timer=null;
  function schedule(ms=80){clearTimeout(timer);timer=setTimeout(()=>requestAnimationFrame(()=>{try{decorate()}catch(e){console.warn('pace sim',e)}}),ms)}

  const style=document.createElement('style');
  style.textContent=`
    .v42-card{margin:12px 0;padding:13px 14px;border:1px solid #d9e5df;border-radius:18px;background:#fff}
    .v42-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.v42-head small{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;color:#2b7b55}.v42-head strong{display:block;font-size:17px;color:#193d2c}.v42-head em{font-style:normal;font-size:9px;padding:2px 5px;border-radius:999px;background:#eef3f0;color:#6c7a72}.v42-head>span{font-size:10px;font-weight:900;color:#60756a}
    .v42-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.v42-metrics span{padding:7px 8px;border-radius:11px;background:#f5f8f6;font-size:9px;color:#6b7b73}.v42-metrics b{display:block;margin-top:2px;font-size:12px;color:#213d2e}
    .v42-33{margin-top:8px;padding:9px 10px;border-radius:12px;background:#f7f5ef;font-size:10px;line-height:1.6;color:#625d50}.v42-33>b{display:block;color:#3e4f45;font-size:12px}.v42-card details{margin-top:8px}.v42-card summary{cursor:pointer;font-size:11px;font-weight:900;color:#2f6248}.v42-groups{display:grid;gap:5px;margin-top:7px}.v42-groups div{display:grid;grid-template-columns:62px 1fr;gap:7px;font-size:10px}.v42-groups b{color:#476557}.v42-groups span{color:#68766f}
    .v42-flow{display:grid;gap:5px;margin-top:9px}.v42-flow span{padding:6px 8px;border-radius:10px;font-size:10px;font-weight:800}.v42-flow .tail{background:#e6f5ec;color:#246844}.v42-flow .head{background:#fff0eb;color:#9b4938}
    .v42-shift{display:grid;gap:5px;margin-top:9px;padding-top:8px;border-top:1px dashed #dce5df}.v42-shift>b{font-size:10px;color:#4e6659}.v42-shift span{font-size:10px;line-height:1.45}.v42-shift .up{color:#436b9a}.v42-shift .down{color:#a15442}.v42-card p{margin:8px 0 0;font-size:9px;line-height:1.5;color:#7a8780}
    .v42-tag{display:inline-flex;margin:4px 0 0 4px;padding:3px 6px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}.v42-tag.pos{background:#eef3f0;color:#52695d}.v42-tag.tail{background:#e4f4ea;color:#23633f}.v42-tag.head{background:#ffebe6;color:#9b4334}
    @media(max-width:520px){.v42-metrics{grid-template-columns:repeat(3,1fr)}.v42-groups div{grid-template-columns:58px 1fr}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]'))schedule(120);
    const b=e.target?.closest?.('button');
    if(b && (b.id==='v5AskLapkun'||b.id==='v6AskLapkun'||/ラップ君に相談/.test(b.textContent||''))) setTimeout(appendConsult,120);
  },true);
  window.addEventListener('pageshow',()=>schedule(120),{passive:true});
  window.addEventListener('mykeiba:resume',()=>schedule(120),{passive:true});
  window.addEventListener('mykeiba:modules-ready',()=>schedule(120));
  window.addEventListener('storage',e=>{if(e.key==='my-keiba-db-result-v2')schedule(60)});
  schedule(400);

  window.MyKeibaPaceSimV42={paceProfile,decorate,consultSection,appendConsult};
})();