// v3.4 hotfix: 調教印の右端判定 + 33ラップ自動評価 + レース詳細表示
// 現在レースの平均33ラップと、各馬の過去走33ラップを比較し、S/A/B/Cを自動付与する。

(() => {
  function rightmostTrainingMark(markString) {
    const raw = [...String(markString || '')]
      .filter(ch => /[◎○▲☆△×・]/.test(ch));
    const rightmost = raw.at(-1) || '';
    return rightmost === '・' ? '' : rightmost;
  }

  function history33Samples(page, horseY) {
    const bands = [
      [215, 300],
      [300, 390],
      [390, 480],
      [480, 570],
    ];

    return bands.map(([xMin, xMax]) => {
      const lapItem = v3Nearest(
        v3ItemsIn(page, xMin, xMax, horseY + 11, horseY + 21,
          t => /^[+-]\d+(?:\.\d+)?$/.test(t)),
        horseY + 14
      );
      if (!lapItem) return null;

      const finishItem = v3Nearest(
        v3ItemsIn(page, xMin, xMax, horseY + 2, horseY + 12,
          t => /^(?:[1-9]|1[0-8])$/.test(t)),
        horseY + 6
      );

      return {
        value: Number(lapItem.text),
        finish: finishItem ? Number(finishItem.text) : null,
      };
    }).filter(Boolean);
  }

  function rate33(currentAvg, samples) {
    if (!Number.isFinite(currentAvg) || !samples.length) {
      return { grade: '', reason: '', best: null };
    }

    const goodRuns = samples.filter(s => Number.isFinite(s.finish) && s.finish <= 5);

    if (!goodRuns.length) {
      const nearest = [...samples].sort((a, b) =>
        Math.abs(a.value - currentAvg) - Math.abs(b.value - currentAvg)
      )[0];
      return {
        grade: 'C',
        reason: nearest
          ? `好走歴なし・近似${nearest.value >= 0 ? '+' : ''}${nearest.value}`
          : '好走歴なし',
        best: nearest || null,
      };
    }

    const best = [...goodRuns].sort((a, b) =>
      Math.abs(a.value - currentAvg) - Math.abs(b.value - currentAvg)
    )[0];
    const gap = Math.abs(best.value - currentAvg);

    let grade = 'C';
    if (best.finish <= 3 && gap <= 0.5) grade = 'S';
    else if (gap <= 1.0) grade = 'A';
    else if (gap <= 2.0) grade = 'B';

    return {
      grade,
      reason: `近似${best.value >= 0 ? '+' : ''}${best.value}・${best.finish}着・差${gap.toFixed(1)}`,
      best,
    };
  }

  function findHorseAnchor(page, horse) {
    const candidates = v3ItemsIn(
      page, 18, 31, 140, 790,
      t => t === String(horse.number || '')
    );

    return candidates.find(anchor => {
      const names = v3ItemsIn(
        page, 64, 116, anchor.y - 2.5, anchor.y + 2.5,
        t => t === horse.name
      );
      return names.length > 0;
    }) || null;
  }

  if (typeof v3ParsePremiumRacePage === 'function') {
    const originalParse = v3ParsePremiumRacePage;

    v3ParsePremiumRacePage = function(page) {
      const race = originalParse(page);
      if (!race) return race;

      const currentAvg = Number(race.v3Avg33);

      for (const horse of race.horses || []) {
        if (horse.v3MarkString != null) {
          horse.mark = rightmostTrainingMark(horse.v3MarkString);
        }

        const anchor = findHorseAnchor(page, horse);
        if (!anchor) continue;

        const samples = history33Samples(page, anchor.y);
        const evaluation = rate33(currentAvg, samples);

        horse.lap = evaluation.grade;
        horse.lapAuto = Boolean(evaluation.grade);
        horse.lapReason = evaluation.reason;
        horse.v3History33 = samples;

        if (evaluation.grade) {
          const tag = `33自動:${evaluation.grade}(${evaluation.reason})`;
          const oldNote = String(horse.note || '')
            .replace(/33自動:[SABC]\([^)]*\)\s*\/?\s*/g, '')
            .trim();
          horse.note = oldNote ? `${tag} / ${oldNote}` : tag;
        }
      }

      return race;
    };
  }

  if (typeof v3MergeHorse === 'function') {
    const originalMerge = v3MergeHorse;
    v3MergeHorse = function(existing, incoming) {
      const merged = originalMerge(existing, incoming);

      const existingIsManual = Boolean(existing?.lap) && !existing?.lapAuto;
      if (!existingIsManual) {
        merged.lap = incoming?.lap || '';
        merged.lapAuto = Boolean(incoming?.lapAuto);
        merged.lapReason = incoming?.lapReason || '';
        merged.v3History33 = incoming?.v3History33 || [];
      }

      return merged;
    };
  }

  let changed = false;
  if (typeof state !== 'undefined' && state?.races) {
    for (const race of state.races) {
      for (const horse of race.horses || []) {
        if (horse.v3MarkString == null) continue;
        const corrected = rightmostTrainingMark(horse.v3MarkString);
        if ((horse.mark || '') !== corrected) {
          horse.mark = corrected;
          changed = true;
        }
      }
    }
  }

  if (changed && typeof saveState === 'function') saveState();
})();

