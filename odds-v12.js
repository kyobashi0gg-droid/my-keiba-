// MY KEIBA LAB v12 - 最新オッズ取込
// スクショをChatGPTで読み取り -> 反映データを貼付 -> 単勝オッズ/人気を更新。
(() => {
  if (typeof state === 'undefined') return;

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const normName = (v = '') => String(v).replace(/[\s　・･]/g, '').toLowerCase();
  const normTrack = (v = '') => String(v).replace(/競馬場/g, '').trim();
  const clean = (v = '') => String(v ?? '').trim();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    if (typeof render === 'function') render();
  }

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function findHorse(race, number, name) {
    const no = clean(number);
    const nm = normName(name);
    if (no && nm) {
      const both = (race.horses || []).find(h => clean(h.number) === no && normName(h.name) === nm);
      if (both) return both;
    }
    if (no) {
      const byNo = (race.horses || []).filter(h => clean(h.number) === no);
      if (byNo.length === 1) return byNo[0];
    }
    if (nm) return (race.horses || []).find(h => normName(h.name) === nm) || null;
    return null;
  }

  function parseJson(text) {
    const obj = JSON.parse(text);
    return {
      track: obj.track || obj.開催場 || '',
      raceNo: obj.raceNo || obj.R || obj.race || obj.レース番号 || '',
      horses: (obj.horses || obj.馬 || obj.data || []).map(h => ({
        number: h.number ?? h.馬番 ?? '',
        name: h.name ?? h.馬名 ?? '',
        odds: h.odds ?? h.単勝 ?? h.単勝オッズ ?? '',
        popularity: h.popularity ?? h.人気 ?? h.人気順 ?? ''
      }))
    };
  }

  function parseText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
    let track = '';
    let raceNo = '';
    const horses = [];

    for (const raw of lines) {
      if (/^MYKEIBA_ODDS/i.test(raw) || /^(?:馬番[|,\t]|#)/.test(raw)) continue;
      const header = raw.match(/^(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)\s*[,|\t ]\s*(\d{1,2})\s*R?/i);
      if (header) {
        track = header[1];
        raceNo = header[2];
        continue;
      }
      const sep = raw.includes('|') ? '|' : raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
      const parts = sep ? raw.split(sep).map(x => x.trim()) : raw.split(/\s+/);
      if (parts.length < 3 || !/^\d{1,2}$/.test(parts[0])) continue;
      horses.push({
        number: parts[0],
        name: parts[1],
        odds: parts[2],
        popularity: parts[3] || ''
      });
    }
    return { track, raceNo, horses };
  }

  function parseOdds(text) {
    const s = String(text || '').trim();
    if (!s) return null;
    if (/^[\[{]/.test(s)) {
      try { return parseJson(s); } catch {}
    }
    return parseText(s);
  }

  function validOdds(v) {
    const n = Number(String(v).replace(/倍/g, '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function validPop(v) {
    const n = Number(String(v).replace(/人気/g, '').trim());
    return Number.isInteger(n) && n >= 1 && n <= 18 ? n : null;
  }

  function applyOdds(text, race) {
    const data = parseOdds(text);
    if (!data || !data.horses?.length) return { ok: false, message: '反映できるオッズデータを認識できませんでした。' };
    if (!race) return { ok: false, message: '対象レースを開いた状態で取り込んでください。' };

    const t = normTrack(data.track);
    const rn = String(data.raceNo || '').replace(/R/ig, '').trim();
    if (!t || !rn) return { ok: false, message: '開催場とRが見つかりません。先頭に「中山 1R」のような行を入れてください。' };
    if (t !== normTrack(race.track) || rn !== String(race.raceNo)) {
      return { ok: false, message: `レースが一致しません。開いているのは ${race.track}${race.raceNo}R、貼付データは ${data.track}${data.raceNo}R です。` };
    }

    let matched = 0;
    let withPop = 0;
    const misses = [];
    const now = new Date().toISOString();

    for (const row of data.horses) {
      const horse = findHorse(race, row.number, row.name);
      if (!horse) {
        misses.push(`${row.number}番 ${row.name}`);
        continue;
      }
      const odds = validOdds(row.odds);
      if (odds == null) {
        misses.push(`${row.number}番 ${row.name}（オッズ不正）`);
        continue;
      }
      if (!horse.latestOddsImportedAt) {
        horse.oddsBeforeLatest = horse.odds ?? '';
        horse.popularityBeforeLatest = horse.popularity ?? '';
      }
      horse.odds = String(odds);
      const pop = validPop(row.popularity);
      if (pop != null) {
        horse.popularity = String(pop);
        withPop += 1;
      }
      horse.latestOddsImportedAt = now;
      matched += 1;
    }

    if (!matched) return { ok: false, message: `一致する馬に反映できませんでした。${misses.length ? `\n未一致: ${misses.slice(0,5).join(' / ')}` : ''}` };

    // 人気が入っていない場合でも、全頭のオッズが更新できた時だけ安全に人気順を再計算。
    if (withPop === 0 && matched === (race.horses || []).length) {
      const ranked = [...race.horses]
        .map(h => ({ h, o: validOdds(h.odds) }))
        .filter(x => x.o != null)
        .sort((a, b) => a.o - b.o || Number(a.h.number || 99) - Number(b.h.number || 99));
      ranked.forEach((x, i) => { x.h.popularity = String(i + 1); });
    }

    race.oddsUpdatedAt = now;
    race.oddsImportedCount = matched;
    persist();
    return {
      ok: true,
      message: `${race.track}${race.raceNo}Rの最新オッズを${matched}頭に反映しました。${withPop ? `人気順も${withPop}頭更新。` : matched === (race.horses || []).length ? '人気順はオッズから再計算しました。' : '人気順は貼付データに無い馬は据え置きです。'}${misses.length ? `\n未一致 ${misses.length}件: ${misses.slice(0,4).join(' / ')}` : ''}`
    };
  }

  // 最新オッズは、新聞PDFを再読込しても上書きしない。
  if (typeof v3MergeHorse === 'function') {
    const originalMerge = v3MergeHorse;
    v3MergeHorse = function(existing, incoming) {
      const merged = originalMerge(existing, incoming);
      if (existing?.latestOddsImportedAt) {
        merged.odds = existing.odds;
        merged.popularity = existing.popularity;
        merged.latestOddsImportedAt = existing.latestOddsImportedAt;
        merged.oddsBeforeLatest = existing.oddsBeforeLatest ?? '';
        merged.popularityBeforeLatest = existing.popularityBeforeLatest ?? '';
      }
      return merged;
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #v12OddsImport{border-color:#8bb7ff;background:#edf5ff;color:#1959a8}
    #v12OddsImport.v12-active{background:#dcecff;border-color:#6ca0ef;color:#164b8b}
    .v12-odds-dialog{border:0;padding:0;width:min(560px,calc(100% - 24px));border-radius:22px;background:#fff;color:#16211c;box-shadow:0 22px 60px rgba(0,0,0,.28)}
    .v12-odds-dialog::backdrop{background:rgba(0,0,0,.55)}
    .v12-sheet{padding:20px}.v12-sheet h3{margin:3px 0 5px;font-size:21px}.v12-sheet p{margin:0 0 14px;color:#637068;font-size:12px;line-height:1.6}
    .v12-sheet textarea{width:100%;box-sizing:border-box;border:1px solid #d9e0dc;border-radius:13px;padding:12px;background:#fff;font:inherit;color:#16211c;min-height:190px}
    .v12-format{margin-top:9px;padding:10px 11px;border-radius:11px;background:#eef6ff;color:#285a8d;font-size:11px;line-height:1.5}
    .v12-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.v12-actions button{border:0;border-radius:13px;padding:12px;font-weight:900}.v12-cancel{background:#eef2ef;color:#334139}.v12-apply{background:#1769c2;color:#fff}
    .v12-result{margin-top:10px;padding:10px;border-radius:11px;font-size:11px;white-space:pre-wrap}.v12-result.ok{background:#e9f8ef;color:#16653e}.v12-result.ng{background:#fff0ef;color:#9a2f28}
    .v12-stamp{font-size:10px;color:#537064;margin-left:8px;white-space:nowrap}
  `;
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'v12-odds-dialog';
  dialog.innerHTML = `
    <div class="v12-sheet">
      <small>LATEST ODDS IMPORT</small>
      <h3>最新オッズ取込</h3>
      <p>オッズ画面のスクショをこのチャットに送って、ラップ君が返した反映データを貼り付けます。開催場・Rを照合してから更新するので、別レースへの誤反映を防ぎます。</p>
      <textarea id="v12OddsText" placeholder="MYKEIBA_ODDS_V1\n中山 1R\n1|ゼラニウム|3.9|3\n2|ソラニワラエバ|3.5|1"></textarea>
      <div class="v12-format"><b>列順：</b> 馬番｜馬名｜単勝オッズ｜人気<br>人気は省略可能ですが、全頭分のオッズを入れた時だけ自動で人気順を再計算します。</div>
      <div class="v12-actions"><button type="button" class="v12-cancel">キャンセル</button><button type="button" class="v12-apply">反映する</button></div>
      <div id="v12Result" class="v12-result" hidden></div>
    </div>`;
  document.body.appendChild(dialog);

  let currentRaceId = '';

  function openDialog(race) {
    currentRaceId = race.id;
    const area = dialog.querySelector('#v12OddsText');
    const sampleRows = (race.horses || []).slice(0, 3).map(h => `${h.number || ''}|${h.name}|${h.odds || '—'}|${h.popularity || '—'}`).join('\n');
    area.value = `MYKEIBA_ODDS_V1\n${race.track} ${race.raceNo}R\n${sampleRows}`;
    const out = dialog.querySelector('#v12Result');
    out.hidden = true;
    dialog.showModal();
    setTimeout(() => area.focus(), 50);
  }

  dialog.querySelector('.v12-cancel').onclick = () => dialog.close();
  dialog.querySelector('.v12-apply').onclick = () => {
    const race = state.races.find(r => r.id === currentRaceId);
    const result = applyOdds(dialog.querySelector('#v12OddsText').value, race);
    const out = dialog.querySelector('#v12Result');
    out.hidden = false;
    out.className = `v12-result ${result.ok ? 'ok' : 'ng'}`;
    out.textContent = result.message;
    if (result.ok) setTimeout(() => dialog.close(), 1000);
  };

  function fmtStamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function decorate() {
    const body = document.querySelector('#v4DetailBody');
    const bar = body?.querySelector('.v4-edit-bar');
    if (!body || !bar) return;
    const race = raceFromDetail();
    if (!race) return;

    let btn = body.querySelector('#v12OddsImport');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'v12OddsImport';
      btn.className = 'v4-secondary';
      bar.insertBefore(btn, bar.firstChild);
    }
    const stamp = fmtStamp(race.oddsUpdatedAt);
    btn.classList.toggle('v12-active', Boolean(stamp));
    btn.innerHTML = stamp ? `最新オッズ取込 <span class="v12-stamp">更新 ${esc(stamp)}</span>` : '最新オッズ取込';
    btn.onclick = () => openDialog(race);
  }

  decorate();
  const observer = new MutationObserver(() => setTimeout(decorate, 0));
  observer.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaLatestOdds = { applyOdds, parseOdds };
})();
