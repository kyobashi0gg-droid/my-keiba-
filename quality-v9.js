// MY KEIBA LAB v9 - consultation data quality fixes
(() => {
  if (typeof state === 'undefined') return;

  const norm = (v = '') => String(v).replace(/[\s　・･]/g, '').toLowerCase();
  const raceKey = r => `${String(r?.track || '').trim()}-${String(r?.raceNo || '').replace(/R/ig, '').trim()}`;
  const positiveRank = v => {
    const s = String(v ?? '').trim();
    if (!/\d/.test(s)) return null;
    const n = Number(s.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function saveQuietly() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (typeof render === 'function') render();
  }

  // One-time repair: the first Lap-kun sample (阪神11R) was accidentally copied into 中山1R.
  // Clear it only when the stored values strongly match that exact sample signature.
  function repairSampleContamination() {
    const race = state.races.find(r => r.track === '中山' && String(r.raceNo) === '1');
    if (!race) return;
    const signature = {
      '2': ['126','126','','5'], '3': ['126','126','6',''], '4': ['125','128','',''],
      '5': ['122','127','2',''], '6': ['126','136','','5'], '7': ['123','126','6','4'],
      '9': ['125','125','','2'], '12': ['123','124','3','']
    };
    let hits = 0;
    for (const h of race.horses || []) {
      const sig = signature[String(h.number || '')];
      if (!sig) continue;
      const cur = [h.tenPast1f, h.tenPrev1f, h.tenRank, h.agariRank].map(v => String(v ?? ''));
      if (cur.every((v, i) => v === sig[i])) hits++;
    }
    if (hits < 6) return;
    for (const h of race.horses || []) {
      h.tenPast1f = '';
      h.tenPrev1f = '';
      h.tenRank = '';
      h.agariRank = '';
      delete h.lapkunImportedAt;
      delete h.lapkunSource;
    }
    race.v9LapkunRepair = true;
    saveQuietly();
  }

  // Future imports: if a pasted header says 阪神11R while another race detail is open, block it.
  function parsedHeader(text) {
    const m = String(text || '').match(/^(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)\s*[,|\t ]\s*(\d{1,2})\s*R?/m);
    return m ? { track: m[1], raceNo: m[2] } : null;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest?.('#v5Apply');
    if (!btn) return;
    const race = raceFromDetail();
    const area = document.querySelector('#v5ImportText');
    const header = parsedHeader(area?.value || '');
    if (!race || !header) return;
    if (race.track !== header.track || String(race.raceNo) !== String(header.raceNo)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const out = document.querySelector('#v5ImportResult');
      if (out) {
        out.hidden = false;
        out.className = 'v5-result ng';
        out.textContent = `取込を停止しました。開いているレースは ${race.track}${race.raceNo}R、貼り付けデータは ${header.track}${header.raceNo}R です。`;
      }
    }
  }, true);

  // Fix course and the two newspaper editorial boxes on the next PDF import.
  if (typeof v3ParsePremiumRacePage === 'function') {
    const original = v3ParsePremiumRacePage;
    v3ParsePremiumRacePage = function(page) {
      const race = original(page);
      if (!race) return race;

      if (!race.v3Course) {
        const cm = String(page?.text || '').match(/(?:^|\s)(芝|ダ)\s*(\d{3,4})(?=\s|$)/m);
        if (cm) race.v3Course = `${cm[1]}${cm[2]}`;
      }

      const lines = String(page?.text || '').split('\n').map(x => x.trim()).filter(Boolean);
      const headerIdx = lines.findIndex(line => new RegExp(`^${race.track}\\s+${race.raceNo}$`).test(line));
      if (headerIdx >= 0) {
        const horseNames = new Set((race.horses || []).map(h => norm(h.name)));
        const found = [];
        for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 18) && found.length < 2; i++) {
          const m = lines[i].match(/^(\d{1,2})\s+([^\s]+)\s+(.+)$/);
          if (!m) continue;
          const horse = (race.horses || []).find(h => String(h.number || '') === m[1]);
          if (!horse) continue;
          let reason = m[3].trim();
          for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
            if (/^\d{1,2}\s+[^\s]+\s+/.test(lines[j])) break;
            if (horseNames.has(norm(lines[j]))) break;
            if (/^(?:全[芝ダ]|\d+|\(\)|#N\/A)/.test(lines[j])) break;
            reason += lines[j];
          }
          found.push({ horse, reason });
        }
        for (const h of race.horses || []) {
          h.popularBlindSpot = false;
          h.popularBlindSpotReason = '';
          h.holeQualification = false;
          h.holeQualificationReason = '';
        }
        if (found[0]) {
          found[0].horse.popularBlindSpot = true;
          found[0].horse.popularBlindSpotReason = found[0].reason;
        }
        if (found[1]) {
          found[1].horse.holeQualification = true;
          found[1].horse.holeQualificationReason = found[1].reason;
        }
      }
      return race;
    };
  }

  function topLine(race, key) {
    const top = (race.horses || [])
      .map(h => ({ h, n: positiveRank(h[key]) }))
      .filter(x => x.n !== null)
      .sort((a, b) => a.n - b.n)
      .slice(0, 3);
    return top.length ? top.map(x => `${x.h.number || '—'}番 ${x.h.name}(${x.n}位)`).join(' / ') : 'データなし';
  }

  function repairConsultText() {
    const area = document.querySelector('#v6ConsultText');
    const race = raceFromDetail();
    if (!area || !race || !area.value) return;
    let text = area.value;
    text = text.replace(/・テン順上位（取得分）:.*(?:\n|$)/, `・テン順上位（取得分）: ${topLine(race, 'tenRank')}\n`);
    text = text.replace(/・上がり順上位（取得分）:.*(?:\n|$)/, `・上がり順上位（取得分）: ${topLine(race, 'agariRank')}\n`);
    area.value = text;
  }

  document.addEventListener('click', e => {
    if (e.target.closest?.('#v5AskLapkun')) {
      setTimeout(repairConsultText, 140);
      setTimeout(repairConsultText, 320);
    }
  });

  repairSampleContamination();
})();
