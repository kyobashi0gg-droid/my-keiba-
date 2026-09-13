// MY KEIBA LAB v23 UI - 条件別33サマリー表示
// v29: body全体のMutationObserverを廃止し、レース操作時だけ更新。
(() => {
  if (window.__MYKEIBA_HORSE_DB_CONDITION_UI_V23__) return;
  window.__MYKEIBA_HORSE_DB_CONDITION_UI_V23__ = true;

  const norm = v => window.MyKeibaDataV16?.normalizeHorseName ? window.MyKeibaDataV16.normalizeHorseName(v) : String(v || '').replace(/[\s　・･]/g, '').trim();
  function currentRace(){const first=document.querySelector('#v4DetailBody [data-v4-expand]');if(!first)return null;const id=first.dataset.v4Expand;const races=(typeof state!=='undefined'?state.races:window.state?.races)||[];return races.find(r=>(r.horses||[]).some(h=>h.id===id))||null;}
  function key(r,h){return `${r?.id||''}|${norm(h?.name)}`;}
  function fmtZone(s){if(s?.zoneMin==null||s?.zoneMax==null)return '—';return s.zoneMin===s.zoneMax?`${s.zoneMin}`:`${s.zoneMin}〜${s.zoneMax}`;}

  async function decorate(){
    const race=currentRace(), body=document.querySelector('#v4DetailBody'), cache=window.MyKeibaDbScoreConsultV22?.fitCache;
    if(!race||!body||!cache)return;
    const note=body.querySelector('.v20-race-db-note');
    if(note){
      [...note.querySelectorAll('.v20-race-db-row')].forEach(row=>{const b=row.querySelector('b'),span=row.querySelector('span');if(!b||!span)return;const name=b.textContent.replace(/^\s*\d+\s*/,'').trim();const horse=(race.horses||[]).find(h=>norm(h.name)===norm(name));const hit=horse?cache.get(key(race,horse)):null;if(!hit)return;const fit=span.querySelector('.v21-fit')?.outerHTML||'';span.innerHTML=`<span class="v23-basis">${hit.basis}</span>好走33帯 ${fmtZone(hit.summary)} / 好走${hit.summary?.goodCount??0}走 ${fit}`;});
      const p=note.querySelector('p');if(p)p.textContent='条件別優先: 芝/ダートを分離 → 距離帯（〜1400 / 1500〜2000 / 2100〜）→ データ不足時は同一馬場または全体へ補完。';
    }
    for(const horse of race.horses||[]){const hit=cache.get(key(race,horse));if(!hit)continue;const row=body.querySelector(`[data-v4-detail-row="${CSS.escape(horse.id)}"]`),box=row?.querySelector('.v21-horse-fit');if(!box)continue;let basis=box.querySelector('.v23-detail-basis');if(!basis){basis=document.createElement('small');basis.className='v23-detail-basis';box.appendChild(basis);}basis.textContent=`使用条件: ${hit.basis}`;}
  }

  const style=document.createElement('style');style.textContent='.v23-basis{display:block;color:#2e7650;font-weight:900;font-size:10px;margin-bottom:2px}.v23-detail-basis{display:block;margin-top:5px;color:#577264;font-size:10px}';document.head.appendChild(style);
  let timer=null;
  function schedule(delay=0){if(document.hidden)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;requestAnimationFrame(()=>decorate().catch(()=>{}));},delay);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-v4-race],.v4-race-card,[data-v4-expand]'))schedule(20);},true);
  window.addEventListener('mykeiba:horse-db-updated',()=>schedule(20));
  window.addEventListener('mykeiba:race-going-updated',()=>schedule(20));
  window.addEventListener('mykeiba:resume',()=>schedule(0),{passive:true});
  window.addEventListener('pageshow',()=>schedule(0),{passive:true});
  schedule(120);
})();
