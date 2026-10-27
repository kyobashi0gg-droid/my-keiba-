// MY KEIBA LAB v4 - 旧デザイン + 現在の分析機能を統合
(() => {
  if (typeof state === 'undefined') return;

  let v4Tab = 'home';
  let detailRaceId = null;
  let v61Venue = '';
  let v61Day = '';

  const markOptions = ['', '◎', '○', '▲', '☆', '△', '×', '消'];

  function esc(v = '') {
    return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v);
  }

  function entries() {
    return state.races.flatMap(race => (race.horses || []).map(horse => ({ race, horse })));
  }

  function raceAvg33(race) {
    const n = Number(race?.v3Avg33);
    return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n}` : '—';
  }

  function raceKtmCount(race) {
    return (race.horses || []).filter(h => typeof isKtm === 'function' && isKtm(h)).length;
  }

  function raceValueCount(race) {
    return (race.horses || []).filter(h => typeof isValue === 'function' && isValue(h, race)).length;
  }

  function scoreOf(horse, race) {
    return typeof valueScore === 'function' ? valueScore(horse, race) : 0;
  }

  function gradeOf(horse, race) {
    const s = scoreOf(horse, race);
    return typeof scoreGrade === 'function' ? scoreGrade(s) : '';
  }

  function installShell() {
    if (document.querySelector('#v4App')) return;
    document.body.classList.add('integrated-v4');

    const app = document.createElement('div');
    app.id = 'v4App';
    app.innerHTML = `
      <header class="v4-header">
        <div class="v4-brand"><small>PERSONAL RACING ANALYSIS</small><strong>MY KEIBA LAB <span style="font-size:10px;color:#188a53">統合版</span></strong></div>
        <div class="v4-actions">
          <button class="v4-icon-btn" id="v4PdfBtn">新聞PDF</button>
          <button class="v4-icon-btn" id="v4SaveBtn">保存</button>
        </div>
      </header>
      <main class="v4-main">
        <section class="v4-view" data-view="home"></section>
        <section class="v4-view" data-view="races" hidden></section>
        <section class="v4-view" data-view="ktm" hidden></section>
        <section class="v4-view" data-view="horses" hidden></section>
        <section class="v4-view" data-view="results" hidden></section>
      </main>
      <nav class="v4-bottom" aria-label="統合版ナビ">
        <button class="v4-nav active" data-tab="home"><b>⌂</b><span>ホーム</span></button>
        <button class="v4-nav" data-tab="races"><b>▥</b><span>レース</span></button>
        <button class="v4-nav" data-tab="ktm"><b>K</b><span>KTM</span></button>
        <button class="v4-nav" data-tab="horses"><b>DB</b><span>競走馬</span></button>
        <button class="v4-nav" data-tab="results"><b>★</b><span>結果</span></button>
      </nav>
      <div class="v4-detail" id="v4Detail" hidden>
        <div class="v4-sheet" role="dialog" aria-modal="true">
          <div class="v4-sheet-head"><div id="v4DetailTitle"></div><button class="v4-close" id="v4CloseDetail">閉じる</button></div>
          <div class="v4-sheet-body" id="v4DetailBody"></div>
        </div>
      </div>`;

    document.body.insertBefore(app, document.body.firstChild);

    document.querySelector('#v4PdfBtn').addEventListener('click', () => document.querySelector('#sourceInput')?.click());
    document.querySelector('#v4SaveBtn').addEventListener('click', () => document.querySelector('#exportBtn')?.click());
    document.querySelector('#v4CloseDetail').addEventListener('click', closeDetail);
    document.querySelector('#v4Detail').addEventListener('click', e => { if (e.target.id === 'v4Detail') closeDetail(); });
    document.querySelectorAll('.v4-nav').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  }

  function setTab(tab) {
    v4Tab = tab;
    document.querySelectorAll('.v4-view').forEach(v => v.hidden = v.dataset.view !== tab);
    document.querySelectorAll('.v4-nav').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    renderV4();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function homeHtml() {
    const all = entries();
    const ktm = all.filter(({ horse }) => isKtm(horse));
    const values = all.filter(({ horse, race }) => isValue(horse, race));
    const ranked = all
      .map(e => ({ ...e, score: scoreOf(e.horse, e.race) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return `
      <article class="v4-card soft">
        <p class="v4-eyebrow">TODAY'S BOARD</p><h1 class="v4-h1">予想を、1画面で整理。</h1>
        <p class="v4-muted">新聞PDFからKTM・調教・33ラップを取り込み、以前の見やすいレース表に統合しました。</p>
        <div class="v4-stat-grid">
          <div class="v4-stat"><span>登録レース</span><strong>${state.races.length}</strong></div>
          <div class="v4-stat"><span>KTM</span><strong>${ktm.length}</strong></div>
          <div class="v4-stat"><span>穴注目</span><strong>${values.length}</strong></div>
        </div>
        <div class="v4-action-grid"><button class="v4-primary wide" data-v4-action="pdf">＋ 新聞PDFを読み込む</button><button class="v4-secondary" data-v4-tab="races">レース一覧</button><button class="v4-secondary" data-v4-tab="ktm">KTMを見る</button></div>
      </article>

      <div class="v4-section-head"><div><p class="v4-eyebrow">VALUE RANKING</p><h2 class="v4-h2">穴候補 上位</h2></div><button class="v4-link" data-v4-tab="races">全レース</button></div>
      <div class="v4-horse-list">
        ${ranked.length ? ranked.map(({ race, horse, score }, i) => `
          <button class="v4-race-card" data-v4-race="${esc(race.id)}">
            <div class="v4-race-top"><div class="v4-race-no">${i + 1}</div><div class="v4-race-title"><strong>${esc(horse.name)}</strong><small>${esc(race.track)} ${esc(race.raceNo)}R ${esc(race.raceName)} ・ ${score}pt</small></div><span class="v4-chevron">›</span></div>
            <div class="v4-race-tags">${isKtm(horse) ? '<span class="v4-chip ktm">KTM</span>' : ''}${horse.lap ? `<span class="v4-chip lap">新聞33 ${esc(horse.lap)}</span>` : ''}${isValue(horse, race) ? `<span class="v4-chip value">穴${esc(gradeOf(horse, race))} ${score}pt</span>` : ''}</div>
          </button>`).join('') : '<div class="v4-empty"><strong>まだ分析データがありません</strong>新聞PDFを読み込むと自動で表示されます。</div>'}
      </div>`;
  }

  function raceCardsHtml(races) {
    if (!races.length) return '<div class="v4-empty"><strong>レースがありません</strong>新聞PDFを読み込んでください。</div>';
    return `<div class="v4-race-list">${races.map(race => `
      <button class="v4-race-card" data-v4-race="${esc(race.id)}">
        <div class="v4-race-top"><div class="v4-race-no">${esc(race.raceNo)}R</div><div class="v4-race-title"><strong>${esc(race.track)} ${esc(race.raceName)}</strong><small>${esc(race.v3Course || '')}${race.v3Course ? ' ・ ' : ''}平均33 ${raceAvg33(race)} ・ ${esc(race.v3RaceLevel || 'レベル未取得')}</small></div><span class="v4-chevron">›</span></div>
        <div class="v4-race-tags"><span class="v4-chip">${(race.horses || []).length}頭</span>${raceKtmCount(race) ? `<span class="v4-chip ktm">KTM ${raceKtmCount(race)}</span>` : ''}${raceValueCount(race) ? `<span class="v4-chip value">穴注目 ${raceValueCount(race)}</span>` : ''}<span class="v4-chip lap">平均33 ${raceAvg33(race)}</span></div>
      </button>`).join('')}</div>`;
  }

  function dateOf(race) {
    return String(race?.v3DateLabel || race?.date || '').trim();
  }
  function venueName(race) {
    return String(race?.track || '').replace(/競馬場/g, '').trim();
  }
  function venueOrder(names) {
    const standard = ['新潟','京都','東京','札幌','函館','福島','中山','中京','阪神','小倉'];
    return [...names].sort((a,b)=>{
      const ai=standard.indexOf(a),bi=standard.indexOf(b);
      return (ai<0?99:ai)-(bi<0?99:bi)||a.localeCompare(b,'ja');
    });
  }
  function filteredRaces() {
    if (!v61Venue) return state.races;
    const selected=state.races.filter(r=>venueName(r)===v61Venue);
    const dates=[...new Set(selected.map(dateOf))].filter(Boolean).sort();
    if (dates.length>1 && !dates.includes(v61Day)) v61Day=dates[dates.length-1];
    if (dates.length<=1) v61Day='';
    const shown= v61Day?selected.filter(r=>dateOf(r)===v61Day):selected;
    return [...shown].sort((a,b)=>Number(a.raceNo||99)-Number(b.raceNo||99));
  }
  function racesHtml() {
    const venues=venueOrder(new Set(state.races.map(venueName).filter(Boolean)));
    if(v61Venue && !venues.includes(v61Venue)){v61Venue='';v61Day='';}
    const picked=filteredRaces();
    const venueButtons=[{name:'',label:'全'},...venues.map(name=>({name,label:name}))]
      .map(x=>`<button type="button" class="v61-venue ${v61Venue===x.name?'active':''}" data-v61-venue="${esc(x.name)}" aria-pressed="${v61Venue===x.name}" aria-label="${x.name?esc(x.name):'全場'}">${esc(x.label)}</button>`).join('');
    const days=v61Venue?[...new Set(state.races.filter(r=>venueName(r)===v61Venue).map(dateOf))].filter(Boolean).sort():[];
    const dayButtons=days.length>1?`<div class="v61-day-tabs" role="group" aria-label="開催日">${days.map(x=>`<button type="button" class="v61-day ${v61Day===x?'active':''}" data-v61-day="${esc(x)}" aria-pressed="${v61Day===x}">${esc(x)}</button>`).join('')}</div>`:'';
    return `<div class="v4-section-head v61-race-head"><div class="v61-race-title"><p class="v4-eyebrow">RACE BOARD</p><h1 class="v4-h1" style="margin:0">レース</h1></div>
      <div class="v61-venues" role="group" aria-label="開催場で絞り込む">${venueButtons}</div>
      <button class="v4-link" data-v4-action="pdf">新聞取込</button></div>${dayButtons}
      <p class="v61-filter-count">${v61Venue?`${esc(v61Venue)} ${picked.length}レースを表示`:`全場 ${picked.length}レースを表示`}</p>${raceCardsHtml(picked)}`;
  }
    function ktmHtml() {
    const ktms = entries().filter(({ horse }) => isKtm(horse));
    return `<div class="v4-section-head"><div><p class="v4-eyebrow">KTM LIST</p><h1 class="v4-h1" style="margin:0">KTM</h1></div><span class="v4-muted">${ktms.length}頭</span></div>
      <div class="v4-horse-list">${ktms.length ? ktms.map(({ race, horse }) => `
        <button class="v4-race-card" data-v4-race="${esc(race.id)}"><div class="v4-race-top"><div class="v4-race-no">${esc(race.raceNo)}R</div><div class="v4-race-title"><strong>${esc(horse.name)}</strong><small>${esc(race.track)} ${esc(race.raceName)} ・ ${horse.popularity || '—'}人気 / ${horse.odds || '—'}倍</small></div><span class="v4-chevron">›</span></div><div class="v4-race-tags"><span class="v4-chip ktm">調教${esc(horse.mark)}・前走比${Number(horse.diff) >= 0 ? '+' : ''}${esc(horse.diff)}</span>${horse.lap ? `<span class="v4-chip lap">新聞33 ${esc(horse.lap)}</span>` : ''}</div></button>`).join('') : '<div class="v4-empty"><strong>KTM該当馬なし</strong>現在のKTM条件に該当する馬はいません。</div>'}</div>`;
  }

  function horsesHtml(query = '') {
    const q = query.trim().toLowerCase();
    const all = entries().filter(({ horse }) => !q || String(horse.name || '').toLowerCase().includes(q));
    return `<div class="v4-section-head"><div><p class="v4-eyebrow">HORSE DB</p><h1 class="v4-h1" style="margin:0">競走馬</h1></div><span class="v4-muted">${all.length}頭</span></div>
      <input id="v4HorseSearch" class="v4-search" placeholder="馬名を検索" value="${esc(query)}">
      <div class="v4-horse-list">${all.slice(0,100).map(({ race, horse }) => `<button class="v4-horse-card" data-v4-race="${esc(race.id)}"><div class="v4-horse-card-top"><div><strong>${esc(horse.name)}</strong><br><small>${esc(race.track)} ${esc(race.raceNo)}R ${esc(race.raceName)}</small></div><div>${isKtm(horse) ? '<span class="v4-ktm">KTM</span>' : ''}</div></div><div class="v4-horse-meta">${horse.popularity || '—'}人気 / ${horse.odds || '—'}倍 ・ 調教${horse.mark || '—'} ${horse.trainingScore || '—'} ・ 新聞33 ${horse.lap || '—'}</div></button>`).join('') || '<div class="v4-empty">該当する馬がありません。</div>'}</div>`;
  }

  function resultsHtml() {
    return `<article class="v4-card soft"><p class="v4-eyebrow">RESULTS</p><h1 class="v4-h1">結果・振り返り</h1><p class="v4-muted">ここは次の拡張枠です。予想時の自分印・KTM・33ラップ評価と実着順を残し、「なぜ当たった／外れたか」を後から壁打ちできる形にします。</p><div class="v4-roadmap"><div class="v4-road on"><strong>予想保存</strong><small>自分印対応</small></div><div class="v4-road future"><strong>実着順</strong><small>予定</small></div><div class="v4-road future"><strong>回顧</strong><small>予定</small></div><div class="v4-road future"><strong>傾向学習</strong><small>予定</small></div></div></article>`;
  }

  function renderV4() {
    installShell();
    const home = document.querySelector('[data-view="home"]');
    const races = document.querySelector('[data-view="races"]');
    const ktm = document.querySelector('[data-view="ktm"]');
    const horses = document.querySelector('[data-view="horses"]');
    const results = document.querySelector('[data-view="results"]');

    if (home) home.innerHTML = homeHtml();
    if (races) races.innerHTML = racesHtml();
    if (ktm) ktm.innerHTML = ktmHtml();
    if (horses && !horses.querySelector('#v4HorseSearch:focus')) horses.innerHTML = horsesHtml('');
    if (results) results.innerHTML = resultsHtml();

    document.querySelectorAll('[data-v4-tab]').forEach(b => b.onclick = () => setTab(b.dataset.v4Tab));
    document.querySelectorAll('[data-v4-action="pdf"]').forEach(b => b.onclick = () => document.querySelector('#sourceInput')?.click());
    document.querySelectorAll('[data-v4-race]').forEach(b => b.onclick = () => openDetail(b.dataset.v4Race));
    document.querySelectorAll('[data-v61-venue]').forEach(btn => btn.onclick=()=>{v61Venue=btn.dataset.v61Venue;v61Day='';renderV4();});
    document.querySelectorAll('[data-v61-day]').forEach(btn => btn.onclick=()=>{v61Day=btn.dataset.v61Day;renderV4();});

    const search = document.querySelector('#v4HorseSearch');
    if (search) search.oninput = () => {
      const view = document.querySelector('[data-view="horses"]');
      const caret = search.selectionStart;
      view.innerHTML = horsesHtml(search.value);
      const next = document.querySelector('#v4HorseSearch');
      next.focus();
      next.setSelectionRange(caret, caret);
      next.oninput = search.oninput;
      document.querySelectorAll('[data-v4-race]').forEach(b => b.onclick = () => openDetail(b.dataset.v4Race));
    };

    if (detailRaceId && !document.querySelector('#v4Detail').hidden) renderDetail(detailRaceId);
  }

  function markSelect(horse, race) {
    return `<select class="v4-mark-select" data-v4-mark-race="${esc(race.id)}" data-v4-mark-horse="${esc(horse.id)}">${markOptions.map(m => `<option value="${m}" ${String(horse.userMark || '') === m ? 'selected' : ''}>${m || '—'}</option>`).join('')}</select>`;
  }

  function historyHtml(horse) {
    const samples = horse.v3History33 || [];
    if (!samples.length) return '<span>過去33データなし</span>';
    return samples.map(s => `<span>${Number(s.value) >= 0 ? '+' : ''}${esc(s.value)} / ${s.finish ? `${esc(s.finish)}着` : '着順—'}</span>`).join('');
  }

  
  // Quick race switching inside the detail sheet, without returning to the race list.
  function addQuickRaceNav(title, race) {
    const all = Array.isArray(state.races) ? state.races : [];
    if (all.length < 2 || !title) return;
    if (!document.getElementById('v67-quick-race-css')) {
      const style=document.createElement('style');
      style.id='v67-quick-race-css';
      style.textContent='.v67-race-nav{margin-top:11px;padding:12px;border:1px solid #cfe6dc;border-radius:14px;background:#f5fbf7;color:#143c30}.v67-race-nav .v67-quick-title{font-size:12px;font-weight:800;margin-bottom:7px}.v67-race-fields{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:6px}.v67-race-fields label{font-size:10px;color:#597e6b;font-weight:750}.v67-race-fields select{display:block;width:100%;max-width:100%;border:1px solid #bddccc;border-radius:8px;background:white;color:#194633;padding:7px 3px;font-size:12px}.v67-race-arrows{display:flex;gap:8px;margin-top:8px}.v67-race-arrows button{flex:1;background:#e4f2e8;border:1px solid #b2d6c2;color:#0d6e4e;border-radius:9px;font-weight:750;padding:8px 6px}.v67-race-arrows button:disabled{opacity:.4}.v67-race-info{font-size:10px;color:#6b8675;margin-top:5px}@media(max-width:480px){.v67-race-fields{grid-template-columns:1.1fr 1fr .8fr}.v67-race-fields select{font-size:11px}}';
      document.head.appendChild(style);
    }
    const unique=(items)=>Array.from(new Set(items));
    const d=dateOf(race), v=venueName(race), number=Number(race.raceNo);
    const dates=unique(all.map(dateOf)).sort().reverse();
    const sameDay=all.filter(r=>dateOf(r)===d);
    const venues=unique(sameDay.map(venueName));
    const inVenue=sameDay.filter(r=>venueName(r)===v).sort((a,b)=>Number(a.raceNo)-Number(b.raceNo));
    const nav=document.createElement('div');nav.className='v67-race-nav';
    const caption=document.createElement('div');caption.className='v67-quick-title';caption.textContent='レースを切り替える（一覧に戻らず移動）';nav.appendChild(caption);
    const fields=document.createElement('div');fields.className='v67-race-fields';
    function field(label,options,selected,labeler) {
      const wrap=document.createElement('label');wrap.textContent=label;
      const select=document.createElement('select');select.setAttribute('aria-label',label);
      options.forEach(value=>{
        const opt=document.createElement('option');opt.value=String(value);
        opt.textContent=String(labeler?labeler(value):value);
        if(String(value)===String(selected))opt.selected=true;
        select.appendChild(opt);
      });
      wrap.appendChild(select);fields.appendChild(wrap);return select;
    }
    const dayField=field('開催日',dates,d,x=>x||'日付未設定');
    const venueField=field('競馬場',venues,v);
    const raceField=field('レース',inVenue.map(r=>r.id),race.id,id=>{
      const r=inVenue.find(r=>String(r.id)===String(id));
      return r ? String(r.raceNo)+'R '+String(r.raceName||'') : 'レース';
    });
    nav.appendChild(fields);
    function changeTo(date,venue,no,id) {
      let pool=all.filter(r=>dateOf(r)===date);
      if(!pool.length)return;
      const sameVenue=pool.filter(r=>venueName(r)===venue);
      if(sameVenue.length)pool=sameVenue;
      let target=id?pool.find(r=>String(r.id)===String(id)):null;
      if(!target && no)target=pool.find(r=>Number(r.raceNo)===Number(no));
      if(!target)target=pool.slice().sort((a,b)=>Number(a.raceNo)-Number(b.raceNo))[0];
      if(target)renderDetail(target.id);
    }
    dayField.onchange=()=>changeTo(dayField.value,v,number,null);
    venueField.onchange=()=>changeTo(d,venueField.value,number,null);
    raceField.onchange=()=>changeTo(d,v,null,raceField.value);
    const arrows=document.createElement('div');arrows.className='v67-race-arrows';
    const pos=inVenue.findIndex(r=>String(r.id)===String(race.id));
    function arrow(text,offset){
      const button=document.createElement('button');button.type='button';button.textContent=text;
      const target=inVenue[pos+offset];button.disabled=!target;
      button.onclick=()=>{if(target)renderDetail(target.id)};
      arrows.appendChild(button);
    }
    arrow('‹ 前のレース',-1);arrow('次のレース ›',1);nav.appendChild(arrows);
    title.appendChild(nav);
  }


  // Keep the race detail open while browsing its runners.
  function addQuickHorseNav(body, race) {
    const runners=Array.isArray(race.horses)?race.horses:[];
    if(runners.length<2)return;
    if(!document.getElementById('v67-quick-horse-css')){
      const style=document.createElement('style');
      style.id='v67-quick-horse-css';
      style.textContent='.v67-horse-nav{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px;background:#edf8f1;border:1px solid #c4e2cf;border-radius:12px;margin:8px 0 13px}.v67-horse-nav strong{font-size:12px;color:#175e47;margin-right:auto}.v67-horse-nav button{border:1px solid #b7dbca;border-radius:8px;background:white;color:#117050;padding:7px 9px;font-size:12px;font-weight:800}.v67-horse-nav select{min-width:160px;max-width:100%;flex:1;border:1px solid #b7dbca;border-radius:8px;padding:7px;background:white;color:#174935}.v67-horse-nav small{color:#577965;font-size:10px}@media(max-width:480px){.v67-horse-nav strong{flex-basis:100%}.v67-horse-nav select{min-width:120px}}';
      document.head.appendChild(style);
    }
    const bar=document.createElement('div');bar.className='v67-horse-nav';
    const label=document.createElement('strong');label.textContent='出走馬の詳細を切り替える';bar.appendChild(label);
    const prev=document.createElement('button');prev.type='button';prev.textContent='‹ 前の馬';bar.appendChild(prev);
    const select=document.createElement('select');select.setAttribute('aria-label','出走馬を選択');
    runners.forEach((h,i)=>{
      const opt=document.createElement('option');opt.value=String(i);
      opt.textContent=String(h.number||i+1)+'　'+String(h.name||'馬名未登録');select.appendChild(opt);
    });
    bar.appendChild(select);
    const next=document.createElement('button');next.type='button';next.textContent='次の馬 ›';bar.appendChild(next);
    const pos=document.createElement('small');pos.textContent='未選択';bar.appendChild(pos);
    const summary=body.querySelector('.v4-summary-line');
    if(summary)summary.insertAdjacentElement('afterend',bar);
    else body.insertBefore(bar,body.firstChild);
    let index=-1;
    const openHorse=i=>{
      if(!runners.length)return;
      index=(i+runners.length)%runners.length;
      select.value=String(index);pos.textContent=String(index+1)+' / '+runners.length+'頭';
      body.querySelectorAll('.v4-horse-detail-row').forEach(row=>row.hidden=true);
      const h=runners[index];
      const row=body.querySelector('[data-v4-detail-row="'+CSS.escape(String(h.id))+'"]');
      if(row){row.hidden=false;row.scrollIntoView({block:'center',behavior:'smooth'});}
    };
    prev.onclick=()=>openHorse(index<0?runners.length-1:index-1);
    next.onclick=()=>openHorse(index<0?0:index+1);
    select.onchange=()=>openHorse(Number(select.value));
  }

function renderDetail(id) {
    const race = state.races.find(r => r.id === id);
    if (!race) return closeDetail();
    detailRaceId = id;
    const title = document.querySelector('#v4DetailTitle');
    const body = document.querySelector('#v4DetailBody');
    title.innerHTML = `<p class="v4-eyebrow">RACE DETAIL</p><h2>${esc(race.track)} ${esc(race.raceNo)}R ${esc(race.raceName)}</h2><p>${esc(race.v3Course || '')} ・ 平均33 ${raceAvg33(race)} ・ ${esc(race.v3RaceLevel || 'レベル未取得')}</p>`;
    addQuickRaceNav(title, race);

    body.innerHTML = `
      <div class="v4-summary-line"><span class="v4-chip">${(race.horses || []).length}頭</span><span class="v4-chip lap">平均33 ${raceAvg33(race)}</span>${raceKtmCount(race) ? `<span class="v4-chip ktm">KTM ${raceKtmCount(race)}</span>` : ''}${raceValueCount(race) ? `<span class="v4-chip value">穴注目 ${raceValueCount(race)}</span>` : ''}</div>
      <div class="v4-table-wrap"><table class="v4-table"><thead><tr><th>馬番</th><th>馬名</th><th>単勝/人気</th><th>自分印</th><th>調教</th><th>採点</th><th>前走比</th><th>新聞33</th><th>KTM</th><th>穴</th><th></th></tr></thead><tbody>
      ${(race.horses || []).map(horse => {
        const score = scoreOf(horse, race);
        const g = String(horse.lap || '').toLowerCase();
        return `<tr><td class="v4-num">${esc(horse.number || '—')}</td><td class="v4-name">${esc(horse.name)}</td><td>${horse.odds || '—'}倍 / ${horse.popularity || '—'}人気</td><td>${markSelect(horse, race)}</td><td>${esc(horse.mark || '—')}</td><td>${esc(horse.trainingScore || '—')}</td><td>${horse.diff !== '' && horse.diff != null ? `${Number(horse.diff) >= 0 ? '+' : ''}${esc(horse.diff)}` : '—'}</td><td>${horse.lap ? `<span class="v4-grade ${g}">${esc(horse.lap)}</span>` : '—'}</td><td>${isKtm(horse) ? '<span class="v4-ktm">KTM</span>' : ''}</td><td>${isValue(horse, race) ? `<span class="v4-value">${score}pt</span>` : `${score}pt`}</td><td><button class="v4-mini-btn" data-v4-expand="${esc(horse.id)}">詳細</button></td></tr>
        <tr class="v4-horse-detail-row" data-v4-detail-row="${esc(horse.id)}" hidden><td colspan="11"><div class="v4-horse-detail"><div class="v4-detail-box"><strong>新聞33評価（補助）</strong><p>${esc(horse.lapReason || '評価理由は未取得')}</p><div class="v4-history">${historyHtml(horse)}</div></div><div class="v4-detail-box"><strong>調教・変身材料</strong><p>調教印 ${esc(horse.mark || '—')} / 採点 ${esc(horse.trainingScore || '—')} / 前走比 ${horse.diff !== '' && horse.diff != null ? `${Number(horse.diff) >= 0 ? '+' : ''}${esc(horse.diff)}` : '—'}${horse.v3Blinker ? ' / B着用' : ''}</p></div><div class="v4-detail-box"><strong>壁打ち枠</strong><p>33: ${esc(horse.lap || '—')}<br>ラップ君: 未連携<br>テン: 未連携<br>上がり: 未連携</p></div></div></td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="v4-edit-bar"><button class="v4-secondary" id="v4EditRace">編集する</button><button class="v4-primary" id="v4CloseBottom">一覧へ戻る</button></div>`;

    addQuickHorseNav(body, race);

    body.querySelectorAll('[data-v4-expand]').forEach(btn => btn.onclick = () => {
      const row = body.querySelector(`[data-v4-detail-row="${CSS.escape(btn.dataset.v4Expand)}"]`);
      if (row) row.hidden = !row.hidden;
    });

    body.querySelectorAll('[data-v4-mark-race]').forEach(sel => sel.onchange = () => {
      const r = state.races.find(x => x.id === sel.dataset.v4MarkRace);
      const h = r?.horses?.find(x => x.id === sel.dataset.v4MarkHorse);
      if (!h) return;
      h.userMark = sel.value;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    });

    body.querySelector('#v4EditRace').onclick = () => { closeDetail(); openRaceEditor(race.id); };
    body.querySelector('#v4CloseBottom').onclick = closeDetail;
  }

  function openDetail(id) {
    document.querySelector('#v4Detail').hidden = false;
    document.body.style.overflow = 'hidden';
    renderDetail(id);
  }

  function closeDetail() {
    const d = document.querySelector('#v4Detail');
    if (d) d.hidden = true;
    detailRaceId = null;
    document.body.style.overflow = '';
  }

  installShell();

  if (typeof render === 'function') {
    const baseRender = render;
    render = function() {
      baseRender();
      renderV4();
    };
  }

  renderV4();
})();