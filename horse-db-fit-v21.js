// MY KEIBA LAB v21 - 馬DB 33適合判定
// 新聞の平均33とDB好走33帯を比較し、◎/○/△で表示する。
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
    const x = num(avg33);
    const lo = num(summary?.zoneMin);
    const hi = num(summary?.zoneMax);
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

  async function getRaceContext() {
    const body = document.querySelector('#v4DetailBody');
    const first = body?.querySelector('[data-v4-expand]');
    if (!body || !first) return null;
    const horseId = first.dataset.v4Expand;
    const races = window.state?.races || (typeof state !== 'undefined' ? state.races : []) || [];
    const race = races.find(r => (r.horses || []).some(h => h.id === horseId));
    return race ? { body, race } : null;
  }

  async function decorateRaceDetail() {
    const ctx = await getRaceContext();
    if (!ctx) return;
    const { body, race } = ctx;
    const avg33 = raceAvg33(race);
    const api = window.MyKeibaHorseDBSummaryV20;
    if (!api?.allSummaries) return;
    let summaries = [];
    try { summaries = await api.allSummaries(); } catch { return; }
    const matched = (race.horses || []).map(h => {
      const s = summaries.find(x => norm(x.horse?.name) === norm(h.name));
      return s ? { horse:h, db:s } : null;
    }).filter(Boolean);
    if (!matched.length) return;

    // v20サマリー行に適合判定を追記
    const note = body.querySelector('.v20-race-db-note');
    if (note) {
      const rows = [...note.querySelectorAll('.v20-race-db-row')];
      rows.forEach(row => {
        const b = row.querySelector('b');
        const span = row.querySelector('span');
        if (!b || !span || span.dataset.v21 === '1') return;
        const name = b.textContent.replace(/^\s*\d+\s*/, '').trim();
        const hit = matched.find(x => norm(x.horse.name) === norm(name));
        if (!hit) return;
        const j = fitJudge(avg33, hit.db.summary);
        span.insertAdjacentHTML('beforeend', ` <em class="v21-fit v21-${j.grade === '◎' ? 'good' : j.grade === '○' ? 'near' : j.grade === '△' ? 'off' : 'none'}">${fitText(avg33, hit.db.summary)}</em>`);
        span.dataset.v21 = '1';
      });
      const p = note.querySelector('p');
      if (p) p.textContent = '判定基準: 好走33帯内=◎ / 帯から±0.3以内=○ / それ以上=△。';
    }

    // 馬ごとの詳細欄にも表示
    for (const x of matched) {
      const row = body.querySelector(`[data-v4-detail-row="${CSS.escape(x.horse.id)}"]`);
      if (!row || row.querySelector('.v21-horse-fit')) continue;
      const host = row.querySelector('.v4-horse-detail') || row.firstElementChild;
      if (!host) continue;
      const j = fitJudge(avg33, x.db.summary);
      const box = document.createElement('div');
      box.className = 'v4-detail-box v21-horse-fit';
      box.innerHTML = `<strong>DB 33適合</strong><p><b>${fitText(avg33, x.db.summary)}</b><br>好走33帯 ${x.db.summary.zoneMin}〜${x.db.summary.zoneMax} / 好走${x.db.summary.goodCount}走</p>`;
      host.appendChild(box);
    }
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
  style.textContent = `
    .v21-fit{display:inline-block;margin-left:5px;padding:2px 6px;border-radius:999px;font-style:normal;font-weight:900;font-size:10px;white-space:nowrap}
    .v21-good{background:#dff4e7;color:#17613a}.v21-near{background:#fff4d7;color:#8b6213}.v21-off{background:#f6e7e7;color:#914040}.v21-none{background:#eef1ef;color:#6f7a74}
    .v21-horse-fit b{color:#22613d}.v21-rule-note{color:#66786e!important}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule() {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      await decorateRaceDetail();
      await decorateHorseModal();
    });
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList:true, subtree:true });
  window.addEventListener('mykeiba:horse-db-updated', schedule);
  window.addEventListener('mykeiba:resume', schedule, { passive:true });
  window.addEventListener('pageshow', schedule, { passive:true });
  schedule();

  window.MyKeibaHorseDBFitV21 = { raceAvg33, fitJudge, fitText, schedule };
})();