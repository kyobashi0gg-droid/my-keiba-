// MY KEIBA LAB v3 - 鈴木ショータPDF新聞プレミアム版 専用取込
// app.js の既存機能を残したまま、PDF選択時だけ専用パーサーを優先します。

function v3BuildRows(items, tolerance = 2.5) {
  const rows = [];
  for (const item of items) {
    let row = rows.find(r => Math.abs(r.y - item.y) < tolerance);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  rows.sort((a, b) => a.y - b.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

async function v3ExtractPdfPages(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const height = page.view?.[3] || 842;

    const items = content.items
      .filter(item => item.str?.trim())
      .map(item => ({
        text: normalizeText(item.str.trim()),
        x: item.transform?.[4] ?? 0,
        y: height - (item.transform?.[5] ?? 0),
      }));

    const rows = v3BuildRows(items);
    const text = rows
      .map(row => row.items.map(item => item.text).join(' '))
      .join('\n');

    pages.push({ pageNo, items, rows, text });
  }

  return pages;
}

function v3ItemsIn(page, xMin, xMax, yMin, yMax, predicate = () => true) {
  return page.items.filter(item =>
    item.x >= xMin && item.x <= xMax &&
    item.y >= yMin && item.y <= yMax &&
    predicate(item.text)
  );
}

function v3Nearest(items, targetY) {
  return [...items].sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY))[0];
}

function v3ParsePremiumRacePage(page) {
  const venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'];

  const trackItem = v3ItemsIn(page, 15, 70, 70, 108, t => venues.includes(t))[0];
  const raceNoItem = v3ItemsIn(page, 62, 105, 70, 108, t => /^\d{1,2}$/.test(t))[0];
  if (!trackItem || !raceNoItem) return null;

  const anchors = v3ItemsIn(page, 18, 31, 140, 790, t => /^(?:[1-9]|1[0-8])$/.test(t))
    .map(anchor => {
      const nameItem = v3Nearest(
        v3ItemsIn(page, 64, 116, anchor.y - 2.3, anchor.y + 2.3, t => /[ァ-ヶーA-Za-z]/.test(t)),
        anchor.y
      );
      return nameItem ? { anchor, nameItem } : null;
    })
    .filter(Boolean);

  if (anchors.length < 2) return null;

  const raceNameItem = v3Nearest(
    v3ItemsIn(page, 60, 175, 48, 78, t => !/^\d{1,2}\/\d{1,2}/.test(t) && !venues.includes(t)),
    58
  );

  const fullText = page.text;
  const dateMatch = fullText.match(/\d{1,2}\/\d{1,2}\([^)]+\)/);
  const avg33Match = fullText.match(/([+-]?\d+(?:\.\d+)?)\s*\(平均33ラップ\)/);
  const courseMatch = fullText.match(/\b(芝|ダ)\s*(\d{3,4})\b/);
  const levelMatch = fullText.match(/(超低レベル|や低レベル|低レベル|水準レベル|やハレベル|ハイレベル)/);

  const horses = anchors.map(({ anchor, nameItem }) => {
    const y = anchor.y;

    const oddsItem = v3Nearest(
      v3ItemsIn(page, 30, 61, y - 7.5, y + 1.8, t => /^\d+(?:\.\d+)?$/.test(t)),
      y - 4
    );

    const markItem = v3Nearest(
      v3ItemsIn(page, 30, 61, y + 2, y + 11.5, t => /^[◎○▲☆△×・]{2,4}$/.test(t)),
      y + 5
    );

    const scoreItem = v3Nearest(
      v3ItemsIn(page, 30, 61, y + 10, y + 21.5, t =>
        /^(?:\d{2,3}(?:\.\d+)?)?\([+-]?\d{1,3}\)$/.test(t)
      ),
      y + 14
    );

    const flags = v3ItemsIn(page, 18, 70, y + 19, y + 32)
      .map(item => item.text)
      .join(' ');

    const marks = markItem?.text
      ? [...markItem.text].filter(ch => /[◎○▲☆△×]/.test(ch))
      : [];
    const trainingMark = marks.at(-1) || '';

    let trainingScore = '';
    let diff = '';
    if (scoreItem?.text) {
      const both = scoreItem.text.match(/^(\d{2,3}(?:\.\d+)?)\(([+-]?\d{1,3})\)$/);
      const onlyDiff = scoreItem.text.match(/^\(([+-]?\d{1,3})\)$/);
      if (both) {
        trainingScore = both[1];
        diff = both[2];
      } else if (onlyDiff) {
        diff = onlyDiff[1];
      }
    }

    const characterMatch = flags.match(/(?:^|\s)(瞬|持|両|次|掲|弱)(?:\s|$)/);
    const blinker = /(?:^|\s)B(?:\s|$)/.test(flags);

    const notes = [];
    if (characterMatch?.[1]) notes.push(`馬キャラ:${characterMatch[1]}`);
    if (blinker) notes.push('B着用（初Bかは未確認）');

    return {
      id: uid(),
      number: anchor.text,
      name: nameItem.text,
      popularity: '',
      odds: oddsItem?.text || '',
      mark: trainingMark,
      trainingScore,
      diff,
      lap: '',
      style: '',
      firstBlinker: false,
      trouble: false,
      note: notes.join(' / '),
      v3MarkString: markItem?.text || '',
      v3Character: characterMatch?.[1] || '',
      v3Blinker: blinker,
    };
  });

  const ranked = horses
    .filter(horse => num(horse.odds) !== null)
    .sort((a, b) => num(a.odds) - num(b.odds));

  ranked.forEach((horse, index) => {
    horse.popularity = String(index + 1);
  });

  const course = courseMatch ? `${courseMatch[1]}${courseMatch[2]}` : '';
  const avg33 = avg33Match?.[1] || '';
  const level = levelMatch?.[1] || '';

  return {
    id: uid(),
    track: trackItem.text,
    raceNo: raceNoItem.text,
    raceName: raceNameItem?.text || '新聞取込レース',
    weather: '未設定',
    going: '未設定',
    paceMemo: [
      course,
      avg33 ? `平均33ラップ ${Number(avg33) >= 0 ? '+' : ''}${avg33}` : '',
      level,
      '天気・馬場は要確認'
    ].filter(Boolean).join(' / '),
    horses,
    v3DateLabel: dateMatch?.[0] || '',
    v3Course: course,
    v3Avg33: avg33,
    v3RaceLevel: level,
    v3SourcePage: page.pageNo,
  };
}

