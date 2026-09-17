// MY KEIBA LAB v43 - 位置取り「不明」馬をラップ君壁打ちで枠＋DB補完する軽量アドオン
(() => {
  if (window.__MYKEIBA_PACE_UNKNOWN_V43__) return;
  window.__MYKEIBA_PACE_UNKNOWN_V43__ = true;

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

  function frameOf(horseNo, fieldSize) {
    const n = Number(horseNo), total = Number(fieldSize);
    if (!Number.isInteger(n) || !Number.isInteger(total) || n < 1 || total < 1 || n > total || total > 18) return null;
    if (total <= 8) return n;
    let cursor = 1;
    if (total <= 16) {
      const singleFrames = 16 - total;
      for (let frame = 1; frame <= 8; frame++) {
        const count = frame <= singleFrames ? 1 : 2;
        if (n >= cursor && n < cursor + count) return frame;
        cursor += count;
      }
      return null;
    }
    const tripleFrames = total - 16;
    for (let frame = 1; frame <= 8; frame++) {
      const count = frame > 8 - tripleFrames ? 3 : 2;
      if (n >= cursor && n < cursor + count) return frame;
      cursor += count;
    }
    return null;
  }

  function unknownsFor(race) {
    const api = window.MyKeibaPaceSimV42;
    if (!race || !api?.paceProfile) return [];
    const p = api.paceProfile(race);
    return (p?.horses || []).filter(x => x.position === '不明');
  }

  function unknownSection(race) {
    const unknowns = unknownsFor(race);
    if (!unknowns.length) return '';
    const total = (race.horses || []).length;
    const rows = unknowns.map(x => {
      const no = x.h.number || '—';
      const frame = frameOf(no, total);
      return `・${no}番 ${x.h.name}（${frame ? `${frame}枠` : '枠不明'}）`;
    });
    return [
      '',
      '■位置取り不明馬の補完依頼（枠＋競走馬DB）',
      ...rows,
      'MY KEIBA LAB本体では競走馬DBを読み込まず、サイトの安定性を優先してください。',
      '上記の「不明」馬だけ、ラップ君との壁打ち時に参照可能な競走馬DBを確認して位置取りを補完してください。',
      '確認優先順：①過去の通過順 ②同距離・近い距離での序盤位置 ③枠順と周囲の先行馬 ④距離延長/短縮 ⑤レース総評（出遅れ・控えた・押して先行・掛かった等）。',
      '各不明馬について「先行／中団前／中団／差し／後方」のどこへ入りそうかを仮置きし、根拠を短く示してください。',
      'その仮置きによって先行圧や想定ペースが変わる場合は、展開シミュレーションを修正し、本線33レンジが速い側・遅い側のどちらへ動くかも再評価してください。',
      'DB根拠が弱い場合は無理に決めず「不明のまま」としてください。推測だけで隊列を埋めないでください。'
    ].join('\n');
  }

  function appendConsult() {
    const ta = document.querySelector('#v6ConsultText');
    const race = currentRace();
    if (!ta || !race) return;
    const marker = '■位置取り不明馬の補完依頼（枠＋競走馬DB）';
    if (ta.value.includes(marker)) return;
    const section = unknownSection(race);
    if (section) ta.value += section;
  }

  function decorateCard() {
    const race = currentRace();
    const card = document.querySelector('#v42PaceSim');
    if (!race || !card) return;
    card.querySelector('.v43-unknown-note')?.remove();
    const unknowns = unknownsFor(race);
    if (!unknowns.length) return;
    const note = document.createElement('div');
    note.className = 'v43-unknown-note';
    note.textContent = `位置取り不明 ${unknowns.length}頭 → ラップ君相談時に枠＋競走馬DBで補完`;
    card.appendChild(note);
  }

  let timer = null;
  function schedule(ms = 120) {
    clearTimeout(timer);
    timer = setTimeout(() => requestAnimationFrame(() => { try { decorateCard(); } catch {} }), ms);
  }

  const style = document.createElement('style');
  style.textContent = `.v43-unknown-note{margin-top:8px;padding:7px 9px;border-radius:10px;background:#f1f4f2;color:#5d6f65;font-size:9px;font-weight:850;line-height:1.45}`;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    if (e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand]')) schedule(150);
    const b = e.target?.closest?.('button');
    if (b && (b.id === 'v5AskLapkun' || b.id === 'v6AskLapkun' || /ラップ君に相談/.test(b.textContent || ''))) {
      setTimeout(appendConsult, 180);
    }
  }, true);
  window.addEventListener('pageshow', () => schedule(160), { passive:true });
  window.addEventListener('mykeiba:resume', () => schedule(160), { passive:true });
  window.addEventListener('mykeiba:modules-ready', () => schedule(160));
  schedule(500);

  window.MyKeibaPaceUnknownV43 = { frameOf, unknownsFor, unknownSection, appendConsult, decorateCard };
})();