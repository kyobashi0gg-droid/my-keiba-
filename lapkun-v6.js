// MY KEIBA LAB v6 - mobile table + wall-butting prompt polish
(() => {
  if (typeof state === 'undefined') return;

  let busy = false;

  const esc6 = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const val = v => (v === '' || v == null ? '—' : String(v));
  const num = v => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function metricIndex(headRow, label) {
    return [...headRow.children].findIndex(th => th.textContent.trim() === label);
  }

  function rankBadge(v) {
    const n = num(v);
    if (n == null) return '<span class="v6-missing">—</span>';
    const cls = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'other';
    return `<span class="v6-rank-badge ${cls}" aria-label="${n}位">${n}<small>位</small></span>`;
  }

  function timePill(v) {
    if (v === '' || v == null) return '<span class="v6-missing">—</span>';
    return `<span class="v6-time-pill">${esc6(v)}</span>`;
  }

  function decorateTable() {
    const body = document.querySelector('#v4DetailBody');
    const table = body?.querySelector('.v4-table');
    if (!body || !table || table.dataset.v6 === '1') return;

    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const pastIdx = metricIndex(headRow, 'テン1F過去');
    const prevIdx = metricIndex(headRow, 'テン1F前走');
    const tenIdx = metricIndex(headRow, 'テン順');
    const agariIdx = metricIndex(headRow, '上がり順');
    if ([pastIdx, prevIdx, tenIdx, agariIdx].some(i => i < 0)) return; // wait for v5 augmentation

    table.dataset.v6 = '1';
    table.classList.add('v6-table');

    const headCells = [...headRow.children];
    if (headCells[0]) headCells[0].classList.add('v6-sticky-no');
    if (headCells[1]) headCells[1].classList.add('v6-sticky-name');

    [pastIdx, prevIdx].forEach(i => headCells[i]?.classList.add('v6-metric-head', 'v6-time-head'));
    [tenIdx, agariIdx].forEach(i => headCells[i]?.classList.add('v6-metric-head', 'v6-rank-head'));
    if (headCells[pastIdx]) headCells[pastIdx].classList.add('v6-group-start');
    if (headCells[agariIdx]) headCells[agariIdx].classList.add('v6-group-end');

    const rows = [...table.querySelectorAll('tbody > tr')].filter(tr => !tr.classList.contains('v4-horse-detail-row'));
    rows.forEach(tr => {
      const cells = [...tr.children];
      if (cells[0]) cells[0].classList.add('v6-sticky-no');
      if (cells[1]) cells[1].classList.add('v6-sticky-name');

      if (cells[pastIdx]) {
        cells[pastIdx].classList.add('v6-metric-cell', 'v6-time-cell', 'v6-group-start');
        cells[pastIdx].innerHTML = timePill(cells[pastIdx].textContent.trim() === '—' ? '' : cells[pastIdx].textContent.trim());
      }
      if (cells[prevIdx]) {
        cells[prevIdx].classList.add('v6-metric-cell', 'v6-time-cell');
        cells[prevIdx].innerHTML = timePill(cells[prevIdx].textContent.trim() === '—' ? '' : cells[prevIdx].textContent.trim());
      }
      if (cells[tenIdx]) {
        cells[tenIdx].classList.add('v6-metric-cell', 'v6-rank-cell');
        cells[tenIdx].innerHTML = rankBadge(cells[tenIdx].textContent.trim());
      }
      if (cells[agariIdx]) {
        cells[agariIdx].classList.add('v6-metric-cell', 'v6-rank-cell', 'v6-group-end');
        cells[agariIdx].innerHTML = rankBadge(cells[agariIdx].textContent.trim());
      }
    });

    const wrap = table.closest('.v4-table-wrap');
    if (wrap && !body.querySelector('.v6-metric-guide')) {
      const guide = document.createElement('div');
      guide.className = 'v6-metric-guide';
      guide.innerHTML = '<span>馬番・馬名は固定</span><span class="v6-guide-rank one">1位</span><span class="v6-guide-rank two">2位</span><span class="v6-guide-rank three">3位</span><small>右へスクロールして比較</small>';
      wrap.insertAdjacentElement('beforebegin', guide);
    }
  }

  function sortedTop(race, key, max = 3) {
    return (race.horses || [])
      .map(h => ({ h, n: num(h[key]) }))
      .filter(x => x.n != null)
      .sort((a, b) => a.n - b.n)
      .slice(0, max);
  }

  function horseLabel(x) {
    return `${x.h.number || '—'}番 ${x.h.name}(${x.n}位)`;
  }

  function signed(v) {
    if (v === '' || v == null || Number.isNaN(Number(v))) return '—';
    const n = Number(v);
    return `${n >= 0 ? '+' : ''}${n}`;
  }

  function dbResultFor(race) {
    try {
      return window.MyKeibaDbResultBridgeV44?.savedFor?.(race)
        || window.MyKeibaDbResultBridgeV38?.saved?.()
        || null;
    } catch { return null; }
  }

  function dbResultMap(race) {
    const db = dbResultFor(race);
    const normalize = v => window.MyKeibaDataV16?.normalizeHorseName
      ? window.MyKeibaDataV16.normalizeHorseName(v)
      : String(v || '').replace(/[\s　・･]/g, '').trim();
    return new Map((db?.horses || []).map(h => [normalize(h.name), h]));
  }

  function dbResultLabel(d) {
    if (!d) return '—';
    return d.label ? `${d.mark || ''} ${d.label}`.trim() : (d.mark || '—');
  }

  function factSummary(race) {
    const tenTop = sortedTop(race, 'tenRank');
    const agariTop = sortedTop(race, 'agariRank');
    const ktm = (race.horses || []).filter(h => typeof isKtm === 'function' && isKtm(h));
    const newspaperGood = (race.horses || []).filter(h => ['S', 'A'].includes(String(h.lap || '').toUpperCase()));
    const missing = (race.horses || []).filter(h => !h.tenPast1f || !h.tenPrev1f || !h.tenRank || !h.agariRank).length;
    const db = dbResultFor(race);
    const counts = {};
    let ability = 0;
    for (const d of (db?.horses || [])) {
      const key = d.mark || '—';
      counts[key] = (counts[key] || 0) + 1;
      if (d.abilityCode === 'ability') ability++;
    }
    const dbSummary = db
      ? `◎${counts['◎']||0} / ○${counts['○']||0} / ▲${counts['▲']||0} / ⚠${counts['⚠']||0} / 逆◎${counts['逆◎']||0} / 中間${counts['—']||0}${ability ? ` / ◇能力型${ability}` : ''}`
      : '未保存';

    return [
      `テン順上位（位置取り・ペース用）: ${tenTop.length ? tenTop.map(horseLabel).join(' / ') : 'データなし'}`,
      `上がり順上位（位置取り・展開確認用）: ${agariTop.length ? agariTop.map(horseLabel).join(' / ') : 'データなし'}`,
      `KTM: ${ktm.length ? ktm.map(h => `${h.number || '—'}番 ${h.name}`).join(' / ') : '該当なし'}`,
      `DB33主評価: ${dbSummary}`,
      `新聞33 S/A（補助）: ${newspaperGood.length ? newspaperGood.map(h => `${h.number || '—'}番 ${h.name}(${h.lap})`).join(' / ') : '該当なし'}`,
      `4項目に欠損がある馬: ${missing}頭（欠損値は推測せず扱う）`,
    ];
  }

  function buildConsultText(race) {
    const weather = race.weather && race.weather !== '未設定' ? race.weather : '未設定';
    const going = race.going && race.going !== '未設定' ? race.going : '未設定';
    const memo = race.paceMemo || '—';
    const facts = factSummary(race);
    const dbMap = dbResultMap(race);
    const normalize = v => window.MyKeibaDataV16?.normalizeHorseName
      ? window.MyKeibaDataV16.normalizeHorseName(v)
      : String(v || '').replace(/[\s　・･]/g, '').trim();

    const lines = [
      '【ラップ君 壁打ち依頼 / MY KEIBA LAB】',
      `${race.track}${race.raceNo}R ${race.raceName}`,
      '',
      '■レース条件',
      `コース: ${race.v3Course || '—'}`,
      `平均33ラップ: ${race.v3Avg33 ?? '—'}`,
      `レースレベル: ${race.v3RaceLevel || '—'}`,
      `天気: ${weather} / 馬場: ${going}`,
      `展開・馬場メモ: ${memo}`,
      '',
      '■全馬データ',
      '馬番|馬名|人気|オッズ|自分印|KTM|調教印|調教採点|前走比|新聞33|DB33主評価|コア33|DB根拠|テン1F過去|テン1F前走|テン順|上がり順',
      ...(race.horses || []).map(h => {
        const d = dbMap.get(normalize(h.name));
        return [
          h.number || '', h.name || '', h.popularity || '', h.odds || '', h.userMark || '',
          (typeof isKtm === 'function' && isKtm(h)) ? 'KTM' : '', h.mark || '', h.trainingScore || '', signed(h.diff), h.lap || '',
          dbResultLabel(d), d?.zone || '—', d?.signalDetail || d?.basis || '—',
          h.tenPast1f || '—', h.tenPrev1f || '—', h.tenRank || '—', h.agariRank || '—'
        ].join('|');
      }),
      '',
      '■データ上の事実メモ',
      ...facts.map(x => `・${x}`),
      '',
      '■ラップ君への壁打ち依頼',
      'このデータだけを土台に、次の順番で検討してください。欠損値は推測で埋めないでください。',
      '1. テン1F過去・テン1F前走・テン順は、前半の速さ・位置取り・先行圧・想定ペースを作るために使う。適性評価への直接加点には使わない。',
      '2. 上がり順は、想定位置や展開時にどこから動くか、33適性を発揮できるかの確認に使う。「上がり上位だから適性上位」とは判定しない。',
      '3. 適性評価の主軸はDB33主評価・コア33・DB根拠。新聞33（S/A/B/C）は補助情報として扱う。',
      '4. 今回の想定33レンジとDB33のコア帯を照合し、コア一致／好走可能／隠れ適合／33依存・ズレ／逆◎／中間を優先して取捨する。',
      '5. KTM、調教印、調教採点、前走比は状態面として加え、33適性・能力評価と混同しない。',
      '6. 最後に人気・オッズとのバランスを見て、人気薄で条件が重なる馬を拾う。天気・馬場が未確定なら分岐で考える。',
      '',
      '■回答してほしい形',
      '・想定展開（前半〜直線）',
      '・軸候補',
      '・穴候補（最大3頭、根拠を項目別に）',
      '・危険な人気馬',
      '・買うならどう組むか／妙味が薄ければ見送り',
      '・追加で確認したい情報',
      '',
      '33ラップ適性を主役にしてください。テン・上がりは「今回どの33になりそうか」「その馬が適性を発揮できる位置・展開になるか」を読むための道具として扱ってください。'
    ];
    return lines.join('\n');
  }

  function installConsultModal() {
    if (document.querySelector('#v6Consult')) return;
    const modal = document.createElement('div');
    modal.id = 'v6Consult';
    modal.className = 'v6-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v6-panel">
        <div class="v6-panel-head"><div><p class="v4-eyebrow">LAP-KUN WALLBOARD</p><h2>ラップ君に相談</h2></div><button class="v4-close" id="v6ConsultClose">閉じる</button></div>
        <p class="v6-help">この文章には、33ラップ・KTM・調教・テン・上がり・人気をまとめています。内容を確認して、そのままチャットへ貼れます。</p>
        <textarea id="v6ConsultText" class="v6-consult-text" readonly></textarea>
        <div class="v6-consult-actions"><button class="v4-secondary" id="v6Share">共有</button><button class="v4-primary" id="v6Copy">コピー</button></div>
        <div id="v6CopyStatus" class="v6-copy-status" hidden></div>
      </div>`;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) closeConsult(); };
    modal.querySelector('#v6ConsultClose').onclick = closeConsult;
    modal.querySelector('#v6Copy').onclick = async () => {
      const text = modal.querySelector('#v6ConsultText').value;
      const status = modal.querySelector('#v6CopyStatus');
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = 'コピーしました。ChatGPTのチャットに貼り付けてください。';
        status.className = 'v6-copy-status ok';
      } catch {
        modal.querySelector('#v6ConsultText').select();
        status.textContent = '自動コピーできませんでした。文章を選択したので「コピー」を使ってください。';
        status.className = 'v6-copy-status ng';
      }
      status.hidden = false;
    };
    modal.querySelector('#v6Share').onclick = async () => {
      const text = modal.querySelector('#v6ConsultText').value;
      if (navigator.share) {
        try { await navigator.share({ title: 'MY KEIBA LAB 壁打ち', text }); return; } catch {}
      }
      try { await navigator.clipboard.writeText(text); alert('共有が使えないためコピーしました。'); } catch { alert('共有できませんでした。コピーを使ってください。'); }
    };
  }

  function openConsult(race) {
    installConsultModal();
    const modal = document.querySelector('#v6Consult');
    modal.querySelector('#v6ConsultText').value = buildConsultText(race);
    const status = modal.querySelector('#v6CopyStatus');
    status.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeConsult() {
    const modal = document.querySelector('#v6Consult');
    if (modal) modal.hidden = true;
    const detailOpen = document.querySelector('#v4Detail') && !document.querySelector('#v4Detail').hidden;
    if (!detailOpen) document.body.style.overflow = '';
  }

  function upgradeAskButton() {
    const old = document.querySelector('#v5AskLapkun');
    if (!old || old.dataset.v6 === '1') return;
    const race = raceFromDetail();
    if (!race) return;
    const fresh = old.cloneNode(true);
    fresh.dataset.v6 = '1';
    fresh.textContent = 'ラップ君に相談';
    fresh.onclick = () => openConsult(race);
    old.replaceWith(fresh);
  }

  function addMetricSummaryToExpandedRows() {
    const race = raceFromDetail();
    const body = document.querySelector('#v4DetailBody');
    if (!race || !body) return;
    body.querySelectorAll('.v4-horse-detail-row').forEach(row => {
      const horse = (race.horses || []).find(h => h.id === row.dataset.v4DetailRow);
      const wall = row.querySelector('.v4-detail-box:last-child');
      if (!horse || !wall || wall.dataset.v6 === '1') return;
      wall.dataset.v6 = '1';
      const tenRank = num(horse.tenRank);
      const agariRank = num(horse.agariRank);
      const tenCls = tenRank === 1 ? 'one' : tenRank === 2 ? 'two' : tenRank === 3 ? 'three' : 'other';
      const agCls = agariRank === 1 ? 'one' : agariRank === 2 ? 'two' : agariRank === 3 ? 'three' : 'other';
      const normalize = v => window.MyKeibaDataV16?.normalizeHorseName
        ? window.MyKeibaDataV16.normalizeHorseName(v)
        : String(v || '').replace(/[\s　・･]/g, '').trim();
      const db = dbResultFor(race);
      const dbHit = (db?.horses || []).find(d => normalize(d.name) === normalize(horse.name));
      const dbText = dbHit ? dbResultLabel(dbHit) : '—';
      wall.innerHTML = `<strong>ラップ君 壁打ち材料</strong>
        <div class="v6-four">
          <span><em>テン1F過去</em><b>${esc6(val(horse.tenPast1f))}</b></span>
          <span><em>テン1F前走</em><b>${esc6(val(horse.tenPrev1f))}</b></span>
          <span><em>テン順</em><b class="v6-rank-text ${tenCls}">${esc6(tenRank == null ? '—' : `${tenRank}位`)}</b></span>
          <span><em>上がり順</em><b class="v6-rank-text ${agCls}">${esc6(agariRank == null ? '—' : `${agariRank}位`)}</b></span>
        </div>
        <p>新聞33 ${esc6(horse.lap || '—')} / DB33 ${esc6(dbText)} / コア33 ${esc6(dbHit?.zone || '—')} / KTM ${(typeof isKtm === 'function' && isKtm(horse)) ? '該当' : '—'} / 人気 ${esc6(horse.popularity || '—')} / ${esc6(horse.odds || '—')}倍</p>`;
    });
  }

  function augment() {
    if (busy) return;
    busy = true;
    try {
      decorateTable();
      upgradeAskButton();
      addMetricSummaryToExpandedRows();
    } finally {
      busy = false;
    }
  }

  installConsultModal();
  augment();
  const observer = new MutationObserver(() => setTimeout(augment, 0));
  observer.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaLapkunV6 = { buildConsultText, openConsult };
})();
