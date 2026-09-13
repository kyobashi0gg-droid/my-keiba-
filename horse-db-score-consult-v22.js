// MY KEIBA LAB v22 - 馬DB33適合を穴スコア + ラップ君相談へ反映
// v23以降は芝/ダート・距離帯、v26以降は良/道悪を実戦判定に使用。v25以降は度外視判定も相談文へ載せる。
(() => {
  if (window.__MYKEIBA_DB_SCORE_CONSULT_V22__) return;
  window.__MYKEIBA_DB_SCORE_CONSULT_V22__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  const fitCache = new Map();
  let rebuilding = false;

  function key(race, horse) { return `${race?.id || ''}|${norm(horse?.name)}`; }
  function bonusOfGrade(grade) { return grade === '◎' ? 2 : grade === '○' ? 1 : 0; }

  async function rebuildFitCache() {
    if (rebuilding) return;
    const summaryApi = window.MyKeibaHorseDBSummaryV20;
    const fitApi = window.MyKeibaHorseDBFitV21;
    const conditionApi = window.MyKeibaHorseDBConditionV23;
    if (!summaryApi?.allSummaries || !fitApi?.fitJudge || !fitApi?.raceAvg33) return;
    rebuilding = true;
    try {
      const summaries = await summaryApi.allSummaries();
      fitCache.clear();
      const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
      for (const race of races) {
        const avg33 = fitApi.raceAvg33(race);
        for (const horse of race.horses || []) {
          const db = summaries.find(s => norm(s.horse?.name) === norm(horse.name));
          if (!db) continue;
          const conditioned = conditionApi?.summaryForRace ? conditionApi.summaryForRace(db.runs, race) : null;
          const summary = conditioned?.summary || db.summary;
          const judge = fitApi.fitJudge(avg33, summary);
          fitCache.set(key(race, horse), {
            grade: judge.grade,
            summary,
            avg33,
            text: fitApi.fitText(avg33, summary),
            basis: conditioned?.basis || '全体',
            condition: conditioned?.condition || null,
            excluded: conditioned?.excluded || [],
            excludedRuns: conditioned?.excludedRuns || 0,
          });
        }
      }
    } catch {} finally { rebuilding = false; }
  }

  if (typeof valueScore === 'function' && !window.__MYKEIBA_V22_SCORE_WRAPPED__) {
    window.__MYKEIBA_V22_SCORE_WRAPPED__ = true;
    const baseValueScore = valueScore;
    valueScore = function(horse, race) {
      const base = baseValueScore(horse, race);
      const hit = fitCache.get(key(race, horse));
      return base + bonusOfGrade(hit?.grade);
    };

    if (typeof scoreReasons === 'function') {
      const baseReasons = scoreReasons;
      scoreReasons = function(horse, race) {
        const reasons = baseReasons(horse, race);
        const hit = fitCache.get(key(race, horse));
        if (hit?.grade === '◎') reasons.push('DB33◎');
        else if (hit?.grade === '○') reasons.push('DB33○');
        return reasons;
      };
    }
  }

  function cleanupDuplicateDbSummary() {
    const body = document.querySelector('#v4DetailBody');
    if (!body) return;
    const notes = [...body.querySelectorAll('.v20-race-db-note')];
    if (notes.length <= 1) return;
    const keep = notes.find(n => n.querySelector('.v21-fit')) || notes[0];
    notes.forEach(n => { if (n !== keep) n.remove(); });
  }

  function currentRaceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    return races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function fmtZone(summary) {
    if (summary?.zoneMin == null || summary?.zoneMax == null) return '—';
    return summary.zoneMin === summary.zoneMax ? `${summary.zoneMin}` : `${summary.zoneMin}〜${summary.zoneMax}`;
  }

  function excuseLine(item) {
    const run = item?.run || {};
    const date = String(run.date || '—').replace(/-/g, '.');
    const raceName = run.raceName || 'レース名不明';
    const finish = run.finish ? `${run.finish}着` : '着順—';
    return `${date} ${raceName} / ${finish} / ${item?.reason || '理由不明'}`;
  }

  function appendConsultDbSection() {
    const modal = document.querySelector('#v6Consult');
    const text = modal?.querySelector('#v6ConsultText');
    if (!modal || modal.hidden || !text) return;
    if (text.value.includes('■馬DB 33適合')) return;
    const race = currentRaceFromDetail();
    if (!race) return;

    const going = window.MyKeibaHorseDBGoingV26?.raceGoing?.(race) || '';
    const rows = (race.horses || []).map(h => {
      const hit = fitCache.get(key(race, h));
      if (!hit) return null;
      return `${h.number || '—'}|${h.name}|${hit.basis}|好走33帯 ${fmtZone(hit.summary)}|${hit.text}|加点 +${bonusOfGrade(hit.grade)}`;
    }).filter(Boolean);
    if (!rows.length) return;

    text.value += `\n\n■馬DB 33適合\n今回馬場: ${going || '未設定（馬場別では絞らない）'}\n馬番|馬名|使用条件|好走33帯|今回適合|穴スコア加点\n${rows.join('\n')}\n・条件別DB33: 芝/ダート → 距離帯 → 良/道悪を優先。該当データ不足時は距離帯→同一馬場→全体へフォールバック。\n・DB33判定: 帯内◎=+2点 / ±0.3以内○=+1点 / △=加点なし`;

    const excuseBlocks = (race.horses || []).map(h => {
      const hit = fitCache.get(key(race, h));
      if (!hit?.excluded?.length) return null;
      const detail = hit.excluded.map(excuseLine).map(x => `  ・${x}`).join('\n');
      return `${h.number || '—'}番 ${h.name}：度外視${hit.excluded.length}走\n${detail}`;
    }).filter(Boolean);

    if (excuseBlocks.length) {
      text.value += `\n\n■馬DB 度外視判定\n${excuseBlocks.join('\n')}\n・上記はレース総評＋通過順＋着順から、明確な不利・展開不向きと判定した凡走。条件別33帯の集計から除外済み。\n・度外視理由は能力不足と同一視せず、今回条件で再現する不利かどうかも別途検討すること。`;
    }
  }

  function refreshIntegratedHomeIfSafe() {
    const active = document.querySelector('.v4-nav.active');
    const detail = document.querySelector('#v4Detail');
    if (active?.dataset.tab === 'home' && (!detail || detail.hidden)) active.click();
  }

  let scheduled = false;
  async function schedule() {
    if (document.hidden || scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await rebuildFitCache();
      cleanupDuplicateDbSummary();
      appendConsultDbSection();
    });
  }

  async function initial() {
    await rebuildFitCache();
    cleanupDuplicateDbSummary();
    refreshIntegratedHomeIfSafe();
  }

  const style = document.createElement('style');
  style.textContent = `.v22-score-note{font-size:10px;color:#2c7350;font-weight:800}`;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('button');
    if (btn && /ラップ君に相談/.test(btn.textContent || '')) setTimeout(schedule, 0);
  }, true);

  // 当日の馬場状態を変更したら、DB33判定を即座に再計算する。
  document.addEventListener('change', e => {
    if (e.target?.id === 'going' || /going|馬場/.test(e.target?.name || '')) setTimeout(schedule, 0);
  }, true);
  document.addEventListener('submit', e => {
    if (e.target?.id === 'raceForm') setTimeout(schedule, 0);
  }, true);

  window.addEventListener('mykeiba:horse-db-updated', async () => { await rebuildFitCache(); refreshIntegratedHomeIfSafe(); schedule(); });
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });

  initial();
  window.MyKeibaDbScoreConsultV22 = { rebuildFitCache, bonusOfGrade, schedule, fitCache };
})();