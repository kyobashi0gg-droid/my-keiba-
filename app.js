const STORAGE_KEY = 'my-keiba-lab-v2';
const LEGACY_KEY = 'my-keiba-lab-v1';

const els = {
  raceList: document.querySelector('#raceList'),
  emptyState: document.querySelector('#emptyState'),
  raceCount: document.querySelector('#raceCount'),
  ktmCount: document.querySelector('#ktmCount'),
  valueCount: document.querySelector('#valueCount'),
  rankList: document.querySelector('#rankList'),
  importStatus: document.querySelector('#importStatus'),
  raceDialog: document.querySelector('#raceDialog'),
  raceForm: document.querySelector('#raceForm'),
  raceId: document.querySelector('#raceId'),
  track: document.querySelector('#track'),
  raceNo: document.querySelector('#raceNo'),
  raceName: document.querySelector('#raceName'),
  weather: document.querySelector('#weather'),
  going: document.querySelector('#going'),
  paceMemo: document.querySelector('#paceMemo'),
  horseEditor: document.querySelector('#horseEditor'),
  horseTemplate: document.querySelector('#horseFormTemplate'),
  dialogTitle: document.querySelector('#dialogTitle'),
  deleteRaceBtn: document.querySelector('#deleteRaceBtn'),
  importInput: document.querySelector('#importInput'),
  sourceInput: document.querySelector('#sourceInput'),
};

let state = loadState();
let activeFilter = 'all';

