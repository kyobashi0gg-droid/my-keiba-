// MY KEIBA DB LAB - newest-first horse list + name confirmation + duplicate/update badges
(() => {
  if (window.__MYKEIBA_DB_LAB_HORSE_MANAGE__) return;
  window.__MYKEIBA_DB_LAB_HORSE_MANAGE__ = true;

  const DB_NAME='my-keiba-horse-db-v1', DB_VERSION=1, HORSES='horses';
  const AUDIT_KEY='my-keiba-db-import-audit-v1';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/[\s　・･]/g,'').trim();
  const WRONG_RE=/(競走馬データベース|データベース|Facebook|Twitter|Threads|Line|共有|ログイン|トップページ|検索)/i;
  let limit=30;

  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const reqP=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
  const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const pending=h=>Boolean(h?.nameReviewNeeded)||(!h?.nameCorrectedAt&&(!String(h?.name||'').trim()||WRONG_RE.test(String(h?.name||''))));
  const readAudit=()=>{try{return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]')}catch{return[]}};

  async function listHorses(){
    const db=await openDb();
    try{return await reqP(db.transaction(HORSES,'readonly').objectStore(HORSES).getAll())}
    finally{db.close()}
  }

  function duplicateMap(horses){
    const byName=new Map(),byReg=new Map(),out=new Map();
    for(const h of horses){
      const nk=norm(h.nameKey||h.name),reg=String(h.registrationNo||'').trim();
      if(nk){if(!byName.has(nk))byName.set(nk,[]);byName.get(nk).push(h)}
      if(reg){if(!byReg.has(reg))byReg.set(reg,[]);byReg.get(reg).push(h)}
    }
    for(const list of byName.values())if(list.length>1)list.forEach(h=>out.set(h.key,[...(out.get(h.key)||[]),'同名']));
    for(const list of byReg.values())if(list.length>1)list.forEach(h=>out.set(h.key,[...(out.get(h.key)||[]),'同一登録番号']));
    return out;
  }

  function sortNewest(a,b){
    const ap=pending(a)?1:0,bp=pending(b)?1:0;
    if(ap!==bp)return bp-ap;
    const at=Date.parse(a?.lastImportedAt||'')||0,bt=Date.parse(b?.lastImportedAt||'')||0;
    if(at!==bt)return bt-at;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ja');
  }

  async function saveHorse(key,newName,confirmOnly=false){
    const name=String(newName||'').trim();
    if(!name)throw new Error('馬名を入力してください');
    const db=await openDb();
    try{
      const tx=db.transaction(HORSES,'readwrite');
      const store=tx.objectStore(HORSES);
      const horse=await reqP(store.get(key));
      if(!horse)throw new Error('登録馬が見つかりません');
      if(!confirmOnly||norm(name)!==norm(horse.name)){
        horse.name=name;
        horse.nameKey=norm(name);
        horse.nameCorrectedAt=new Date().toISOString();
      }
      horse.nameReviewNeeded=false;
      horse.nameConfirmedAt=new Date().toISOString();
      store.put(horse);
      await txDone(tx);
      return horse;
    } finally {db.close()}
  }

  function auditBadge(a){
    if(!a)return'';
    if(a.nameMismatch)return'<span class="manage-badge warn">馬名差異・既存名保持</span>';
    if(a.kind==='new')return'<span class="manage-badge new">新規</span>';
    if(a.kind==='update')return`<span class="manage-badge update">更新 +${Number(a.addedRuns)||0}走</span>`;
    if(a.kind==='same')return'<span class="manage-badge same">既存走のみ</span>';
    return'';
  }

  function cardHtml(h,dup,audit){
    const isPending=pending(h);
    const imported=h?.lastImportedAt?new Date(h.lastImportedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'登録日不明';
    const duplicate=dup.get(h.key)||[];
    const confirmText=isPending?'名前OK':'確認済み';
    const latest=h.latestRunDate?`最新走 ${esc(h.latestRunDate)}`:'最新走 不明';
    const auditLine=audit?`${audit.beforeRuns??0}走 → ${audit.afterRuns??0}走${audit.addedRuns?`（+${audit.addedRuns}）`:''}`:'';
    return `<div class="recent-horse${isPending?' pending':''}${duplicate.length?' duplicate':''}" data-horse-key="${esc(h.key)}">
      <div class="recent-meta"><div class="manage-badges">${isPending?'<span class="recent-badge">馬名確認</span>':''}${auditBadge(audit)}${duplicate.length?`<span class="manage-badge dup">重複候補:${esc(duplicate.join('/'))}</span>`:''}</div><small>${esc(imported)}</small></div>
      <div class="recent-edit"><input data-name-input value="${isPending&&WRONG_RE.test(String(h.name||''))?'':esc(h.name||'')}" placeholder="正しい馬名を入力"><div class="name-actions"><button type="button" class="secondary" data-confirm-name ${isPending?'':'disabled'}>${confirmText}</button><button type="button" class="secondary" data-save-name>名前変更</button></div></div>
      <div class="manage-foot"><small>${h.registrationNo?`血統登録番号 ${esc(h.registrationNo)}`:'血統登録番号 未取得'}</small><small>${latest}${auditLine?` / ${esc(auditLine)}`:''}</small></div>
    </div>`;
  }

  async function render(reset=false){
    if(reset)limit=30;
    const list=$('horseRecentList'),countEl=$('horseManageCount'),more=$('horseShowMore'),status=$('horseManageStatus');
    if(!list||!countEl)return;
    let horses=[];
    try{horses=(await listHorses()).sort(sortNewest)}catch{list.innerHTML='<div class="empty-recent">登録馬一覧を読み込めませんでした。</div>';return}
    const dups=duplicateMap(horses);
    const audits=new Map(readAudit().map(x=>[x.key,x]));
    countEl.textContent=`${horses.length}頭`;
    const shown=horses.slice(0,limit);
    list.innerHTML=shown.length?shown.map(h=>cardHtml(h,dups,audits.get(h.key))).join(''):'<div class="empty-recent">まだ登録馬がありません。</div>';
    if(more){more.hidden=horses.length<=limit;more.textContent=`さらに表示（残り${Math.max(0,horses.length-limit)}頭）`;}
    const need=horses.filter(pending).length,dupCount=dups.size;
    if(status)status.textContent=`馬名確認待ち ${need}頭${dupCount?` / 重複候補 ${dupCount}頭`:''}`;
  }

  async function saveFromCard(card,confirmOnly=false){
    const input=card?.querySelector('[data-name-input]');
    const status=$('horseManageStatus');
    if(!card||!input)return;
    try{
      const saved=await saveHorse(card.dataset.horseKey,input.value,confirmOnly);
      if(status)status.textContent=confirmOnly?`「${saved.name}」の馬名を確認済みにしました。`:`「${saved.name}」に変更しました。`;
      await render(false);
      window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
    }catch(e){if(status)status.textContent=e?.message||'馬名を保存できませんでした。'}
  }

  function install(){
    $('horseRecentList')?.addEventListener('click',e=>{
      const confirm=e.target.closest?.('[data-confirm-name]');
      if(confirm&&!confirm.disabled){saveFromCard(confirm.closest('.recent-horse'),true);return;}
      const save=e.target.closest?.('[data-save-name]');
      if(save)saveFromCard(save.closest('.recent-horse'),false);
    });
    $('horseShowMore')?.addEventListener('click',()=>{limit+=30;render(false)});
    render(true);
  }

  const style=document.createElement('style');
  style.textContent=`
    .manage-badges{display:flex;gap:5px;flex-wrap:wrap}.manage-badge{display:inline-flex;padding:3px 6px;border-radius:999px;font-size:9px;font-weight:900}.manage-badge.new{background:#dff4e7;color:#17613a}.manage-badge.update{background:#e8f0ff;color:#325a93}.manage-badge.same{background:#edf1ef;color:#66746c}.manage-badge.warn,.manage-badge.dup{background:#ffe8d9;color:#984d1f}.recent-horse.duplicate{border-color:#e9b48d}.name-actions{display:flex;gap:6px}.name-actions button{white-space:nowrap}.name-actions button:disabled{opacity:.45}.manage-foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.manage-foot small{color:#77867e;font-size:9px}
    @media(max-width:560px){.name-actions{display:grid;grid-template-columns:1fr 1fr}.name-actions button{width:100%}}
  `;
  document.head.appendChild(style);

  window.addEventListener('mykeiba:horse-db-updated',()=>render(true));
  window.addEventListener('mykeiba:horse-db-audited',()=>render(true));
  window.addEventListener('pageshow',()=>render(false),{passive:true});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.MyKeibaDbLabHorseManage={render,saveHorse,listHorses,duplicateMap};
})();
