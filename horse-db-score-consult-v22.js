// MY KEIBA LAB v22 - 馬DB33適合を穴スコア + ラップ君相談へ反映
(() => {
  if (window.__MYKEIBA_DB_SCORE_CONSULT_V22__) return;
  window.__MYKEIBA_DB_SCORE_CONSULT_V22__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  const fitCache = new Map(); // raceId|horseName -> { grade, summary, avg33, text }
  let rebuilding = false;

  function key(race, horse) { return `${race?.id || ''}|${norm(horse?.name)}`; }
  function bonusOfGrade(grade) { return grade === '◎' ? 2 : grade === '○' ? 1 : 0; }

  async function rebuildFitCache() {
    if (rebuilding) return;
    const summaryApi = window.MyKeibaHorseDBSummaryV20;
    const fitApi = window.MyKeibaHorseDBFitV21;
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
          const judge = fitApi.fitJudge(avg33, db.summary);
          fitCache.set(key(race, horse), {
            grade: judge.grade,
            summary: db.summary,
            avg33,
            text: fitApi.fitText(avg33, db.summary),
          });
        }
      }
    } catch {} finally { rebuilding = false; }
  }

  // 既存穴スコアへDB33適合を軽く加点。KTM等の既存ロジックはそのまま。
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

  function appendConsultDbSection() {
    const modal = document.querySelector('#v6Consult');
    const text = modal?.querySelector('#v6ConsultText');
    if (!modal || modal.hidden || !text) return;
    if (text.value.includes('■馬DB 33適合')) return;
    const race = currentRaceFromDetail();
    if (!race) return;

    const rows = (race.horses || []).map(h => {
      const hit = fitCache.get(key(race, h));
      if (!hit) return null;
      return `${h.number || '—'}|${h.name}|好走33帯 ${fmtZone(hit.summary)}|${hit.text}|加点 +${bonusOfGrade(hit.grade)}`;
    }).filter(Boolean);
    if (!rows.length) return;

    text.value += `\n\n■馬DB 33適合\n馬番|馬名|好走33帯|今回適合|穴スコア加点\n${rows.join('\n')}\n・DB33判定: 帯内◎=+2点 / ±0.3以内○=+1点 / △=加点なし`;
  }

  function refreshIntegratedHomeIfSafe() {
    const active = document.querySelector('.v4-nav.active');
    const detail = document.querySelector('#v4Detail');
    if (active?.dataset.tab === 'home' && (!detail || detail.hidden)) {
      // 既存renderV4は閉包内なので、ホームタブの既存クリック処理を利用。
      active.click();
    }
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
  style.textContent = `
    .v22-score-note{font-size:10px;color:#2c7350;font-weight:800}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    const btn = e.target?.closest?.('button');
    if (btn && /ラップ君に相談/.test(btn.textContent || '')) setTimeout(schedule, 0);
  }, true);
  window.addEventListener('mykeiba:horse-db-updated', async () => { await rebuildFitCache(); refreshIntegratedHomeIfSafe(); schedule(); });
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });

  initial();
  window.MyKeibaDbScoreConsultV22 = { rebuildFitCache, bonusOfGrade, schedule };
})();