// v3.4: レースカードをタップした時は「編集フォーム」ではなく、まず読みやすい詳細画面を開く。
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .race-detail-dialog{padding:0;border:0;width:min(720px,100%);max-width:100%;height:auto;max-height:94dvh;margin:auto 0 0;border-radius:26px 26px 0 0;background:#101d18;color:#f4f7f5}
    .race-detail-dialog::backdrop{background:rgba(0,0,0,.68);backdrop-filter:blur(2px)}
    .race-detail-sheet{max-height:94dvh;overflow:auto;padding:10px 18px calc(24px + env(safe-area-inset-bottom))}
    .rd-handle{width:42px;height:4px;background:#53655d;border-radius:999px;margin:0 auto 16px}
    .rd-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}
    .rd-head h2{margin:2px 0 5px;font-size:25px}.rd-sub{color:#9fb2a8;font-size:12px}.rd-close{border:0;border-radius:14px;padding:10px 14px;background:#17251f;color:#f4f7f5;font-weight:800}
    .rd-race-info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.rd-stat{padding:11px;border-radius:14px;background:#0b1511;border:1px solid #263a31}.rd-stat small{display:block;color:#9fb2a8;font-size:9px;margin-bottom:4px}.rd-stat strong{font-size:14px}
    .rd-note{padding:11px 12px;border-radius:14px;background:#122219;border:1px solid #263a31;color:#c7d5ce;font-size:11px;line-height:1.55;margin-bottom:15px}
    .rd-title{display:flex;justify-content:space-between;align-items:end;margin:18px 0 10px}.rd-title h3{margin:0;font-size:18px}.rd-title small{color:#9fb2a8}
    .rd-list{display:grid;gap:9px}.rd-horse{padding:13px;border-radius:16px;background:#0d1814;border:1px solid rgba(255,255,255,.06)}
    .rd-horse-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.rd-name{font-size:16px;font-weight:900}.rd-number{color:#72e3a6;margin-right:7px}.rd-meta{margin-top:4px;color:#9fb2a8;font-size:10px;line-height:1.5}
    .rd-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.rd-badge{padding:4px 8px;border-radius:999px;font-weight:900;font-size:10px;border:1px solid #2c473a;background:#20352b;color:#d6e4dc}.rd-badge.ktm{background:rgba(114,227,166,.13);color:#72e3a6;border-color:rgba(114,227,166,.3)}.rd-badge.lap{background:rgba(215,255,99,.12);color:#d7ff63;border-color:rgba(215,255,99,.3)}
    .rd-lap{margin-top:10px;padding:9px 10px;border-radius:12px;background:#101d18;border:1px solid #263a31}.rd-lap-main{display:flex;gap:8px;align-items:center}.rd-lap-grade{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#20372d;color:#d7ff63;font-weight:900}.rd-lap-reason{font-size:11px;color:#c7d5ce}.rd-history{margin-top:7px;display:flex;gap:5px;flex-wrap:wrap}.rd-history span{font-size:9px;padding:4px 6px;border-radius:8px;background:#0b1511;color:#9fb2a8;border:1px solid rgba(255,255,255,.05)}
    .rd-actions{position:sticky;bottom:-1px;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px -18px -24px;padding:14px 18px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(16,29,24,.2),#101d18 26%)}.rd-action{border:0;border-radius:14px;padding:13px;font-weight:900}.rd-edit{background:#72e3a6;color:#062015}.rd-dismiss{background:#20342b;color:#f4f7f5;border:1px solid #304a3e}
    @media(min-width:700px){.race-detail-dialog{margin:auto;border-radius:26px}}
  `;
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'race-detail-dialog';
  dialog.innerHTML = '<div class="race-detail-sheet" id="raceDetailBody"></div>';
  document.body.appendChild(dialog);

  const signed = value => {
    const n = Number(value);
    return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n}` : '';
  };

  function horseDetailHtml(horse, race) {
    const score = typeof valueScore === 'function' ? valueScore(horse, race) : 0;
    const ktm = typeof isKtm === 'function' ? isKtm(horse) : false;
    const history = Array.isArray(horse.v3History33) ? horse.v3History33 : [];
    const historyHtml = history.length
      ? history.map((s, i) => `<span>過去${i + 1}: ${signed(s.value)}${Number.isFinite(s.finish) ? ` / ${s.finish}着` : ''}</span>`).join('')
      : '<span>過去33ラップ: 未取得</span>';

    const meta = [
      horse.popularity ? `${escapeHtml(horse.popularity)}人気` : '',
      horse.odds ? `${escapeHtml(horse.odds)}倍` : '',
      horse.mark ? `調教${escapeHtml(horse.mark)}` : '調教印—',
      horse.trainingScore !== '' && horse.trainingScore != null ? `採点${escapeHtml(horse.trainingScore)}` : '',
      horse.diff !== '' && horse.diff != null ? `前走比${Number(horse.diff) >= 0 ? '+' : ''}${escapeHtml(horse.diff)}` : '',
      horse.v3Character ? `馬キャラ${escapeHtml(horse.v3Character)}` : '',
    ].filter(Boolean).join(' / ');

    return `<article class="rd-horse">
      <div class="rd-horse-top">
        <div>
          <div class="rd-name"><span class="rd-number">${escapeHtml(horse.number || '')}</span>${escapeHtml(horse.name || '馬名未入力')}</div>
          <div class="rd-meta">${meta || 'データ未取得'}</div>
        </div>
        <div class="rd-badges">
          ${ktm ? '<span class="rd-badge ktm">KTM</span>' : ''}
          ${horse.lap ? `<span class="rd-badge lap">33 ${escapeHtml(horse.lap)}</span>` : ''}
          ${score >= 7 ? `<span class="rd-badge">穴${typeof scoreGrade === 'function' ? scoreGrade(score) : ''} ${score}pt</span>` : ''}
        </div>
      </div>
      <div class="rd-lap">
        <div class="rd-lap-main">
          <span class="rd-lap-grade">${escapeHtml(horse.lap || '—')}</span>
          <span class="rd-lap-reason">${escapeHtml(horse.lapReason || '33ラップ評価データなし')}</span>
        </div>
        <div class="rd-history">${historyHtml}</div>
      </div>
    </article>`;
  }

  function openRaceDetail(id) {
    const race = state?.races?.find(r => r.id === id);
    if (!race) return;

    const horses = [...(race.horses || [])].sort((a, b) => {
      const an = Number(a.number || 999);
      const bn = Number(b.number || 999);
      return an - bn;
    });

    const avg33 = race.v3Avg33 !== '' && race.v3Avg33 != null ? signed(race.v3Avg33) : '—';
    const course = race.v3Course || '—';
    const level = race.v3RaceLevel || '—';

    dialog.querySelector('#raceDetailBody').innerHTML = `
      <div class="rd-handle"></div>
      <div class="rd-head">
        <div>
          <p class="eyebrow">RACE DETAIL</p>
          <h2>${escapeHtml(race.track)} ${escapeHtml(race.raceNo)}R ${escapeHtml(race.raceName)}</h2>
          <div class="rd-sub">${escapeHtml(race.weather || '未設定')}・${escapeHtml(race.going || '未設定')}馬場</div>
        </div>
        <button type="button" class="rd-close">閉じる</button>
      </div>
      <div class="rd-race-info">
        <div class="rd-stat"><small>コース</small><strong>${escapeHtml(course)}</strong></div>
        <div class="rd-stat"><small>平均33ラップ</small><strong>${escapeHtml(avg33)}</strong></div>
        <div class="rd-stat"><small>レースレベル</small><strong>${escapeHtml(level)}</strong></div>
      </div>
      ${race.paceMemo ? `<div class="rd-note">${escapeHtml(race.paceMemo)}</div>` : ''}
      <div class="rd-title"><h3>出走馬・33ラップ評価</h3><small>${horses.length}頭</small></div>
      <div class="rd-list">${horses.map(h => horseDetailHtml(h, race)).join('')}</div>
      <div class="rd-actions">
        <button type="button" class="rd-action rd-dismiss">閉じる</button>
        <button type="button" class="rd-action rd-edit">編集する</button>
      </div>`;

    dialog.querySelector('.rd-close').onclick = () => dialog.close();
    dialog.querySelector('.rd-dismiss').onclick = () => dialog.close();
    dialog.querySelector('.rd-edit').onclick = () => {
      dialog.close();
      if (typeof openRaceEditor === 'function') openRaceEditor(id);
    };

    dialog.showModal();
  }

  document.addEventListener('click', event => {
    const raceCard = event.target.closest?.('.race-card');
    const rankRow = event.target.closest?.('.rank-row');
    const target = raceCard || rankRow;
    if (!target) return;

    const id = target.dataset.id || target.dataset.raceId;
    if (!id) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openRaceDetail(id);
  }, true);
})();