function v3ParsePremiumPages(pages) {
  return pages
    .map(v3ParsePremiumRacePage)
    .filter(Boolean)
    .sort((a, b) => a.v3SourcePage - b.v3SourcePage);
}

function v3MergeHorse(existing, incoming) {
  if (!existing) return incoming;

  const preservedNotes = existing.note?.trim();
  const importNotes = incoming.note?.trim();
  let note = preservedNotes || importNotes || '';
  if (preservedNotes && importNotes && !preservedNotes.includes(importNotes)) {
    note = `${preservedNotes} / ${importNotes}`;
  }

  return {
    ...incoming,
    id: existing.id || incoming.id,
    lap: existing.lap || incoming.lap,
    style: existing.style || incoming.style,
    firstBlinker: Boolean(existing.firstBlinker),
    trouble: Boolean(existing.trouble),
    note,
  };
}

function v3MergeRace(existing, incoming) {
  if (!existing) return incoming;

  const oldByName = new Map((existing.horses || []).map(h => [h.name || '', h]));

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    weather: existing.weather && existing.weather !== '未設定' ? existing.weather : incoming.weather,
    going: existing.going && existing.going !== '未設定' ? existing.going : incoming.going,
    paceMemo: existing.paceMemo && !/平均33ラップ|天気・馬場は要確認/.test(existing.paceMemo)
      ? `${incoming.paceMemo} / ${existing.paceMemo}`
      : incoming.paceMemo,
    horses: incoming.horses.map(h => v3MergeHorse(oldByName.get(h.name), h)),
  };
}

function v3DateSerial(label = '') {
  const m = String(label).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!month || !day) return null;
  return Math.floor(Date.UTC(2000, month - 1, day) / 86400000);
}

function v3DateDistance(a, b) {
  const sa = v3DateSerial(a);
  const sb = v3DateSerial(b);
  if (sa == null || sb == null) return null;
  const diff = Math.abs(sa - sb);
  // 年末年始の3日開催にも対応。
  return Math.min(diff, 366 - diff);
}

function v3IsPremiumImportedRace(race) {
  return Boolean(race?.v3DateLabel || race?.v3SourcePage);
}

function v3RaceKey(race) {
  const base = `${race?.track || ''}-${race?.raceNo || ''}`;
  const date = String(race?.v3DateLabel || '').trim();
  return date ? `${date}|${base}` : base;
}

function v3IsSameImportWindow(race, importedDates) {
  if (!v3IsPremiumImportedRace(race)) return true;
  if (!importedDates.length) return true;

  const label = String(race.v3DateLabel || '').trim();
  if (!label) return false;

  return importedDates.some(date => {
    const distance = v3DateDistance(label, date);
    // 土日＋3日開催を同じ開催週として保持。
    return distance != null && distance <= 2;
  });
}

function v3SortRaces(races) {
  const venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'];
  return races.sort((a, b) => {
    const ad = v3DateSerial(a.v3DateLabel);
    const bd = v3DateSerial(b.v3DateLabel);
    if (ad != null && bd != null && ad !== bd) return ad - bd;
    if (ad != null && bd == null) return -1;
    if (ad == null && bd != null) return 1;

    const ai = venues.indexOf(a.track);
    const bi = venues.indexOf(b.track);
    const av = ai < 0 ? 99 : ai;
    const bv = bi < 0 ? 99 : bi;
    if (av !== bv) return av - bv;
    return Number(a.raceNo || 0) - Number(b.raceNo || 0);
  });
}

