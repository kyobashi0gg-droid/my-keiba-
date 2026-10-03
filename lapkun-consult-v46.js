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
    const track = clean(race?.track || '');
    const tokyo = /東京/.test(track);
    const lines = [
      '',
      '■1400mの33ラップ構造注意（固定ルール）',
      '・33ラップはラスト6Fの「前半3F－後半3F」。1400mでは前半3Fがレース全体の2F目〜4F目に当たる。',
      '・1F目が33計算から外れ、加速後の2F目が入る点は重要。ただし「1400mだから必ずマイナス寄り」と固定しない。',
      '・2F目〜4F目に直線・コーナーのどこが入るかで前半3Fの速さが大きく変わるため、コース形態を先に確認して本線33を補正する。',
      '・特に2F目からコーナーへ入る、または2F目の途中からコーナーになるコースでは、加速直後でも10秒台まで上がりにくく、プラス33も十分に起こり得る。',
      '・新聞平均33とテン競合だけで速い側/遅い側を決めず、各Fがコースのどこに当たるかまで確認すること。'
    ];
    if (tokyo) {
      lines.push(
        '・東京芝1400mは3コーナーまで約342m。2F目（200〜400m）の後半が3コーナー進入に掛かるため、2F目を「加速直後だから最速」と決め打ちしない。',
        '・東京芝1400mでは2F目〜4F目にコーナー影響が入り、10秒台の連発は想定しにくい。中盤が緩めば33は0付近〜プラス側まで動く余地がある。'
      );
    }
    return lines.join('\n');
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