/* Only downloads public rank data. Never uploads the user's saved races. */
(() => {
  'use strict';
  if (typeof state === 'undefined' || !window.MyKeibaSmartrcCore) return;
  const backupKey = 'my-keiba-smartrc-before-sync-v1';
  let busy = false, feed = null, timer;
  const box = document.createElement('section');
  box.style.cssText = 'margin:12px;padding:12px;border:1px solid #48796a;border-radius:12px;background:#10261f;color:#fff;font:14px/1.6 sans-serif';
  const title = document.createElement('strong'); title.textContent = 'テン・上がり・テンP配信';
  const status = document.createElement('p'); status.setAttribute('role','status'); status.textContent = '配信を確認しています…';
  const patternStatus = document.createElement('p');
  patternStatus.style.cssText = 'font-size:12px;color:#d8ece0;margin:4px 0 10px';
  patternStatus.textContent = 'テンP：配信データを確認中';
  const button = document.createElement('button'); button.textContent = '最新データを確認'; button.type = 'button';
  button.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid #648f80;background:#fff;color:#123b2b;min-height:44px';
  box.append(title,status,patternStatus,button);
  const host = document.querySelector('#v4App');
  if (host) host.insertBefore(box, host.children[1] || null); else document.body.append(box);
  function apply() {
    if (!feed || busy) return;
    // Do not re-render over an open race editor or an import dialog.
    if (document.querySelector('dialog[open]')) return;
    busy = true;
    try {
      const result = window.MyKeibaSmartrcCore.merge(state, feed);
      const reports = result.patternReports || [];
      if (reports.length) {
        const confirmed = reports.filter(x => x.checked);
        const known = confirmed.reduce((sum,x) => sum+x.present,0);
        const total = confirmed.reduce((sum,x) => sum+x.total,0);
        const pending = reports.filter(x=>!x.checked);
        patternStatus.textContent = 'テンP：'+known+'/'+total+'頭確認'+
          (total-known?'／表示未確認 '+(total-known)+'頭':'')+
          (pending.length?'／P列を確認できなかったレース '+pending.map(x=>x.track+x.raceNo+'R').join('・'):'');
      } else {
        patternStatus.textContent = 'テンP：現在の配信は旧形式（P列未取得）。新規・更新配信から反映します。';
      }
      if (result.changed) {
        const before = JSON.stringify(state);
        // Backup must succeed before replacing persistent data.
        localStorage.setItem(backupKey, before);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.state));
        state = result.state;
        if (typeof render === 'function') render();
        window.dispatchEvent(new CustomEvent('mykeiba:smartrc-synced', {detail:{changed:result.changed,patternReports:result.patternReports}}));
        status.textContent = '反映済み：' + result.labels.join(' ／ ');
      } else if (!feed.races.length) status.textContent = '配信待ちです。チャットで対象の日付・開催・Rを指定してください。';
      else status.textContent = `照合済み ${result.matched}レース／未一致 ${result.skipped}レース。未登録・日付や出走馬が異なるレースは変更しません。`;
    } catch (error) { status.textContent = '反映できませんでした：' + error.message; }
    finally { busy = false; }
  }
  async function refresh() {
    if (busy) return;
    busy = true; button.disabled = true;
    status.textContent = '最新の配信を確認しています…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('./smartrc-ranks-v1.json?check=' + Date.now(), {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw Error('通信エラー ' + response.status);
      const candidate = await response.json();
      window.MyKeibaSmartrcCore.validate(candidate);
      feed = candidate;
      busy = false; apply();
    } catch (_) { status.textContent = '配信を取得できませんでした。通信を確認して再試行してください。既存データは保持しています。'; }
    finally { clearTimeout(timeout); busy = false; button.disabled = false; }
  }
  button.onclick = refresh;
  // Reapply cached feed after PDF imports / race edits, without another request.
  const originalRender = render;
  render = function (...args) {
    const value = originalRender.apply(this,args);
    if (!busy) { clearTimeout(timer); timer = setTimeout(apply, 250); }
    return value;
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  window.MyKeibaSmartrcSync = {refresh};
  refresh();
})();
