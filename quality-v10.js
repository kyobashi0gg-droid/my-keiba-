// MY KEIBA LAB v10 - robust newspaper editorial extraction
// PDF text order can differ from visual order. This pass finds the two plain-number
// editorial rows (popular horse blind spot / hole qualification) by matching
// horse number + abbreviated horse-name prefix + prose reason.
(() => {
  if (typeof state === 'undefined') return;

  const norm = (v = '') => String(v)
    .replace(/[\s　・･]/g, '')
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();

  const hasJapanese = s => /[ぁ-んァ-ヶ一-龯]/.test(String(s || ''));

  function namePrefixMatches(horseName, token) {
    const h = norm(horseName);
    const t = norm(token);
    if (!h || !t) return false;
    return h.startsWith(t) || t.startsWith(h);
  }

  function isStructuredNoise(line = '') {
    const s = String(line).trim();
    return !s ||
      /^#N\/A/.test(s) ||
      /^(?:全[芝ダ　]|\.?Ⓑ|\(\)|枠\b)/.test(s) ||
      /^人気馬の/.test(s) ||
      /^◎\s*\d/.test(s) ||
      /^\d{1,2}\s+[^\s]+\s+/.test(s);
  }

  function collectEditorialRows(page, race) {
    const lines = String(page?.text || '')
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);

    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      // Deliberately do NOT accept a leading ◎ here. Those rows belong to a
      // different editorial block in this PDF and caused the v9 misread.
      const m = lines[i].match(/^(\d{1,2})\s+([^\s]+)\s+(.{6,})$/);
      if (!m) continue;

      const horse = (race.horses || []).find(h => String(h.number || '') === m[1]);
      if (!horse || !namePrefixMatches(horse.name, m[2])) continue;

      let reason = m[3].trim();
      if (!hasJapanese(reason)) continue;
      if (/%|人\d+番|ﾄ\b|^[\d.()+\-]+$/.test(reason)) continue;

      // Pick up wrapped continuation lines, but stop at the next structured row.
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].trim();
        if (isStructuredNoise(next)) break;
        if ((race.horses || []).some(h => norm(h.name) === norm(next))) break;
        if (!hasJapanese(next)) break;
        reason += next;
      }

      rows.push({ horse, reason: reason.replace(/\s+/g, ' ').trim(), index: i });
    }

    // De-duplicate the same horse/reason if PDF.js emitted it twice.
    const seen = new Set();
    return rows.filter(row => {
      const key = `${row.horse.number}|${row.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function applyEditorialRows(page, race) {
    if (!race) return race;
    const rows = collectEditorialRows(page, race);
    if (rows.length < 2) return race;

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

  window.MyKeibaQualityV10 = { collectEditorialRows, applyEditorialRows };
})();