function loadState() {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed && Array.isArray(parsed.races)) return parsed;
    } catch {}
  }
  return { races: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function num(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isKtm(horse) {
  const markOk = ['◎', '○', '▲'].includes(horse.mark);
  const diff = num(horse.diff);
  return markOk && diff !== null && diff >= 6 && diff <= 19;
}

function trainingBonus(horse, race) {
  const score = num(horse.trainingScore);
  if (score === null) return 0;
  const scores = (race?.horses || [])
    .map(h => num(h.trainingScore))
    .filter(v => v !== null)
    .sort((a, b) => b - a);
  if (!scores.length) return 0;
  const rank = scores.findIndex(v => v <= score) + 1;
  if (rank === 1) return 2;
  if (rank <= Math.ceil(scores.length / 2)) return 1;
  return 0;
}

function valueScore(horse, race) {
  let score = 0;
  if (isKtm(horse)) score += 4;
  if (horse.lap === 'S') score += 3;
  else if (horse.lap === 'A') score += 2;
  else if (horse.lap === 'B') score += 1;
  score += trainingBonus(horse, race);

  const pop = num(horse.popularity);
  const odds = num(horse.odds);
  if (pop !== null && pop >= 10) score += 2;
  else if (pop !== null && pop >= 6) score += 1;
  if (odds !== null && odds >= 20) score += 2;
  else if (odds !== null && odds >= 10) score += 1;
  if (horse.firstBlinker) score += 1;
  if (horse.trouble) score += 1;
  return score;
}

function isValue(horse, race) {
  return valueScore(horse, race) >= 7;
}

function scoreGrade(score) {
  if (score >= 10) return 'S';
  if (score >= 8) return 'A';
  if (score >= 7) return 'B';
  return '';
}

function scoreReasons(horse, race) {
  const reasons = [];
  if (isKtm(horse)) reasons.push('KTM');
  if (horse.lap === 'S' || horse.lap === 'A') reasons.push(`33ラップ${horse.lap}`);
  const tBonus = trainingBonus(horse, race);
  if (tBonus === 2) reasons.push('調教採点上位');
  else if (tBonus === 1) reasons.push('調教採点好位');
  const pop = num(horse.popularity);
  const odds = num(horse.odds);
  if (pop !== null && pop >= 6) reasons.push(`${pop}人気`);
  if (odds !== null && odds >= 10) reasons.push(`${odds}倍`);
  if (horse.firstBlinker) reasons.push('初B');
  if (horse.trouble) reasons.push('前走不利');
  return reasons;
}

function allEntries() {
  return state.races.flatMap(race => (race.horses || []).map(horse => ({ race, horse })));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const entries = allEntries();
  els.raceCount.textContent = state.races.length;
  els.ktmCount.textContent = entries.filter(({ horse }) => isKtm(horse)).length;
  els.valueCount.textContent = entries.filter(({ horse, race }) => isValue(horse, race)).length;
  renderRanking(entries);

  let races = state.races;
  if (activeFilter === 'ktm') races = races.filter(r => (r.horses || []).some(isKtm));
  if (activeFilter === 'value') races = races.filter(r => (r.horses || []).some(h => isValue(h, r)));

  els.raceList.innerHTML = races.map(raceCardHtml).join('');
  els.emptyState.hidden = state.races.length > 0;

  document.querySelectorAll('.race-card').forEach(card => {
    card.addEventListener('click', () => openRaceEditor(card.dataset.id));
  });
}

function renderRanking(entries) {
  const ranked = entries
    .filter(({ horse }) => horse.name)
    .map(entry => ({ ...entry, score: valueScore(entry.horse, entry.race) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!ranked.length) {
    els.rankList.innerHTML = '<div class="rank-empty">馬データを登録すると、ここに穴候補が自動表示されます。</div>';
    return;
  }

  els.rankList.innerHTML = ranked.map((entry, index) => {
    const grade = scoreGrade(entry.score);
    const reasons = scoreReasons(entry.horse, entry.race).slice(0, 4).join('・') || 'データ不足';
    return `<button class="rank-row" data-race-id="${escapeHtml(entry.race.id)}">
      <span class="rank-no">${index + 1}</span>
      <span class="rank-main">
        <strong>${escapeHtml(entry.horse.name)}</strong>
        <small>${escapeHtml(entry.race.track)} ${escapeHtml(entry.race.raceNo)}R ${escapeHtml(entry.race.raceName)}</small>
        <small>${escapeHtml(reasons)}</small>
      </span>
      <span class="rank-score">${grade ? `<b>${grade}</b>` : ''}<strong>${entry.score}</strong><small>pt</small></span>
    </button>`;
  }).join('');

  els.rankList.querySelectorAll('.rank-row').forEach(btn => {
    btn.addEventListener('click', () => openRaceEditor(btn.dataset.raceId));
  });
}

function raceCardHtml(race) {
  let horses = [...(race.horses || [])];
  if (activeFilter === 'ktm') horses = horses.filter(isKtm);
  if (activeFilter === 'value') horses = horses.filter(h => isValue(h, race));
  horses.sort((a, b) => valueScore(b, race) - valueScore(a, race));

  const horseHtml = horses.length
    ? horses.map(horse => horseRowHtml(horse, race)).join('')
    : '<div class="horse-row"><div><div class="horse-name">出走馬データ未登録</div><div class="horse-sub">タップして追加できます</div></div></div>';

  return `<article class="race-card" data-id="${escapeHtml(race.id)}">
    <div class="race-card-head">
      <div class="race-title">
        <div class="race-no">${escapeHtml(race.raceNo)}R</div>
        <div>
          <h3>${escapeHtml(race.track)} ${escapeHtml(race.raceName)}</h3>
          <div class="meta">${escapeHtml(race.weather)} ・ ${escapeHtml(race.going)}馬場</div>
        </div>
      </div>
      <span class="pill">編集</span>
    </div>
    <div class="horse-list">${horseHtml}</div>
    ${race.paceMemo ? `<p class="race-note">展開・馬場：${escapeHtml(race.paceMemo)}</p>` : ''}
  </article>`;
}

function horseRowHtml(horse, race) {
  const ktm = isKtm(horse);
  const score = valueScore(horse, race);
  const value = isValue(horse, race);
  const pop = num(horse.popularity);
  const odds = num(horse.odds);
  const training = num(horse.trainingScore);
  const detail = [
    pop ? `${pop}人気` : '',
    odds ? `${odds}倍` : '',
    horse.mark ? `調教${horse.mark}` : '',
    training !== null ? `採点${training}` : '',
    horse.diff !== '' && horse.diff != null ? `前走比${Number(horse.diff) >= 0 ? '+' : ''}${horse.diff}` : '',
    horse.lap ? `33ラップ ${horse.lap}` : '',
    horse.style || '',
    horse.firstBlinker ? '初B' : '',
    horse.trouble ? '前走不利' : ''
  ].filter(Boolean).join(' / ');
  return `<div class="horse-row">
    <div>
      <div class="horse-name">${escapeHtml(horse.name || '馬名未入力')}</div>
      <div class="horse-sub">${escapeHtml(detail || 'データ未入力')}</div>
    </div>
    <div class="badges">
      ${ktm ? '<span class="badge ktm">KTM</span>' : ''}
      ${value ? `<span class="badge value">穴${scoreGrade(score)} ${score}pt</span>` : ''}
    </div>
  </div>`;
}

function addHorseEditor(horse = {}) {
  const fragment = els.horseTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.horse-form-card');
  card.dataset.id = horse.id || '';
  card.querySelector('.h-name').value = horse.name || '';
  card.querySelector('.h-pop').value = horse.popularity ?? '';
  card.querySelector('.h-mark').value = horse.mark || '';
  card.querySelector('.h-training').value = horse.trainingScore ?? '';
  card.querySelector('.h-diff').value = horse.diff ?? '';
  card.querySelector('.h-lap').value = horse.lap || '';
  card.querySelector('.h-odds').value = horse.odds ?? '';
  card.querySelector('.h-style').value = horse.style || '';
  card.querySelector('.h-first-blinker').checked = Boolean(horse.firstBlinker);
  card.querySelector('.h-trouble').checked = Boolean(horse.trouble);
  card.querySelector('.h-note').value = horse.note || '';
  card.querySelector('.remove-horse').addEventListener('click', () => card.remove());
  els.horseEditor.append(fragment);
}

function getHorseEditorData() {
  return [...els.horseEditor.querySelectorAll('.horse-form-card')]
    .map(card => ({
      id: card.dataset.id || uid(),
      name: card.querySelector('.h-name').value.trim(),
      popularity: card.querySelector('.h-pop').value,
      mark: card.querySelector('.h-mark').value,
      trainingScore: card.querySelector('.h-training').value,
      diff: card.querySelector('.h-diff').value,
      lap: card.querySelector('.h-lap').value,
      odds: card.querySelector('.h-odds').value,
      style: card.querySelector('.h-style').value,
      firstBlinker: card.querySelector('.h-first-blinker').checked,
      trouble: card.querySelector('.h-trouble').checked,
      note: card.querySelector('.h-note').value.trim(),
    }))
    .filter(h => h.name || h.mark || h.lap || h.note || h.trainingScore !== '');
}

function openRaceEditor(id = null, seed = null) {
  const race = id ? state.races.find(r => r.id === id) : null;
  const data = race || seed;
  els.raceForm.reset();
  els.horseEditor.innerHTML = '';
  els.raceId.value = race?.id || '';
  els.dialogTitle.textContent = race ? 'レース編集' : seed ? '新聞データ確認' : 'レース登録';
  els.deleteRaceBtn.hidden = !race;

  if (data) {
    els.track.value = data.track || '';
    els.raceNo.value = data.raceNo || '11';
    els.raceName.value = data.raceName || '';
    els.weather.value = data.weather || '晴';
    els.going.value = data.going || '良';
    els.paceMemo.value = data.paceMemo || '';
    (data.horses || []).forEach(addHorseEditor);
    if (!(data.horses || []).length) addHorseEditor();
  } else {
    els.raceNo.value = '11';
    addHorseEditor();
  }

  els.raceDialog.showModal();
}

function closeDialog() {
  els.raceDialog.close();
}

function setImportStatus(message, kind = 'ok') {
  els.importStatus.hidden = false;
  els.importStatus.className = `import-status ${kind}`;
  els.importStatus.textContent = message;
  clearTimeout(setImportStatus.timer);
  setImportStatus.timer = setTimeout(() => { els.importStatus.hidden = true; }, 9000);
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u3000/g, ' ')
    .replace(/[‐‑–—−]/g, '-')
    .replace(/＋/g, '+')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}

function detectHorseName(line) {
  const blocked = new Set(['サンプル', 'ラップ', 'ブリンカー', 'コメント', 'トレセン', 'レース', 'ペース']);
  const katakana = line.match(/[ァ-ヶー]{2,20}/g) || [];
  const goodKata = katakana.find(x => !blocked.has(x) && !/^(ステークス|カップ|ハンデ)$/.test(x));
  if (goodKata) return goodKata;
  const latin = line.match(/\b[A-Za-z][A-Za-z0-9.'-]{2,20}\b/g) || [];
  return latin.find(x => !['33', 'KTM'].includes(x.toUpperCase())) || '';
}

function parseHorseLine(rawLine) {
  const line = normalizeText(rawLine).replace(/\s+/g, ' ').trim();
  if (!line) return null;
  const name = detectHorseName(line);
  if (!name) return null;

  const marks = [...line.matchAll(/[◎○▲△×]/g)].map(m => m[0]);
  const mark = marks.at(-1) || '';
  const trainingMatch = line.match(/(\d{2,3})\s*\(\s*([+-]?\d{1,2})\s*\)/);
  const diffOnly = line.match(/(?:前走比|比較)\s*[:：]?\s*([+-]?\d{1,2})/);
  const trainingOnly = line.match(/(?:調教採点|採点)\s*[:：]?\s*(\d{2,3})/);
  const popMatch = line.match(/(\d{1,2})\s*人気/);
  const oddsMatch = line.match(/(\d+(?:\.\d+)?)\s*倍/);
  const lapMatch = line.match(/33\s*ラップ[^SABC\n]{0,12}\b([SABC])\b/i) || line.match(/\b33L\s*[:：]?\s*([SABC])\b/i);
  const styleMatch = line.match(/(逃げ|先行|差し|追込)/);

  const horse = {
    id: uid(),
    name,
    popularity: popMatch?.[1] || '',
    odds: oddsMatch?.[1] || '',
    mark,
    trainingScore: trainingMatch?.[1] || trainingOnly?.[1] || '',
    diff: trainingMatch?.[2] || diffOnly?.[1] || '',
    lap: lapMatch?.[1]?.toUpperCase() || '',
    style: styleMatch?.[1] || '',
    firstBlinker: /初\s*(?:ブリンカー|B\b)|初B/i.test(line),
    trouble: /(前走不利|不利|前が壁|詰ま|挟ま|接触)/.test(line),
    note: '',
  };

  const hasSignal = horse.mark || horse.trainingScore !== '' || horse.diff !== '' || horse.popularity || horse.odds || horse.lap || horse.style || horse.firstBlinker || horse.trouble;
  return hasSignal ? horse : null;
}

function parseNewspaperText(rawText) {
  const text = normalizeText(rawText);
  const venues = '札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉';
  const venueMatch = text.match(new RegExp(`(${venues})\\s*(\\d{1,2})R`));
  let track = venueMatch?.[1] || '';
  let raceNo = venueMatch?.[2] || '11';
  let raceName = '';
  if (venueMatch) {
    const after = text.slice(venueMatch.index + venueMatch[0].length).split(/\n/)[0].trim();
    if (after && after.length <= 40) raceName = after.replace(/^[-:：\s]+/, '');
  }

  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const found = [];
  for (const line of lines) {
    const horse = parseHorseLine(line);
    if (!horse) continue;
    const existing = found.find(h => h.name === horse.name);
    if (!existing) {
      found.push(horse);
    } else {
      for (const key of ['popularity','odds','mark','trainingScore','diff','lap','style']) {
        if (!existing[key] && horse[key]) existing[key] = horse[key];
      }
      existing.firstBlinker ||= horse.firstBlinker;
      existing.trouble ||= horse.trouble;
    }
  }

  return {
    track,
    raceNo,
    raceName: raceName || '新聞取込レース',
    weather: '晴',
    going: '良',
    paceMemo: '新聞/PDFから仮取込。内容を確認してから保存してください。',
    horses: found.slice(0, 30),
  };
}

async function extractPdfText(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const rows = [];
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = item.transform?.[5] ?? 0;
      const x = item.transform?.[4] ?? 0;
      let row = rows.find(r => Math.abs(r.y - y) < 2.5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, text: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    pages.push(rows.map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')).join('\n'));
  }
  return pages.join('\n');
}

async function importNewspaperFile(file) {
  setImportStatus(`${file.name} を解析しています…`, 'working');
  try {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const text = isPdf ? await extractPdfText(file) : await file.text();
    if (!text.trim()) throw new Error('文字情報を取得できませんでした');
    const seed = parseNewspaperText(text);
    if (!seed.horses.length) {
      setImportStatus('自動認識できる馬データが見つかりませんでした。画像だけのPDFは現在の第2版では自動読取できません。', 'warn');
      return;
    }
    setImportStatus(`${seed.horses.length}頭を仮抽出しました。調教印・前走比などを確認して保存してください。`, 'ok');
    openRaceEditor(null, seed);
  } catch (error) {
    console.error(error);
    setImportStatus('PDFの解析に失敗しました。文字PDFまたはTXT/CSVで試してください。', 'warn');
  }
}

document.querySelector('#newRaceBtn').addEventListener('click', () => openRaceEditor());
document.querySelector('[data-action="new-race"]').addEventListener('click', () => openRaceEditor());
document.querySelector('#addHorseBtn').addEventListener('click', () => addHorseEditor());
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeDialog));

els.raceForm.addEventListener('submit', event => {
  event.preventDefault();
  const race = {
    id: els.raceId.value || uid(),
    track: els.track.value.trim(),
    raceNo: els.raceNo.value,
    raceName: els.raceName.value.trim(),
    weather: els.weather.value,
    going: els.going.value,
    paceMemo: els.paceMemo.value.trim(),
    horses: getHorseEditorData(),
  };

  const index = state.races.findIndex(r => r.id === race.id);
  if (index >= 0) state.races[index] = race;
  else state.races.unshift(race);
  saveState();
  closeDialog();
});

els.deleteRaceBtn.addEventListener('click', () => {
  const id = els.raceId.value;
  if (!id) return;
  if (!confirm('このレースを削除しますか？')) return;
  state.races = state.races.filter(r => r.id !== id);
  saveState();
  closeDialog();
});

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === btn));
    render();
  });
});

