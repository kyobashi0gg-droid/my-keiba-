// MY KEIBA LAB v25 - レース総評による度外視走フィルタ
// 馬DBのレース総評・通過順・着順を組み合わせ、明確な不利/展開不向きの凡走だけを33帯集計から除外する。
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
    if (/^(消|取消|除外|中止|失格|競走中止)$/i.test(s)) return null;
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

    // 前が止まる流れで前方にいた凡走 → 展開不向き候補
    if ((review.includes('前潰れ') || review.includes('ハイ')) && pos <= frontCut) {
      return review.includes('前潰れ') ? '前潰れ×前方' : 'ハイ×前方';
    }
    // 前残りで後方にいた凡走 → 展開不向き候補
    if (review.includes('前残り') && pos >= backCut) return '前残り×後方';
    return '';
  }

  function excuseReason(run) {
    const finishRaw = String(run?.finish ?? '').trim();
    if (/^(消|取消|除外|中止|失格|競走中止)$/i.test(finishRaw)) return `非完走:${finishRaw}`;

    const f = finishNo(run?.finish);
    // 好走自体は度外視扱いにしない。好走33帯を不必要に削らないため。
    if (f != null && f <= 3) return '';

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