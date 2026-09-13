// MY KEIBA LAB v27 - 開催場ごとの芝/ダート馬場状態 一括設定
(() => {
  if (window.__MYKEIBA_VENUE_GOING_V27__) return;
  window.__MYKEIBA_VENUE_GOING_V27__ = true;

  const OPTIONS = ['未設定','良','稍重','重','不良'];
  const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function surfaceOfRace(race) {
    const s = `${race?.v3Course || ''} ${race?.course || ''} ${race?.surface || ''}`;
    if (/ダ|ﾀﾞ|dirt/i.test(s)) return 'ダート';
    if (/芝|turf/i.test(s)) return '芝';
    return '';
  }

  function tracks() {
    return [...new Set(((typeof state !== 'undefined' ? state.races : window.state?.races) || []).map(r => r.track).filter(Boolean))];
  }

  function currentGoing(track, surface) {
    const races = ((typeof state !== 'undefined' ? state.races : window.state?.races) || []).filter(r => r.track === track && surfaceOfRace(r) === surface);
    const vals = [...new Set(races.map(r => r.going).filter(v => v && v !== '未設定'))];
    return vals.length === 1 ? vals[0] : '未設定';
  }

  function ensureModal() {
    let modal = document.querySelector('#v27GoingModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v27GoingModal';
    modal.className = 'v27-modal';
    modal.hidden = true;
    modal.innerHTML = `<div class="v27-panel"><div class="v27-head"><div><p class="v4-eyebrow">TRACK CONDITION</p><h2>馬場状態 一括設定</h2></div><button type="button" class="v4-close" data-v27-close>閉じる</button></div><div id="v27Body"></div><div class="v27-actions"><button type="button" class="v4-primary" id="v27Apply">全レースへ反映</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-v27-close]').onclick = () => { modal.hidden = true; };
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
    modal.querySelector('#v27Apply').onclick = applyAll;
    return modal;
  }

  function selectHtml(track, surface, value) {
    return `<label><span>${surface}</span><select data-v27-track="${esc(track)}" data-v27-surface="${surface}">${OPTIONS.map(x => `<option value="${x}"${x===value?' selected':''}>${x}</option>`).join('')}</select></label>`;
  }

  function openModal() {
    const modal = ensureModal();
    const body = modal.querySelector('#v27Body');
    const ts = tracks();
    body.innerHTML = ts.length ? ts.map(track => `<section class="v27-track"><h3>${esc(track)}</h3><div class="v27-grid">${selectHtml(track,'芝',currentGoing(track,'芝'))}${selectHtml(track,'ダート',currentGoing(track,'ダート'))}</div></section>`).join('') : '<p class="v27-note">登録レースがありません。</p>';
    modal.hidden = false;
  }

  function applyAll() {
    const modal = ensureModal();
    const values = new Map();
    modal.querySelectorAll('select[data-v27-track]').forEach(sel => values.set(`${sel.dataset.v27Track}|${sel.dataset.v27Surface}`, sel.value));
    const races = (typeof state !== 'undefined' ? state.races : window.state?.races) || [];
    let changed = 0;
    for (const race of races) {
      const surface = surfaceOfRace(race);
      if (!surface) continue;
      const value = values.get(`${race.track}|${surface}`);
      if (!value || value === '未設定') continue;
      if (race.going !== value) { race.going = value; changed++; }
    }
    if (typeof saveState === 'function') saveState();
    else {
      try { localStorage.setItem('my-keiba-lab-v2', JSON.stringify(typeof state !== 'undefined' ? state : window.state)); } catch {}
    }
    window.dispatchEvent(new CustomEvent('mykeiba:race-going-updated', { detail: { changed } }));
    const btn = modal.querySelector('#v27Apply');
    if (btn) { const old = btn.textContent; btn.textContent = `${changed}レース反映`; setTimeout(() => { btn.textContent = old; modal.hidden = true; }, 650); }
  }

  function installButton() {
    if (document.querySelector('#v27GoingButton')) return;
    const grid = document.querySelector('.v4-action-grid');
    if (!grid) return;
    const btn = document.createElement('button');
    btn.id = 'v27GoingButton';
    btn.type = 'button';
    btn.className = 'v4-secondary v27-going-btn';
    btn.textContent = '馬場状態 一括設定';
    btn.onclick = openModal;
    grid.appendChild(btn);
  }

  const style = document.createElement('style');
  style.textContent = `
    #v27GoingButton{min-height:72px;border-color:#b8d8c7;background:#f0f8f3;color:#245d3d;font-weight:900;white-space:normal}
    .v27-modal{position:fixed;inset:0;z-index:1350;background:rgba(12,27,20,.48);display:flex;align-items:flex-end;justify-content:center;padding:12px}.v27-modal[hidden]{display:none}.v27-panel{width:min(680px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:22px 22px 14px 14px;padding:18px}.v27-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v27-head h2{margin:2px 0 12px;font-size:20px}.v27-track{padding:12px 0;border-top:1px solid #e8efea}.v27-track:first-child{border-top:0}.v27-track h3{margin:0 0 8px;font-size:16px;color:#274c39}.v27-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v27-grid label{display:grid;gap:5px}.v27-grid label span{font-size:11px;font-weight:900;color:#607168}.v27-grid select{width:100%;min-height:44px;border:1px solid #d6e2da;border-radius:12px;background:#fff;padding:0 10px;font-size:15px}.v27-actions{position:sticky;bottom:-18px;background:#fff;padding:12px 0 2px;margin-top:8px}.v27-actions button{width:100%;min-height:50px}.v27-note{font-size:12px;color:#6f7c74}
    @media(min-width:700px){.v27-modal{align-items:center}.v27-panel{border-radius:22px}}
  `;
  document.head.appendChild(style);

  installButton();
  window.addEventListener('pageshow', installButton, {passive:true});
  window.addEventListener('mykeiba:resume', installButton, {passive:true});
  const observer = new MutationObserver(installButton);
  observer.observe(document.body, {childList:true, subtree:true});

  window.MyKeibaVenueGoingV27 = { surfaceOfRace, openModal, applyAll };
})();
