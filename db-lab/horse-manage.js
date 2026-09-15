// MY KEIBA DB LAB - newest-first horse list + name correction
(() => {
  if (window.__MYKEIBA_DB_LAB_HORSE_MANAGE__) return;
  window.__MYKEIBA_DB_LAB_HORSE_MANAGE__ = true;

  const DB_NAME='my-keiba-horse-db-v1', DB_VERSION=1, HORSES='horses';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/[\s　・･]/g,'').trim();
  const WRONG_RE=/(競走馬データベース|データベース|Facebook|Twitter|Threads|Line|共有|ログイン|トップページ|検索)/i;
  let limit=30;

  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const reqP=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const pending=h=>!h?.nameCorrectedAt&&(!String(h?.name||'').trim()||WRONG_RE.test(String(h?.name||'')));

  async function listHorses(){
    const db=await openDb();
    try{return await reqP(db.transaction(HORSES,'readonly').objectStore(HORSES).getAll())}
    finally{db.close()}
  }

  function sortNewest(a,b){
    const ap=pending(a)?1:0,bp=pending(b)?1:0;
    if(ap!==bp)return bp-ap;
    const at=Date.parse(a?.lastImportedAt||'')||0,bt=Date.parse(b?.lastImportedAt||'')||0;
    if(at!==bt)return bt-at;
    return String(a?.name||'').localeCompare(String(b?.name||''),'ja');
  }

  async function renameHorse(key,newName){
    const name=String(newName||'').trim();
    if(!name)throw new Error('馬名を入力してください');
    const db=await openDb();
    try{
      const tx=db.transaction(HORSES,'readwrite');
      const store=tx.objectStore(HORSES);
      const horse=await reqP(store.get(key));
      if(!horse)throw new Error('登録馬が見つかりません');
      horse.name=name;
      horse.nameKey=norm(name);
      horse.nameCorrectedAt=new Date().toISOString();
      store.put(horse);
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
      return horse;
    } finally {db.close()}
  }

  function cardHtml(h){
    const isPending=pending(h);
    const imported=h?.lastImportedAt?new Date(h.lastImportedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'登録日不明';
    return `<div class="recent-horse${isPending?' pending':''}" data-horse-key="${esc(h.key)}">
      <div class="recent-meta"><div>${isPending?'<span class="recent-badge">馬名確認</span>':''}</div><small>${esc(imported)}</small></div>
      <div class="recent-edit"><input data-name-input value="${isPending?'':esc(h.name||'')}" placeholder="正しい馬名を入力"><button type="button" class="secondary" data-save-name>馬名を保存</button></div>
      <small style="color:#77867e;font-size:9px">${h.registrationNo?`血統登録番号 ${esc(h.registrationNo)}`:'血統登録番号 未取得'}</small>
    </div>`;
  }

  async function render(reset=false){
    if(reset)limit=30;
    const list=$('horseRecentList'),countEl=$('horseManageCount'),more=$('horseShowMore');
    if(!list||!countEl)return;
    let horses=[];
    try{horses=(await listHorses()).sort(sortNewest)}catch{list.innerHTML='<div class="empty-recent">登録馬一覧を読み込めませんでした。</div>';return}
    countEl.textContent=`${horses.length}頭`;
    const shown=horses.slice(0,limit);
    list.innerHTML=shown.length?shown.map(cardHtml).join(''):'<div class="empty-recent">まだ登録馬がありません。</div>';
    if(more){more.hidden=horses.length<=limit;more.textContent=`さらに表示（残り${Math.max(0,horses.length-limit)}頭）`;}
  }

  async function saveFromCard(card){
    const input=card?.querySelector('[data-name-input]');
    const status=$('horseManageStatus');
    if(!card||!input)return;
    try{
      const saved=await renameHorse(card.dataset.horseKey,input.value);
      if(status)status.textContent=`「${saved.name}」で保存しました。`;
      await render(false);
      window.dispatchEvent(new CustomEvent('mykeiba:horse-db-updated'));
    }catch(e){if(status)status.textContent=e?.message||'馬名を保存できませんでした。'}
  }

  function install(){
    $('horseRecentList')?.addEventListener('click',e=>{
      const btn=e.target.closest?.('[data-save-name]');
      if(btn)saveFromCard(btn.closest('.recent-horse'));
    });
    $('horseShowMore')?.addEventListener('click',()=>{limit+=30;render(false)});
    render(true);
  }

  window.addEventListener('mykeiba:horse-db-updated',()=>render(true));
  window.addEventListener('pageshow',()=>render(false),{passive:true});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.MyKeibaDbLabHorseManage={render,renameHorse,listHorses};
})();