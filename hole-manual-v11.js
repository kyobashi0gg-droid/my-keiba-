// MY KEIBA LAB v11 - 穴馬の資格 手動補正（保険機能）
(() => {
  if (typeof state === 'undefined') return;

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function applyOverride(horse) {
    const mode = horse?.holeQualificationOverride || '';
    if (mode === 'on') {
      horse.holeQualification = true;
      const note = String(horse.holeQualificationManualReason || '').trim();
      horse.holeQualificationReason = `【手動補正】${note || 'ユーザー指定'}`;
    } else if (mode === 'off') {
      horse.holeQualification = false;
      horse.holeQualificationReason = '';
    } else if (horse && Object.prototype.hasOwnProperty.call(horse, 'holeQualificationAuto')) {
      horse.holeQualification = Boolean(horse.holeQualificationAuto);
      horse.holeQualificationReason = horse.holeQualificationAutoReason || '';
    }
    return horse;
  }

  // Existing data: remember the latest automatic judgment before any manual correction.
  let migrated = false;
  for (const race of state.races || []) {
    for (const horse of race.horses || []) {
      if (!Object.prototype.hasOwnProperty.call(horse, 'holeQualificationAuto')) {
        horse.holeQualificationAuto = Boolean(horse.holeQualification);
        horse.holeQualificationAutoReason = horse.holeQualificationReason || '';
        migrated = true;
      }
      applyOverride(horse);
    }
  }
  if (migrated) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  // Re-import insurance: keep manual correction while refreshing the automatic PDF judgment behind it.
  if (typeof v3MergeHorse === 'function') {
    const originalMerge = v3MergeHorse;
    v3MergeHorse = function(existing, incoming) {
      const incomingAuto = Boolean(incoming?.holeQualification);
      const incomingAutoReason = incoming?.holeQualificationReason || '';
      const merged = originalMerge(existing, incoming);

      merged.holeQualificationAuto = incomingAuto;
      merged.holeQualificationAutoReason = incomingAutoReason;
      merged.holeQualificationOverride = existing?.holeQualificationOverride || '';
      merged.holeQualificationManualReason = existing?.holeQualificationManualReason || '';
      return applyOverride(merged);
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #v11HoleManual{border-color:#e5b728;background:#fff8db;color:#7a5700}
    #v11HoleManual.v11-active{background:#ffe38a;color:#5e4300;border-color:#d6a600}
    .v11-hole-dialog{border:0;padding:0;width:min(520px,calc(100% - 24px));border-radius:22px;background:#fff;color:#16211c;box-shadow:0 22px 60px rgba(0,0,0,.28)}
    .v11-hole-dialog::backdrop{background:rgba(0,0,0,.55)}
    .v11-hole-sheet{padding:20px}.v11-hole-sheet h3{margin:3px 0 5px;font-size:21px}.v11-hole-sheet p{margin:0 0 16px;color:#637068;font-size:12px;line-height:1.55}
    .v11-hole-sheet label{display:block;font-size:12px;font-weight:800;margin:12px 0 6px}
    .v11-hole-sheet select,.v11-hole-sheet textarea{width:100%;box-sizing:border-box;border:1px solid #d9e0dc;border-radius:13px;padding:12px;background:#fff;font:inherit;color:#16211c}
    .v11-hole-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.v11-hole-actions button{border:0;border-radius:13px;padding:12px;font-weight:900}.v11-hole-cancel{background:#eef2ef;color:#334139}.v11-hole-save{background:#16784b;color:#fff}
    .v11-hole-note{margin-top:10px;padding:9px 10px;border-radius:11px;background:#fff8db;color:#715400;font-size:11px;line-height:1.5}
  `;
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'v11-hole-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="v11-hole-sheet">
      <small>MANUAL INSURANCE</small>
      <h3>穴馬の資格を手動補正</h3>
      <p>PDFの自動読み取りが外れた時だけ使う保険機能です。再度PDFを読み込んでも手動指定を優先します。</p>
      <label for="v11HoleSelect">補正内容</label>
      <select id="v11HoleSelect"></select>
      <label for="v11HoleReason">理由メモ（任意）</label>
      <textarea id="v11HoleReason" rows="3" placeholder="例：新聞では右欄の穴馬の資格に記載"></textarea>
      <div class="v11-hole-note">「自動判定に戻す」を選ぶと、保存してあるPDF自動判定へ戻ります。</div>
      <div class="v11-hole-actions"><button type="button" class="v11-hole-cancel">キャンセル</button><button type="button" class="v11-hole-save">保存</button></div>
    </form>`;
  document.body.appendChild(dialog);

  function raceFromDetail() {
    const first = document.querySelector('#v4DetailBody [data-v4-expand]');
    if (!first) return null;
    const horseId = first.dataset.v4Expand;
    return state.races.find(r => (r.horses || []).some(h => h.id === horseId)) || null;
  }

  function currentMode(race) {
    const horses = race?.horses || [];
    const forced = horses.find(h => h.holeQualificationOverride === 'on');
    if (forced) return forced.id;
    if (horses.length && horses.every(h => h.holeQualificationOverride === 'off')) return '__none__';
    return '__auto__';
  }

  function openEditor(race) {
    const select = dialog.querySelector('#v11HoleSelect');
    const reason = dialog.querySelector('#v11HoleReason');
    const horses = [...(race.horses || [])].sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
    select.innerHTML = [
      '<option value="__auto__">PDF自動判定に戻す</option>',
      '<option value="__none__">該当なし（手動）</option>',
      ...horses.map(h => `<option value="${esc(h.id)}">${esc(h.number || '—')}番 ${esc(h.name)}</option>`)
    ].join('');
    select.value = currentMode(race);
    const selected = horses.find(h => h.holeQualificationOverride === 'on');
    reason.value = selected?.holeQualificationManualReason || '';
    dialog.dataset.raceId = race.id;
    dialog.showModal();
  }

  dialog.querySelector('.v11-hole-cancel').addEventListener('click', () => dialog.close());
  dialog.querySelector('.v11-hole-save').addEventListener('click', () => {
    const race = state.races.find(r => r.id === dialog.dataset.raceId);
    if (!race) return dialog.close();
    const value = dialog.querySelector('#v11HoleSelect').value;
    const memo = dialog.querySelector('#v11HoleReason').value.trim();

    for (const horse of race.horses || []) {
      if (value === '__auto__') {
        horse.holeQualificationOverride = '';
        horse.holeQualificationManualReason = '';
      } else if (value === '__none__') {
        horse.holeQualificationOverride = 'off';
        horse.holeQualificationManualReason = '';
      } else {
        horse.holeQualificationOverride = horse.id === value ? 'on' : 'off';
        horse.holeQualificationManualReason = horse.id === value ? memo : '';
      }
      applyOverride(horse);
    }

    dialog.close();
    if (typeof saveState === 'function') saveState();
    else {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
      if (typeof render === 'function') render();
    }
  });

  function decorate() {
    const body = document.querySelector('#v4DetailBody');
    const bar = body?.querySelector('.v4-edit-bar');
    if (!body || !bar) return;
    const race = raceFromDetail();
    if (!race) return;

    let btn = body.querySelector('#v11HoleManual');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'v11HoleManual';
      btn.className = 'v4-secondary';
      bar.insertBefore(btn, bar.firstChild);
    }
    const active = currentMode(race) !== '__auto__';
    btn.classList.toggle('v11-active', active);
    btn.textContent = active ? '穴資格 手動補正中' : '穴資格 手動補正';
    btn.onclick = () => openEditor(race);
  }

  decorate();
  const observer = new MutationObserver(() => setTimeout(decorate, 0));
  observer.observe(document.body, { childList: true, subtree: true });

  window.MyKeibaHoleManual = { applyOverride };
})();
