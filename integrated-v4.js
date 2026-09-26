// MY KEIBA LAB v4 - 旧デザイン + 現在の分析機能を統合
(() => {
  if (typeof state === 'undefined') return;

  let v4Tab = 'home';
  let detailRaceId = null;

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

      <article class="v4-card">
        <div class="v4-section-head"><div><p class="v4-eyebrow">WALLBOARD LAB</p><h2 class="v4-h2">壁打ち材料</h2></div><span class="v4-muted">拡張前提</span></div>
        <div class="v4-roadmap">
          <div class="v4-road on"><strong>33ラップ</strong><small>自動評価</small></div>
          <div class="v4-road future"><strong>ラップ君</strong><small>次段階</small></div>
          <div class="v4-road future"><strong>テン</strong><small>次段階</small></div>
          <div class="v4-road future"><strong>上がり</strong><small>次段階</small></div>
        </div>
        <p class="v4-muted" style="margin:12px 0 0">今後はこの4軸を同じ馬ごとに並べ、展開・人気・調教と合わせて壁打ちしやすい形へ拡張します。</p>
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

  function racesHtml() {
    return `<div class="v4-section-head"><div><p class="v4-eyebrow">RACE BOARD</p><h1 class="v4-h1" style="margin:0">レース</h1></div><button class="v4-link" data-v4-action="pdf">新聞取込</button></div>${raceCardsHtml(state.races)}`;
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

  function renderDetail(id) {
    const race = state.races.find(r => r.id === id);
    if (!race) return closeDetail();
    detailRaceId = id;
    const title = document.querySelector('#v4DetailTitle');
    const body = document.querySelector('#v4DetailBody');
    title.innerHTML = `<p class="v4-eyebrow">RACE DETAIL</p><h2>${esc(race.track)} ${esc(race.raceNo)}R ${esc(race.raceName)}</h2><p>${esc(race.v3Course || '')} ・ 平均33 ${raceAvg33(race)} ・ ${esc(race.v3RaceLevel || 'レベル未取得')}</p>`;

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