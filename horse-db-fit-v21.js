// MY KEIBA LAB v21 - 馬DB 33適合判定
// v36: レース全頭を開いた瞬間に集計せず、馬を開いた時だけその1頭を遅延計算する。
(() => {
  if (window.__MYKEIBA_HORSE_DB_FIT_V21__) return;
  window.__MYKEIBA_HORSE_DB_FIT_V21__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName
    ? window.MyKeibaDataV16.normalizeHorseName(v)
    : String(v || '').replace(/[\s　・･]/g, '').trim();

  function num(v) {
    if (v == null || v === '' || String(v).trim() === '—') return null;
    const m = String(v).replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const x = Number(m[0]);
    return Number.isFinite(x) ? x : null;
  }

  function raceAvg33(race) {
    const direct = num(race?.v3Avg33);
    if (direct != null) return direct;
    const memo = String(race?.paceMemo || '');
    const m = memo.match(/平均33ラップ\s*([+-]?\d+(?:\.\d+)?)/);
    return m ? num(m[1]) : null;
  }

  function fitJudge(avg33, summary) {
    const x = num(avg33), lo = num(summary?.zoneMin), hi = num(summary?.zoneMax);
    if (x == null || lo == null || hi == null) return { grade:'—', label:'判定不可', distance:null };
    if (x >= lo && x <= hi) return { grade:'◎', label:'ゾーン内', distance:0 };
    const d = x < lo ? lo - x : x - hi;
    if (d <= 0.3 + 1e-9) return { grade:'○', label:'近い', distance:Math.round(d*10)/10 };
    return { grade:'△', label:'ズレ', distance:Math.round(d*10)/10 };
  }

  function fitText(avg33, summary) {
    const j = fitJudge(avg33, summary);
    const avg = num(avg33);
    if (j.grade === '—') return '今回33 — / 判定不可';
    const gap = j.distance ? ` / 差${j.distance}` : '';
    return `今回33 ${avg >= 0 ? '+' : ''}${avg} → ${j.grade} ${j.label}${gap}`;
  }

  function races() {
    try { if (typeof state !== 'undefined') return state.races || []; } catch {}
    return window.state?.races || [];
  }

  function raceForHorseId(horseId) {
    return races().find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  let horseListCache = null;
  async function dbHorses() {
    if (horseListCache) return horseListCache;
    const api = window.MyKeibaHorseDBV18;
    if (!api?.listHorses) return [];
    horseListCache = await api.listHorses();
    return horseListCache;
  }
  function clearCache() { horseListCache = null; }

  async function decorateOneHorse(horseId) {
    if (!horseId || document.hidden) return;
    const body = document.querySelector('#v4DetailBody');
    const race = raceForHorseId(horseId);
    const horse = race?.horses?.find(h => h.id === horseId);
    if (!body || !race || !horse) return;
    const row = body.querySelector(`[data-v4-detail-row="${CSS.escape(horseId)}"]`);
    if (!row || row.querySelector('.v21-horse-fit')) return;
    const host = row.querySelector('.v4-horse-detail') || row.firstElementChild;
    if (!host) return;

    const api = window.MyKeibaHorseDBV18;
    const summaryApi = window.MyKeibaHorseDBSummaryV20;
    if (!api?.getRuns || !summaryApi?.summarizeRuns) return;

    try {
      const list = await dbHorses();
      const dbHorse = list.find(h => norm(h.name) === norm(horse.name));
      if (!dbHorse) return;
      const runs = await api.getRuns(dbHorse.key);
      const base = summaryApi.summarizeRuns(runs);
      const conditioned = window.MyKeibaHorseDBConditionV23?.summaryForRace
        ? window.MyKeibaHorseDBConditionV23.summaryForRace(runs, race)
        : null;
      const summary = conditioned?.summary || base;
      const avg33 = raceAvg33(race);
      const basis = conditioned?.basis || '全体';
      const box = document.createElement('div');
      box.className = 'v4-detail-box v21-horse-fit';
      box.innerHTML = `<strong>DB 33適合</strong><p><b>${fitText(avg33, summary)}</b><br>${basis} / 好走33帯 ${summary.zoneMin ?? '—'}〜${summary.zoneMax ?? '—'} / 好走${summary.goodCount ?? 0}走</p>`;
      host.appendChild(box);
    } catch {}
  }

  async function decorateHorseModal() {
    const modal = document.querySelector('#v18DbModal');
    if (!modal || modal.hidden) return;
    const box = modal.querySelector('.v20-summary-box');
    if (!box || box.querySelector('.v21-rule-note')) return;
    const small = document.createElement('small');
    small.className = 'v21-rule-note';
    small.textContent = 'レース画面では今回平均33と比較し、帯内◎ / ±0.3以内○ / それ以上△で判定';
    box.appendChild(small);
  }

  const style = document.createElement('style');
  style.textContent = `.v21-horse-fit b{color:#22613d}.v21-rule-note{color:#66786e!important}`;
  document.head.appendChild(style);

  let modalQueued = false;
  function schedule() {
    if (modalQueued || document.hidden) return;
    modalQueued = true;
    requestAnimationFrame(async () => {
      modalQueued = false;
      await decorateHorseModal();
    });
  }

  // v36: 馬名行を開いた時だけ、その1頭分を読む。
  document.addEventListener('click', e => {
    const expand = e.target?.closest?.('[data-v4-expand]');
    if (expand) {
      const id = expand.dataset.v4Expand;
      setTimeout(() => decorateOneHorse(id), 35);
    }
    if (e.target?.closest?.('[data-v18-horse-key]')) setTimeout(schedule, 30);
  }, true);

  window.addEventListener('mykeiba:horse-db-updated', () => { clearCache(); schedule(); });
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });

  window.MyKeibaHorseDBFitV21 = { raceAvg33, fitJudge, fitText, schedule, decorateOneHorse, clearCache };
})();