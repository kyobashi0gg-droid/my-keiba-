/* Pure matching/merge logic. No network, storage, or private-data export. */
(function (root) {
  'use strict';
  const fields = ['tenPast1f', 'tenPrev1f', 'tenRank', 'agariRank'];
  const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s　]/g, '');
  const key = h => `${Number(h.number)}:${norm(h.name)}`;
  function iso(v) {
    const m = norm(v).match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|$|[（(])/);
    if (!m) return '';
    const s = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return new Date(s).toISOString().slice(0,10) === s ? s : '';
  }
  function dateMatches(race, packet, now) {
    const labels = [race.date, race.v3DateLabel].filter(Boolean);
    const full = labels.map(iso).filter(Boolean);
    if (full.length) return full.every(d => d === packet.date);
    // Legacy PDFs have month/day only. Require a recent date, weekday AND full roster.
    if (Math.abs(now - Date.parse(packet.date + 'T12:00:00+09:00')) > 30*86400000) return false;
    return labels.some(v => {
      const m = norm(v).match(/^(\d{1,2})\/(\d{1,2})[（(]([日月火水木金土])[）)]$/);
      const d = new Date(packet.date + 'T00:00:00Z');
      return m && +m[1] === d.getUTCMonth()+1 && +m[2] === d.getUTCDate() && m[3] === '日月火水木金土'[d.getUTCDay()];
    });
  }
  function validate(feed) {
    if (feed?.schema !== 'MYKEIBA_SMARTRC_SYNC_V1' || !Array.isArray(feed.races)) throw Error('配信形式を確認できません');
    const ids = new Set();
    for (const r of feed.races) {
      const id = `${r.date}:${r.track}:${r.raceNo}`;
      if (ids.has(id) || iso(r.date) !== r.date || !['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'].includes(r.track) || !Number.isInteger(r.raceNo) || r.raceNo<1 || r.raceNo>12 || !Number.isInteger(r.revision) || r.revision<1 || !Number.isFinite(Date.parse(r.observedAt)) || r.source !== 'https://www.smartrc.jp/v3/' || !Array.isArray(r.horses) || !r.horses.length || r.horses.length>18) throw Error('配信レースの形式が不正です');
      ids.add(id);
      const nums = new Set(), names = new Set();
      for (const h of r.horses) {
        if (!Number.isInteger(h.number) || h.number<1 || h.number>18 || !norm(h.name) || nums.has(h.number) || names.has(norm(h.name))) throw Error('配信の馬番・馬名が不正です');
        nums.add(h.number); names.add(norm(h.name));
        for (const f of fields) {
          if (h[f] == null || h[f] === '') continue;
          if (typeof h[f] !== 'number' || !Number.isFinite(h[f]) || (f.endsWith('Rank') ? !Number.isInteger(h[f]) || h[f]<1 || h[f]>18 : h[f]<8 || h[f]>30)) throw Error('配信の数値が不正です');
        }
      }
    }
  }
  function merge(input, feed, now = Date.now()) {
    validate(feed);
    const next = JSON.parse(JSON.stringify(input));
    const result = { state: next, changed: 0, matched: 0, skipped: 0, labels: [] };
    for (const packet of feed.races) {
      const roster = packet.horses.map(key).sort().join('|');
      const matches = (next.races || []).filter(r => norm(r.track) === packet.track && Number(r.raceNo) === packet.raceNo && dateMatches(r, packet, now) && Array.isArray(r.horses) && r.horses.map(key).sort().join('|') === roster);
      if (matches.length !== 1) { result.skipped++; continue; }
      result.matched++;
      const race = matches[0], id = `${packet.date}:${packet.track}:${packet.raceNo}`;
      let count = 0;
      for (const horse of race.horses) {
        const incoming = packet.horses.find(h => key(h) === key(horse));
        const previous = horse.smartrcSync;
        if (previous?.raceKey === id && previous.revision >= packet.revision) continue;
        const values = {};
        for (const f of fields) if (incoming[f] != null && incoming[f] !== '') values[f] = incoming[f];
        if (!Object.keys(values).length) continue;
        Object.assign(horse, values);
        horse.smartrcSync = { raceKey: id, revision: packet.revision, observedAt: packet.observedAt, source: packet.source, values };
        count++;
      }
      if (count) { result.changed += count; result.labels.push(`${packet.date} ${packet.track}${packet.raceNo}R ${count}頭`); }
    }
    return result;
  }
  const api = { merge, validate, dateMatches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MyKeibaSmartrcCore = api;
})(typeof window === 'undefined' ? globalThis : window);
