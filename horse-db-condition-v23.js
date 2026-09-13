// MY KEIBA LAB v23 - 馬DB 条件別33サマリー
// 芝/ダートを分離し、距離帯（〜1400 / 1500〜2000 / 2100〜）で優先集計。データ不足時は段階的にフォールバックする。
(() => {
  if (window.__MYKEIBA_HORSE_DB_CONDITION_V23__) return;
  window.__MYKEIBA_HORSE_DB_CONDITION_V23__ = true;

  const num = v => {
    if (v == null || v === '' || String(v).trim() === '—') return null;
    const m = String(v).replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  function surfaceOf(v) {
    const s = String(v || '');
    if (/ダ|ﾀﾞ|dirt/i.test(s)) return 'ダート';
    if (/芝|turf/i.test(s)) return '芝';
    return '';
  }

  function distanceOf(v) {
    const n = num(v);
    return n != null && n >= 800 && n <= 4000 ? n : null;
  }

  function bandOf(distance) {
    const d = distanceOf(distance);
    if (d == null) return '';
    if (d <= 1400) return '短距離';
    if (d <= 2000) return 'マイル〜中距離';
    return '中長距離';
  }

  function raceCondition(race) {
    const course = `${race?.v3Course || ''} ${race?.course || ''} ${race?.surface || ''}`;
    let surface = surfaceOf(course);
    let distance = distanceOf(course);
    if (distance == null) distance = distanceOf(race?.distance);
    return { surface, distance, band: bandOf(distance) };
  }

  function runCondition(run) {
    const surface = surfaceOf(run?.surface || run?.trackType || run?.course || '');
    const distance = distanceOf(run?.distance);
    return { surface, distance, band: bandOf(distance) };
  }

  function validLapCount(runs) {
    return (runs || []).filter(r => num(r?.lap33) != null).length;
  }

  function goodCount(runs) {
    return (runs || []).filter(r => {
      const f = num(r?.finish);
      return num(r?.lap33) != null && f != null && f > 0 && f <= 3;
    }).length;
  }

  function summarize(runs) {
    const api = window.MyKeibaHorseDBSummaryV20;
    return api?.summarizeRuns ? api.summarizeRuns(runs) : null;
  }

  function summaryForRace(runs, race) {
    const all = runs || [];
    const rc = raceCondition(race);
    const sameSurface = rc.surface ? all.filter(r => runCondition(r).surface === rc.surface) : [];
    const sameBand = rc.band ? sameSurface.filter(r => runCondition(r).band === rc.band) : [];

    // 条件別は最低3走、かつ好走2走以上を優先採用。
    let selected = all;
    let basis = '全体';
    if (validLapCount(sameBand) >= 3 && goodCount(sameBand) >= 2) {
      selected = sameBand; basis = `${rc.surface}・${rc.band}`;
    } else if (validLapCount(sameSurface) >= 3 && goodCount(sameSurface) >= 2) {
      selected = sameSurface; basis = rc.surface;
    } else if (validLapCount(sameBand) >= 2) {
      selected = sameBand; basis = `${rc.surface}・${rc.band}（参考）`;
    } else if (validLapCount(sameSurface) >= 2) {
      selected = sameSurface; basis = `${rc.surface}（参考）`;
    }

    const summary = summarize(selected) || summarize(all);
    return {
      summary,
      basis,
      condition: rc,
      selectedRuns: selected.length,
      totalRuns: all.length,
      surfaceRuns: sameSurface.length,
      bandRuns: sameBand.length,
      fallback: basis === '全体' || /参考/.test(basis),
    };
  }

  function basisLabel(x) {
    if (!x) return '条件別 —';
    const s = x.summary;
    const zone = s?.zoneMin == null ? '—' : s.zoneMin === s.zoneMax ? `${s.zoneMin}` : `${s.zoneMin}〜${s.zoneMax}`;
    return `${x.basis} / 好走33帯 ${zone} / 対象${s?.lapCount ?? 0}走 / 好走${s?.goodCount ?? 0}走`;
  }

  const style = document.createElement('style');
  style.textContent = `.v23-basis{display:block;margin-top:3px;font-size:10px;color:#4f725f;font-weight:800}`;
  document.head.appendChild(style);

  window.MyKeibaHorseDBConditionV23 = { surfaceOf, bandOf, raceCondition, runCondition, summaryForRace, basisLabel };
})();