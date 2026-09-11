// MY KEIBA LAB v10.2 - robust newspaper editorial extraction
(() => {
  if (typeof state === 'undefined') return;

  const norm = (v = '') => String(v)
    .replace(/[\s　・･]/g, '')
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();

  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasJapanese = s => /[ぁ-んァ-ヶ一-龯]/.test(String(s || ''));

  function namePrefixMatches(horseName, token) {
    const h = norm(horseName);
    const t = norm(token);
    return !!h && !!t && (h.startsWith(t) || t.startsWith(h));
  }

  function findHorse(race, number, token) {
    return (race.horses || []).find(h =>
      String(h.number || '') === String(number || '') && namePrefixMatches(h.name, token)
    ) || null;
  }

  function isContinuationNoise(line, race) {
    const s = String(line || '').trim();
    if (!s) return true;
    if (/^(?:#N\/A|全[芝ダ　]|枠\b|\(\)|人気馬の|◎\s*\d)/.test(s)) return true;
    if (/^\d{1,2}\s+[^\s]+\s+/.test(s)) return true;
    if ((race.horses || []).some(h => norm(h.name) === norm(s))) return true;
    return false;
  }

  function collectRowsAfterMarker(lines, start, race) {
    const rows = [];
    for (let i = start + 1; i < Math.min(lines.length, start + 18) && rows.length < 2; i++) {
      const m = lines[i].match(/^(\d{1,2})\s+([^\s]+)\s+(.+)$/);
      if (!m) continue;

      const horse = findHorse(race, m[1], m[2]);
      if (!horse) continue;

      let reason = m[3].trim();
      if (!hasJapanese(reason)) continue;
      if (/%|人\d+番|ﾄ\b/.test(reason)) continue;

      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].trim();
        if (isContinuationNoise(next, race)) break;
        if (!hasJapanese(next)) break;
        reason += next;
      }

      rows.push({ horse, reason: reason.replace(/\s+/g, ' ').trim() });
    }
    return rows;
  }

  function collectAnchoredRows(page, race) {
    const lines = String(page?.text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const marker = new RegExp(`^${escRe(race.track)}\\s+${escRe(String(race.raceNo))}\\s*$`);
    const wanted = norm(`${race.track}${race.raceNo}`);

    // The PDF can contain more than one exact-looking "中山 1" marker on the same page.
    // Try every marker and keep the one immediately followed by the two editorial rows.
    const starts = [];
    lines.forEach((line, index) => {
      if (marker.test(line) || norm(line) === wanted) starts.push(index);
    });

    for (const start of starts) {
      const rows = collectRowsAfterMarker(lines, start, race);
      if (rows.length >= 2) return rows.slice(0, 2);
    }

    // Last-resort fallback: find a consecutive pair of editorial-looking rows anywhere
    // on the page, still requiring horse number + abbreviated horse-name prefix.
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\d{1,2})\s+([^\s]+)\s+(.+)$/);
      if (!m) continue;
      const horse = findHorse(race, m[1], m[2]);
      if (!horse) continue;
      let reason = m[3].trim();
      if (!hasJapanese(reason) || /%|人\d+番|ﾄ\b/.test(reason)) continue;
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].trim();
        if (isContinuationNoise(next, race)) break;
        if (!hasJapanese(next)) break;
        reason += next;
      }
      candidates.push({ horse, reason: reason.replace(/\s+/g, ' ').trim(), index: i });
    }

    for (let i = 0; i < candidates.length - 1; i++) {
      if (candidates[i + 1].index - candidates[i].index <= 4) {
        return [candidates[i], candidates[i + 1]];
      }
    }
    return [];
  }

  function applyEditorialRows(page, race) {
    if (!race) return race;
    const rows = collectAnchoredRows(page, race);
    if (rows.length < 2) {
      race.v10EditorialDetected = `not-found:${rows.length}`;
      return race;
    }

    for (const h of race.horses || []) {
      h.popularBlindSpot = false;
      h.popularBlindSpotReason = '';
      h.holeQualification = false;
      h.holeQualificationReason = '';
    }

    rows[0].horse.popularBlindSpot = true;
    rows[0].horse.popularBlindSpotReason = rows[0].reason;
    rows[1].horse.holeQualification = true;
    rows[1].horse.holeQualificationReason = rows[1].reason;
    race.v10EditorialDetected = `${rows[0].horse.number}->${rows[1].horse.number}`;
    return race;
  }

  if (typeof v3ParsePremiumRacePage === 'function') {
    const original = v3ParsePremiumRacePage;
    v3ParsePremiumRacePage = function(page) {
      return applyEditorialRows(page, original(page));
    };
  }

  window.MyKeibaQualityV10 = { collectAnchoredRows, applyEditorialRows };
})();
