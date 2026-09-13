// MY KEIBA LAB v16 - 軽量データモデル基盤
// 既存データを壊さず、今後のソート・馬DB追加に使う共通ルールを提供。
(() => {
  if (typeof state === 'undefined' || window.MyKeibaDataV16) return;

  const MISSING = new Set(['', '-', '—', '―', '－', 'null', 'undefined']);

  function isMissing(value) {
    if (value == null) return true;
    return MISSING.has(String(value).trim().toLowerCase());
  }

  function toNumber(value) {
    if (isMissing(value)) return null;
    const n = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTrack(value = '') {
    return String(value || '').replace(/競馬場/g, '').trim();
  }

  function normalizeRaceNo(value = '') {
    return String(value || '').replace(/R/ig, '').trim();
  }

  function normalizeHorseName(value = '') {
    return String(value || '').replace(/[\s　・･]/g, '').trim();
  }

  function horseNumber(horse) {
    return toNumber(horse?.number);
  }

  function ensureHorseMeta(horse, index) {
    if (!horse || typeof horse !== 'object') return;
    if (!horse.meta || typeof horse.meta !== 'object' || Array.isArray(horse.meta)) horse.meta = {};

    const no = horseNumber(horse);
    if (!Number.isFinite(Number(horse.meta.baseOrder))) {
      horse.meta.baseOrder = no ?? (index + 1);
    }
    if (!horse.meta.sourceName && horse.name) horse.meta.sourceName = String(horse.name);
  }

  function ensureRaceMeta(race, raceIndex) {
    if (!race || typeof race !== 'object') return;
    if (!race.meta || typeof race.meta !== 'object' || Array.isArray(race.meta)) race.meta = {};
    if (!Number.isFinite(Number(race.meta.baseOrder))) race.meta.baseOrder = raceIndex + 1;
    if (!Array.isArray(race.horses)) race.horses = [];
    race.horses.forEach(ensureHorseMeta);
  }

  function normalizeState() {
    if (!state || typeof state !== 'object') return false;
    if (!Array.isArray(state.races)) state.races = [];
    if (!state.meta || typeof state.meta !== 'object' || Array.isArray(state.meta)) state.meta = {};

    state.meta.schemaVersion = 16;
    state.meta.dataModel = 'lightweight-v1';
    state.races.forEach(ensureRaceMeta);
    return true;
  }

  function compareNullable(a, b, direction = 'asc') {
    const av = toNumber(a);
    const bv = toNumber(b);
    const aMissing = av === null;
    const bMissing = bv === null;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return direction === 'desc' ? bv - av : av - bv;
  }

  function byHorseNumber(a, b) {
    const an = horseNumber(a);
    const bn = horseNumber(b);
    if (an !== null || bn !== null) {
      const cmp = compareNullable(an, bn, 'asc');
      if (cmp) return cmp;
    }
    return Number(a?.meta?.baseOrder || 999) - Number(b?.meta?.baseOrder || 999);
  }

  function sortHorses(horses, mode = 'number') {
    const list = [...(horses || [])];
    const stable = (cmp) => list
      .map((horse, index) => ({ horse, index }))
      .sort((x, y) => cmp(x.horse, y.horse) || x.index - y.index)
      .map(x => x.horse);

    if (mode === 'tenRank') return stable((a, b) => compareNullable(a?.tenRank, b?.tenRank, 'asc') || byHorseNumber(a, b));
    if (mode === 'agariRank') return stable((a, b) => compareNullable(a?.agariRank, b?.agariRank, 'asc') || byHorseNumber(a, b));
    return stable(byHorseNumber);
  }

  function raceKey(race) {
    return `${normalizeTrack(race?.track)}:${normalizeRaceNo(race?.raceNo)}`;
  }

  function horseKey(horse) {
    const bloodNo = String(horse?.bloodRegistrationNo || horse?.registrationNo || '').trim();
    const name = normalizeHorseName(horse?.name);
    return bloodNo ? `reg:${bloodNo}` : `name:${name}`;
  }

  function persistFoundation() {
    try {
      if (typeof STORAGE_KEY !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  normalizeState();
  persistFoundation();

  window.MyKeibaDataV16 = {
    isMissing,
    toNumber,
    normalizeTrack,
    normalizeRaceNo,
    normalizeHorseName,
    normalizeState,
    sortHorses,
    raceKey,
    horseKey,
    schemaVersion: 16,
  };

  // v17: Androidの競走馬DB検索欄を安定化。動的読込なので既存のindex構成を壊さない。
  if (!document.querySelector('script[data-mykeiba-horse-search-v17]')) {
    const script = document.createElement('script');
    script.src = 'horse-search-v17.js';
    script.defer = true;
    script.dataset.mykeibaHorseSearchV17 = '1';
    document.head.appendChild(script);
  }
})();