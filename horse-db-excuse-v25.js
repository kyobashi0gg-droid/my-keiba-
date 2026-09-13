// MY KEIBA LAB v25.1 - レース総評による度外視走フィルタ
// 誤除外を避けるため、レース総評に根拠がある明確な不利/展開不向きだけを33帯集計から除外する。
(() => {
  if (window.__MYKEIBA_HORSE_DB_EXCUSE_V25__) return;
  window.__MYKEIBA_HORSE_DB_EXCUSE_V25__ = true;

  function num(v) {
    if (v == null || v === '' || String(v).trim() === '—') return null;
    const m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  function finishNo(v) {
    const s = String(v ?? '').trim();
    const n = num(s);
    return n != null && n > 0 ? n : null;
  }

  function firstPosition(v) {
    const s = String(v || '').replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '').trim();
    const m = s.match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function fieldSize(run) {
    return num(run?.fieldSize);
  }

  function explicitTrouble(review) {
    const s = String(review || '');
    const words = [
      '不利','出遅','立遅','躓','つまず','挟ま','接触','前詰','詰ま','進路','壁','包ま',
      '落鉄','故障','競走中止','度外視','大外回','外々','内詰','寄られ','被され'
    ];
    const hit = words.find(w => s.includes(w));
    return hit ? `総評:${hit}` : '';
  }

  function paceMismatch(run) {
    const review = String(run?.review || '');
    const f = finishNo(run?.finish);
    if (f == null || f <= 3) return '';
    const pos = firstPosition(run?.positions);
    const fs = fieldSize(run);
    if (pos == null) return '';

    const frontCut = fs != null ? Math.max(3, Math.ceil(fs * 0.25)) : 3;
    const backCut = fs != null ? Math.max(6, Math.ceil(fs * 0.60)) : 7;

    // 「前潰れ」と明記され、実際に前方にいた凡走だけ。
    if (review.includes('前潰れ') && pos <= frontCut) return '前潰れ×前方';

    // 「前残り」と明記され、実際に後方にいた凡走だけ。
    if (review.includes('前残り') && pos >= backCut) return '前残り×後方';

    // 「ハイ」だけでは度外視にしない。ペース表記は評価語でもあり誤除外が多いため。
    return '';
  }

  function excuseReason(run) {
    const f = finishNo(run?.finish);
    // 好走は度外視扱いにしない。
    if (f != null && f <= 3) return '';

    // 着順欄の「消・中止」等だけでは除外しない。
    // DB取込時の列ズレや表記揺れで誤認する可能性があるため、必ずレース総評を根拠にする。
    const explicit = explicitTrouble(run?.review);
    if (explicit) return explicit;
    return paceMismatch(run);
  }

  function classifyRuns(runs = []) {
    const usable = [];
    const excluded = [];
    for (const run of runs) {
      const reason = excuseReason(run);
      if (reason) excluded.push({ run, reason });
      else usable.push(run);
    }
    return { usable, excluded };
  }

  function filterUsableRuns(runs = []) { return classifyRuns(runs).usable; }

  window.MyKeibaHorseDBExcuseV25 = {
    finishNo, firstPosition, excuseReason, classifyRuns, filterUsableRuns
  };
})();