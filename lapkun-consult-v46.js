// MY KEIBA LAB v46 - consultation export sync + 1400m 33-lap structural caution
(() => {
  if (window.__MYKEIBA_LAP_CONSULT_V46__) return;
  window.__MYKEIBA_LAP_CONSULT_V46__ = true;

  function races() {
    try { return (typeof state !== 'undefined' ? state.races : window.state?.races) || []; }
    catch { return window.state?.races || []; }
  }

  function currentRace() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const id = first.dataset.v4Expand;
    return races().find(r => (r.horses || []).some(h => h.id === id)) || null;
  }

  function clean(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }

  function isRankHeader(text) {
    const t = clean(text).replace(/\s+/g, '');
    if (!t || t === '単勝/人気') return false;
    return t === '勝' || t === '穴' || t === '穴スコア'
      || /^(?:勝|穴)(?:順位|候補ランキング)$/.test(t)
      || /^(?:勝負|穴候補)(?:順位|ランキング)$/.test(t);
  }

  function siteRankingSection() {
    const table = document.querySelector('#v4DetailBody .v4-table');
    if (!table) return '';
    const heads = [...table.querySelectorAll('thead th')];
    const rankCols = heads
      .map((th, i) => ({ i, label: clean(th.textContent) }))
      .filter(x => isRankHeader(x.label));
    if (!rankCols.length) return '';

    const rows = [...table.querySelectorAll('tbody > tr')]
      .filter(tr => !tr.classList.contains('v4-horse-detail-row'));

    const out = [];
    for (const tr of rows) {
      const btn = tr.querySelector('[data-v4-expand]');
      const race = currentRace();
      const horse = race ? (race.horses || []).find(h => h.id === btn?.dataset.v4Expand) : null;
      const cells = [...tr.children];
      if (!horse || !cells.length) continue;
      const values = rankCols.map(c => {
        const raw = clean(cells[c.i]?.textContent || '');
        return raw || '—';
      });
      if (values.every(v => v === '—')) continue;
      out.push([horse.number || '—', horse.name || '—', ...values].join('|'));
    }
    if (!out.length) return '';

    return [
      '',
      '■サイト表示ランキング（相談時点）',
      ['馬番','馬名',...rankCols.map(c => c.label)].join('|'),
      ...out,
      '※ここはMY KEIBA LAB画面に表示されている順位・スコアをそのまま転記。DB33主評価そのものとは別軸として扱う。'
    ].join('\n');
  }

  function is1400(race) {
    const candidates = [
      race?.v3Course, race?.course, race?.distance, race?.v3Distance, race?.ky
    ].filter(v => v != null).join(' ');
    return /(?:^|\D)1400(?:\D|$)/.test(candidates);
  }

  function caution1400Section(race) {
    if (!is1400(race)) return '';
    return [
      '',
      '■1400mの33ラップ構造注意（固定ルール）',
      '・33ラップはラスト6Fの「前半3F－後半3F」。1400mではラスト6Fの前半3Fが、レース全体の2F目〜4F目に当たる。',
      '・スタート直後の1F目は33ラップ前半3Fに入らず、加速直後で速くなりやすい2F目が入るため、構造的に33はマイナス側へ寄りやすい。',
      '・したがって1400mは、隊列が早く決まっただけで安易に33をプラス側へ振らない。プラス域は相当に緩んだ場合の分岐として扱う。',
      '・ただし、スタート後2F目付近でコーナーへ入るコースなどは2F目が緩みやすいため、コース形状を確認して補正する。',
      '・新聞平均33は参照するが、1400m特有の構造を踏まえて本線/逆パターンのレンジを再評価すること。'
    ].join('\n');
  }

  function appendSections() {
    const area = document.querySelector('#v6ConsultText');
    const modal = document.querySelector('#v6Consult');
    const race = currentRace();
    if (!area || !modal || modal.hidden || !race) return;

    if (!area.value.includes('■サイト表示ランキング（相談時点）')) {
      const s = siteRankingSection();
      if (s) area.value += s;
    }
    if (!area.value.includes('■1400mの33ラップ構造注意（固定ルール）')) {
      const s = caution1400Section(race);
      if (s) area.value += s;
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('button');
    if (!btn || !/ラップ君に相談/.test(btn.textContent || '')) return;
    // v8/v22/v42 等の既存追記が終わってから同期する。
    setTimeout(appendSections, 320);
  }, true);

  window.addEventListener('mykeiba:resume', () => setTimeout(appendSections, 120), { passive: true });
  window.addEventListener('pageshow', () => setTimeout(appendSections, 120), { passive: true });

  window.MyKeibaLapConsultV46 = { appendSections, siteRankingSection, caution1400Section };
})();