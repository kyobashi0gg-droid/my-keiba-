// v3.3 hotfix: 調教印の右端判定 + 33ラップ自動評価
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

    // 33ラップ適性は「近い33ラップ帯で実際に5着以内に走った経験」を中心に評価。
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

  // 今後のPDF取込を修正
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

  // 同じPDFを再取込した際は、自動33評価を最新値で上書きする。
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

  // 保存済みデータの調教印だけは起動時にも修正。
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
