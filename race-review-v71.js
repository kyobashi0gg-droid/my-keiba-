/* MY KEIBA LAB v71 — JRA official post-race review viewer, read-only.
 * No mutations to predictions, marks, DB33, or live race state.
 */
(()=>{
  'use strict';
  if(window.__MYKEIBA_REVIEW_V71__)return;
  window.__MYKEIBA_REVIEW_V71__=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･]/g,'').trim();
  const signed=n=>n==null?'—':(n>=0?'+':'')+Number(n).toFixed(1);
  let feed=null, loading=null;
  function races(){
    try{return (typeof state!=='undefined'?state.races:window.state?.races)||[];}
    catch{return window.state?.races||[];}
  }
  function currentRace(){
    const id=document.querySelector('#v4DetailBody [data-v4-expand]')?.dataset.v4Expand;
    return id?races().find(r=>(r.horses||[]).some(h=>String(h.id)===String(id))):null;
  }
  function dateMatch(r,date){
    const raw=String(r?.date||r?.v3DateLabel||'').normalize('NFKC');
    const [yy,mm,dd]=date.split('-').map(Number);
    if(/20\d{2}/.test(raw))return new RegExp(String(yy)+'\\D+0?'+mm+'\\D+0?'+dd+'(?:\\D|$)').test(raw);
    // Old paper labels only contain month/day. Restrict matching to the current year's meet.
    if(new Date().getFullYear()!==yy)return false;
    return new RegExp('(?:^|\\D)0?'+mm+'\\s*[/月]\\s*0?'+dd+'(?:日|\\D|$)').test(raw);
  }
  function select(r){
    return feed?.races?.find(x=>dateMatch(r,x.date)
      && norm(r.track)===norm(x.track) && Number(r.raceNo)===x.race_no)||null;
  }
  function results(rows){
    return rows.map(h=>'<tr><td>'+esc(h.finish)+'</td><td>'+esc(h.number)+' '+esc(h.name)+'</td><td>'+
      esc(h.passing.length?h.passing.join('-'):'—')+'</td><td>'+
      esc(h.final3f==null?'—':Number(h.final3f).toFixed(1))+'</td></tr>').join('');
  }
  function forecastHTML(x){
    const f=x.forecast;
    if(!f)return '<p class="v71-warning">事前MAIN/FAST/SLOW・A/B・PAIRの固定原文は未照合。今回のレースは予想採点保留。</p>';
    const horselist=(f.horses||[]).map(h=>
      '<div>'+esc(h.number)+' '+esc(h.name)+'（'+esc(h.tier)+' '+esc(h.role)+'）→'+esc(h.finish)+'着</div>').join('');
    const pairlist=(f.pairs||[]).map(p=>
      '<div><b>'+esc(p.kind)+' '+esc(p.scenario)+'</b>：'+esc(p.numbers[0])+' '+esc(p.names[0])+
      '＋'+esc(p.numbers[1])+' '+esc(p.names[1])+'：'+esc(p.result)+'</div>').join('');
    return '<div class="v71-forecast"><b>11/20付の事前本線：'+signed(f.main_lo)+'〜'+signed(f.main_hi)+'</b>'+
      '<div>'+horselist+'</div><div>'+pairlist+'</div><p>'+esc(f.unknown)+'</p>'+
      '<small>ユーザー提供スクリーンショットで表示内容を確認。隠れている評価は採点しない。</small></div>';
  }
  function html(x){
    const a=x.analysis||{};
    const podium=x.results.filter(h=>typeof h.finish==='number').slice(0,3)
      .map(h=>h.finish+'着 '+h.number+' '+h.name).join('／');
    const format=n=>n==null?'対象外':Number(n).toFixed(1);
    return '<div class="v71-heading"><small>POST-RACE / VERIFIED JRA</small><strong>レース後回顧・33検証</strong></div>'+
      '<div class="v71-grid"><div><small>実33</small><b>'+(x.real33==null?'算定不可':signed(x.real33))+'</b></div>'+
      '<div><small>33前半3F</small><b>'+format(x.front3)+'</b></div>'+
      '<div><small>後半3F</small><b>'+format(x.back3)+'</b></div></div>'+
      '<p><b>確定上位：</b>'+esc(podium)+'</p>'+
      '<p><b>ラップ：</b>'+esc(x.laps.map(n=>Number(n).toFixed(1)).join(' - '))+'</p>'+
      '<details><summary>33形成と隊列の検証</summary>'+
      '<p><b>形成：</b>'+esc(a.formation)+'</p>'+
      '<p><b>位置取り：</b>'+esc(a.lead)+'</p>'+
      '<p><b>馬別：</b>'+esc(a.horses)+'</p>'+
      '<p><b>次回の改善：</b>'+esc(a.lesson)+'</p></details>'+
      '<details><summary>全馬結果・通過順</summary><div class="v71-overflow"><table><thead><tr><th>着順</th><th>馬番 馬名</th><th>通過順</th><th>上り</th></tr></thead><tbody>'+
      results(x.results)+'</tbody></table></div></details>'+
      '<details'+(x.forecast?' open':'')+'><summary>事前予想と結果の比較</summary>'+
      forecastHTML(x)+
      '<p>'+esc(a.prediction||'事前固定予想未照合')+'</p>'+
      (a.advance?'<p><b>事前DB：</b>'+esc(a.advance)+'</p>':'')+
      (a.conditional?'<p>'+esc(a.conditional)+'</p>':'')+'</details>'+
      (x.real33===null?'<p class="v71-warning">最初のハロンが150mで、標準の前半3Fと後半3Fを同距離比較できないため、33的中採点は対象外。</p>':'')+
      '<p class="v71-warning">事前保存結果は上書きしません。スクリーンショットで確認できる評価だけを採点。</p>'+
      '<a href="'+esc(x.source)+'" target="_blank" rel="noopener noreferrer">JRA公式の確定結果を確認 ↗</a>';
  }
  function decorate(){
    const r=currentRace(),host=document.querySelector('#v4DetailBody');
    if(!r||!host||!feed?.races)return;
    const x=select(r);
    const exists=host.querySelector('#v71RaceReview');
    if(!x){exists?.remove();return;}
    let node=exists;
    if(!node){
      node=document.createElement('section');node.id='v71RaceReview';node.className='v71-card';
      const base=host.querySelector('#v69TenPattern')||host.querySelector('#v42PaceSim');
      const table=host.querySelector('.v4-table-wrap')||host.querySelector('.v4-table');
      if(base)base.insertAdjacentElement('afterend',node);
      else if(table)table.insertAdjacentElement('beforebegin',node);
      else host.appendChild(node);
    }
    if(node.dataset.raceKey===x.date+'-'+x.track+x.race_no)return;
    node.innerHTML=html(x);
    node.dataset.raceKey=x.date+'-'+x.track+x.race_no;
  }
  function load(){
    if(loading)return loading;
    loading=fetch('./race-reviews/2026-11-21.json?v=20261121-5r',{cache:'no-cache'})
      .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
      .then(d=>{
        if(d?.schema!=='MYKEIBA_RACE_REVIEW_V1'||!Array.isArray(d.races))throw Error('review schema');
        feed=d;decorate();return d;
      }).catch(e=>{console.warn('review viewer',e);return null;});
    return loading;
  }
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(decorate,190);};
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.v4-race-card,[data-v4-race],[data-v4-expand],.v67-racepicker'))schedule();
  },true);
  for(const event of ['pageshow','mykeiba:modules-ready','mykeiba:resume','mykeiba:smartrc-synced']){
    window.addEventListener(event,()=>{load();schedule();});
  }
  const css=document.createElement('style');
  css.textContent='.v71-card{border:1px solid #bacfd0;border-radius:17px;background:#fff;margin:12px 0;padding:13px;color:#2f514d;font-size:11px;line-height:1.65}.v71-card p{margin:8px 0}.v71-heading small{display:block;color:#527c76;font-size:9px;letter-spacing:.11em}.v71-heading strong{display:block;font-size:15px;color:#204f48}.v71-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:11px 0}.v71-grid>div{padding:9px 7px;border-radius:10px;background:#eaf3f1}.v71-grid small{display:block;font-size:9px;color:#638179}.v71-grid b{font-size:17px;color:#1a5847}.v71-card details{border-top:1px solid #e3ecea;margin-top:9px;padding-top:8px}.v71-card summary{cursor:pointer;font-size:12px;font-weight:800;color:#285a50}.v71-overflow{overflow-x:auto;margin-top:9px}.v71-card table{border-collapse:collapse;min-width:350px;width:100%;font-size:10px}.v71-card th,.v71-card td{text-align:left;border-bottom:1px solid #e6eceb;padding:5px 3px;white-space:nowrap}.v71-card a{font-size:11px;color:#17634d;font-weight:800}.v71-warning{background:#f7f3eb;padding:9px;border-radius:8px;color:#765d2e}';
  css.textContent += '.v71-forecast{padding:8px;border-radius:10px;background:#ecf5f0;margin-top:7px}.v71-forecast>div{margin:7px 0}.v71-forecast small{display:block;color:#687d72;font-size:10px}.v71-forecast b{color:#245b42}';
  document.head.appendChild(css);
  window.MyKeibaRaceReviewV71={decorate,load};
  load();
  schedule();
})();