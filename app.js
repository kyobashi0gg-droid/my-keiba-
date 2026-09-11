const STORAGE_KEY = 'my-keiba-lab-v1';

const els = {
  raceList: document.querySelector('#raceList'),
  emptyState: document.querySelector('#emptyState'),
  raceCount: document.querySelector('#raceCount'),
  ktmCount: document.querySelector('#ktmCount'),
  valueCount: document.querySelector('#valueCount'),
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
};

let state = loadState();
let activeFilter = 'all';

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.races) ? parsed : { races: [] };
  } catch {
    return { races: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isKtm(horse) {
  const markOk = ['◎', '○', '▲'].includes(horse.mark);
  const diff = num(horse.diff);
  return markOk && diff !== null && diff >= 6 && diff <= 19;
}

function valueScore(horse) {
  let score = 0;
  if (isKtm(horse)) score += 3;
  if (horse.lap === 'S') score += 3;
  else if (horse.lap === 'A') score += 2;
  else if (horse.lap === 'B') score += 1;
  const pop = num(horse.popularity);
  const odds = num(horse.odds);
  if (pop !== null && pop >= 6) score += 1;
  if (odds !== null && odds >= 10) score += 1;
  return score;
}

function isValue(horse) {
  return valueScore(horse) >= 5;
}

function allHorses() {
  return state.races.flatMap(race => race.horses || []);
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
  const horses = allHorses();
  els.raceCount.textContent = state.races.length;
  els.ktmCount.textContent = horses.filter(isKtm).length;
  els.valueCount.textContent = horses.filter(isValue).length;

  let races = state.races;
  if (activeFilter === 'ktm') races = races.filter(r => (r.horses || []).some(isKtm));
  if (activeFilter === 'value') races = races.filter(r => (r.horses || []).some(isValue));

  els.raceList.innerHTML = races.map(raceCardHtml).join('');
  els.emptyState.hidden = state.races.length > 0;

  document.querySelectorAll('.race-card').forEach(card => {
    card.addEventListener('click', () => openRaceEditor(card.dataset.id));
  });
}

function raceCardHtml(race) {
  let horses = [...(race.horses || [])];
  if (activeFilter === 'ktm') horses = horses.filter(isKtm);
  if (activeFilter === 'value') horses = horses.filter(isValue);
  horses.sort((a, b) => valueScore(b) - valueScore(a));

  const horseHtml = horses.length
    ? horses.map(horseRowHtml).join('')
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
    ${race.paceMemo ? `<p class="race-note">展開：${escapeHtml(race.paceMemo)}</p>` : ''}
  </article>`;
}

function horseRowHtml(horse) {
  const ktm = isKtm(horse);
  const value = isValue(horse);
  const pop = num(horse.popularity);
  const odds = num(horse.odds);
  const detail = [
    pop ? `${pop}人気` : '',
    odds ? `${odds}倍` : '',
    horse.mark ? `調教${horse.mark}` : '',
    horse.diff !== '' && horse.diff != null ? `前走比${Number(horse.diff) >= 0 ? '+' : ''}${horse.diff}` : '',
    horse.lap ? `33ラップ ${horse.lap}` : '',
    horse.style || ''
  ].filter(Boolean).join(' / ');
  return `<div class="horse-row">
    <div>
      <div class="horse-name">${escapeHtml(horse.name || '馬名未入力')}</div>
      <div class="horse-sub">${escapeHtml(detail || 'データ未入力')}</div>
    </div>
    <div class="badges">
      ${ktm ? '<span class="badge ktm">KTM</span>' : ''}
      ${value ? `<span class="badge value">穴注目 ${valueScore(horse)}</span>` : ''}
    </div>
  </div>`;
}

function addHorseEditor(horse = {}) {
  const fragment = els.horseTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.horse-form-card');
  card.querySelector('.h-name').value = horse.name || '';
  card.querySelector('.h-pop').value = horse.popularity ?? '';
  card.querySelector('.h-mark').value = horse.mark || '';
  card.querySelector('.h-diff').value = horse.diff ?? '';
  card.querySelector('.h-lap').value = horse.lap || '';
  card.querySelector('.h-odds').value = horse.odds ?? '';
  card.querySelector('.h-style').value = horse.style || '';
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
      diff: card.querySelector('.h-diff').value,
      lap: card.querySelector('.h-lap').value,
      odds: card.querySelector('.h-odds').value,
      style: card.querySelector('.h-style').value,
      note: card.querySelector('.h-note').value.trim(),
    }))
    .filter(h => h.name || h.mark || h.lap || h.note);
}

function openRaceEditor(id = null) {
  const race = id ? state.races.find(r => r.id === id) : null;
  els.raceForm.reset();
  els.horseEditor.innerHTML = '';
  els.raceId.value = race?.id || '';
  els.dialogTitle.textContent = race ? 'レース編集' : 'レース登録';
  els.deleteRaceBtn.hidden = !race;

  if (race) {
    els.track.value = race.track || '';
    els.raceNo.value = race.raceNo || '11';
    els.raceName.value = race.raceName || '';
    els.weather.value = race.weather || '晴';
    els.going.value = race.going || '良';
    els.paceMemo.value = race.paceMemo || '';
    (race.horses || []).forEach(addHorseEditor);
  } else {
    els.raceNo.value = '11';
    addHorseEditor();
  }

  els.raceDialog.showModal();
}

function closeDialog() {
  els.raceDialog.close();
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
    track: 'サンプル',
    raceNo: '11',
    raceName: '穴馬チェック練習',
    weather: '晴',
    going: '良',
    paceMemo: 'これは操作確認用のサンプルです。実際の予想データではありません。',
    horses: [
      { id: uid(), name: 'サンプルホースA', popularity: '8', mark: '○', diff: '8', lap: 'A', odds: '18.6', style: '差し', note: 'KTM条件＋33ラップAの例' },
      { id: uid(), name: 'サンプルホースB', popularity: '2', mark: '△', diff: '3', lap: 'S', odds: '4.8', style: '先行', note: '33ラップ評価は高いが人気馬の例' }
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
  } catch {
    alert('このJSONファイルは読み込めませんでした。');
  } finally {
    els.importInput.value = '';
  }
});

els.raceDialog.addEventListener('click', event => {
  if (event.target === els.raceDialog) closeDialog();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

render();