document.querySelector('#demoBtn').addEventListener('click', () => {
  if (state.races.length && !confirm('サンプルレースを追加しますか？')) return;
  state.races.unshift({
    id: uid(),
    track: '中山',
    raceNo: '11',
    raceName: '穴馬チェック練習',
    weather: '晴',
    going: '良',
    paceMemo: 'サンプルです。先行馬が多く、差しの展開利も確認する想定。',
    horses: [
      { id: uid(), name: 'サンプルホースA', popularity: '8', mark: '○', trainingScore: '74', diff: '8', lap: 'A', odds: '18.6', style: '差し', firstBlinker: false, trouble: true, note: 'KTM＋33ラップA＋前走不利の例' },
      { id: uid(), name: 'サンプルホースB', popularity: '2', mark: '△', trainingScore: '76', diff: '3', lap: 'S', odds: '4.8', style: '先行', firstBlinker: false, trouble: false, note: '33ラップ評価は高いが人気馬の例' },
      { id: uid(), name: 'サンプルホースC', popularity: '12', mark: '▲', trainingScore: '71', diff: '11', lap: 'B', odds: '32.0', style: '追込', firstBlinker: true, trouble: false, note: 'KTM＋人気薄＋初Bの例' }
    ]
  });
  saveState();
});

document.querySelector('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-keiba-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.races)) throw new Error('format');
    if (!confirm('現在のデータを読み込んだデータで置き換えますか？')) return;
    state = parsed;
    saveState();
    setImportStatus('バックアップを読み込みました。');
  } catch {
    setImportStatus('このJSONファイルは読み込めませんでした。', 'warn');
  } finally {
    els.importInput.value = '';
  }
});

els.sourceInput.addEventListener('change', async () => {
  const file = els.sourceInput.files?.[0];
  if (!file) return;
  await importNewspaperFile(file);
  els.sourceInput.value = '';
});

els.raceDialog.addEventListener('click', event => {
  if (event.target === els.raceDialog) closeDialog();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

render();