function v3ApplyRaces(imported) {
  const incomingKeys = new Set(imported.map(v3RaceKey));
  const existingMap = new Map(state.races.map(r => [v3RaceKey(r), r]));
  const importedDates = [...new Set(
    imported.map(r => String(r.v3DateLabel || '').trim()).filter(Boolean)
  )];

  let removedStale = 0;
  const untouched = state.races.filter(race => {
    if (incomingKeys.has(v3RaceKey(race))) return false;

    // 新聞PDFは「現在読み込んだ開催日」を1セットとして扱う。
    // 別日のプレミアム新聞取込レースを残すと、土日分が24R+24Rで48Rに重なるため、
    // 新しい日付入りPDFを読み込んだ時は過去のプレミアム取込分を整理する。
    // 手入力レースは残す。
    if (importedDates.length && v3IsPremiumImportedRace(race)) {
      removedStale += 1;
      return false;
    }
    return true;
  });

  const merged = imported.map(race => {
    const key = v3RaceKey(race);
    return v3MergeRace(existingMap.get(key), race);
  });

  state.races = v3SortRaces([...untouched, ...merged]);
  saveState();
  return { removedStale };
}


// 旧版で土日分が同時保持されて48Rになった状態を、ページ読込時に自動修復する。
// 最新のプレミアム新聞日だけ残し、手入力レースは保持する。
function v3CleanupAccumulatedPremiumDays() {
  if (typeof state === 'undefined' || !Array.isArray(state.races)) return 0;
  const premium = state.races.filter(v3IsPremiumImportedRace);
  const labels = [...new Set(premium.map(r => String(r.v3DateLabel || '').trim()).filter(Boolean))];
  if (labels.length <= 1) return 0;

  const latest = labels
    .map(label => ({ label, serial: v3DateSerial(label) }))
    .filter(x => x.serial != null)
    .sort((a, b) => b.serial - a.serial)[0]?.label;
  if (!latest) return 0;

  const before = state.races.length;
  state.races = state.races.filter(r => !v3IsPremiumImportedRace(r) || String(r.v3DateLabel || '').trim() === latest);
  const removed = before - state.races.length;
  if (removed > 0) {
    saveState();
    setTimeout(() => setImportStatus(`重複していた過去日の新聞取込 ${removed}レースを自動整理しました。`, 'ok'), 0);
  }
  return removed;
}
v3CleanupAccumulatedPremiumDays();

async function v3ImportPremiumPdf(file) {
  setImportStatus(`${file.name} をプレミアム版専用ロジックで解析しています…`, 'working');

  try {
    const pages = await v3ExtractPdfPages(file);
    const races = v3ParsePremiumPages(pages);

    if (!races.length) {
      setImportStatus('プレミアム版のレースページを認識できませんでした。', 'warn');
      return;
    }

    const horseCount = races.reduce((sum, race) => sum + race.horses.length, 0);
    const ktmCount = races.reduce((sum, race) => sum + race.horses.filter(isKtm).length, 0);

    const ok = confirm(
      `${races.length}レース・${horseCount}頭を認識しました。\n` +
      `現在のKTMルール該当は ${ktmCount}頭です。\n\n` +
      `読み取る項目：馬名・予想オッズ・人気順・調教印・調教採点・前走比。\n` +
      `B表記は「着用」として記録し、初ブリンカーとは自動判定しません。\n` +
      `同じ日付・開催場・RはPDFデータで更新します。\n` +
      `前週以前の新聞取込レースは自動整理します（手入力レース、同じ週の土日・3日開催は残します）。\n\n` +
      `取り込みますか？`
    );

    if (!ok) {
      setImportStatus('PDF取込をキャンセルしました。', 'warn');
      return;
    }

    const applyResult = v3ApplyRaces(races);
    const cleanupText = applyResult.removedStale
      ? ` 前週以前の新聞取込 ${applyResult.removedStale}レースを整理しました。`
      : '';
    setImportStatus(`${races.length}レース・${horseCount}頭を取り込みました。KTM ${ktmCount}頭。${cleanupText}`);
  } catch (error) {
    console.error(error);
    setImportStatus('プレミアム版PDFの解析に失敗しました。ページを再読み込みして再度お試しください。', 'warn');
  }
}

// app.js が登録した通常PDFリスナーより先に処理し、PDFだけ専用パーサーへ送る。
els.sourceInput.addEventListener('change', async event => {
  const file = els.sourceInput.files?.[0];
  if (!file) return;

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return;

  event.stopImmediatePropagation();
  await v3ImportPremiumPdf(file);
  els.sourceInput.value = '';
}, true);
