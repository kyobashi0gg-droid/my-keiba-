/* MY KEIBA LAB v67: non-destructive race and horse switching inside the existing detail sheet. */
(() => {
  'use strict';
  const api = window.MyKeibaV4DetailNav;
  if (!api || !document.querySelector('#v4Detail')) return;

  const modal = document.querySelector('#v4Detail');
  let selectedHorseId = '';
  let mountedRaceId = '';
  let queued = false;

  function dateOf(r) { return String(r?.v3DateLabel || r?.date || '').trim(); }
  function venueOf(r) { return String(r?.track || '').replace(/競馬場/g, '').trim(); }
  function raceOrder(a,b) { return Number(a.raceNo || 99) - Number(b.raceNo || 99); }
  function races() { return (api.races() || []).filter(r => r && r.id != null); }
  function current() { return races().find(r => String(r.id) === String(api.currentRaceId())); }
  function sameDayVenue(r) {
    const all = races();
    return all.filter(x => dateOf(x) === dateOf(r) && venueOf(x) === venueOf(r)).sort(raceOrder);
  }
  function addOption(select, value, label, selected) {
    const option=document.createElement('option'); option.value=String(value);
    option.textContent=String(label);
    option.selected=String(value)===String(selected);
    select.appendChild(option);
  }
  function makeField(title, options, chosen, labelFor) {
    const wrap=document.createElement('label');wrap.className='v67-field';
    const name=document.createElement('span');name.textContent=title;wrap.append(name);
    const select=document.createElement('select');select.setAttribute('aria-label',title);
    for(const value of options) addOption(select,value,labelFor?labelFor(value):value,chosen);
    wrap.append(select);return {wrap,select};
  }
  function changeRace(race) {
    if (!race || String(race.id) === String(api.currentRaceId())) return;
    selectedHorseId = '';
    api.switchRace(race.id);
    const sheet=modal.querySelector('.v4-sheet');
    if(sheet) sheet.scrollTop=0;
    queueUpdate();
  }
  function chooseRace(day,venue,raceNo,raceId) {
    let candidates=races().filter(r=>dateOf(r)===day);
    if(!candidates.length)return;
    const byVenue=candidates.filter(r=>venueOf(r)===venue);
    if(byVenue.length)candidates=byVenue;
    const target=candidates.find(r=>String(r.id)===String(raceId)) ||
      candidates.find(r=>Number(r.raceNo)===Number(raceNo)) ||
      candidates.sort(raceOrder)[0];
    changeRace(target);
  }
  function makeRacePicker(r, body){
    const all=races();
    const day=dateOf(r), venue=venueOf(r);
    const sameDay=all.filter(x=>dateOf(x)===day);
    const dayOptions=[...new Set(all.map(dateOf))].sort().reverse();
    const venueOptions=[...new Set(sameDay.map(venueOf))].sort((a,b)=>a.localeCompare(b,'ja'));
    const inVenue=sameDayVenue(r);
    const nav=document.createElement('section');nav.className='v67-racepicker';
    nav.dataset.raceId=String(r.id);
    const heading=document.createElement('div');heading.className='v67-title';heading.textContent='レースを切り替える';nav.append(heading);
    const fields=document.createElement('div');fields.className='v67-fields';
    const d=makeField('開催日',dayOptions,day,x=>x||'日付未設定');
    const v=makeField('競馬場',venueOptions,venue);
    const raceMap=new Map(inVenue.map(x=>[String(x.id),x]));
    const n=makeField('レース',inVenue.map(x=>String(x.id)),String(r.id),id=>{
      const item=raceMap.get(id);return item?String(item.raceNo)+'R '+String(item.raceName||''):id;
    });
    fields.append(d.wrap,v.wrap,n.wrap);nav.append(fields);
    d.select.onchange=()=>chooseRace(d.select.value,venue,r.raceNo,null);
    v.select.onchange=()=>chooseRace(day,v.select.value,r.raceNo,null);
    n.select.onchange=()=>chooseRace(day,venue,null,n.select.value);
    const neighbors=document.createElement('div');neighbors.className='v67-neighbors';
    const index=inVenue.findIndex(x=>String(x.id)===String(r.id));
    for(const [label,delta] of [['‹ 前のレース',-1],['次のレース ›',1]]){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      const target=inVenue[index+delta];button.disabled=!target;
      button.onclick=()=>changeRace(target);neighbors.append(button);
    }
    nav.append(neighbors);
    body.prepend(nav);
  }
  function findDetailRow(horseId) {
    return [...modal.querySelectorAll('#v4DetailBody .v4-horse-detail-row')]
      .find(row=>String(row.dataset.v4DetailRow)===String(horseId));
  }
  function openHorse(horseId) {
    const race=current();if(!race)return;
    const horses=race.horses||[];
    if(!horses.some(h=>String(h.id)===String(horseId)))return;
    selectedHorseId=String(horseId);
    for(const row of modal.querySelectorAll('#v4DetailBody .v4-horse-detail-row'))row.hidden=true;
    const row=findDetailRow(horseId);
    if(row){row.hidden=false;row.scrollIntoView({behavior:'smooth',block:'center'});}
    const select=modal.querySelector('#v67-horse-select');if(select)select.value=String(horseId);
    const label=modal.querySelector('#v67-horse-pos');
    if(label)label.textContent=String(horses.findIndex(h=>String(h.id)===String(horseId))+1)+' / '+horses.length;
  }
  function stepHorse(delta){
    const race=current();const horses=race?.horses||[];if(!horses.length)return;
    const idx=horses.findIndex(h=>String(h.id)===String(selectedHorseId));
    const target= idx<0?(delta>0?0:horses.length-1):(idx+delta+horses.length)%horses.length;
    openHorse(horses[target].id);
  }
  function makeHorseBar(r){
    const prior=modal.querySelector('.v67-horsebar');if(prior)prior.remove();
    const bar=document.createElement('div');bar.className='v67-horsebar';bar.dataset.raceId=String(r.id);
    const prev=document.createElement('button');prev.type='button';prev.textContent='‹ 前の馬';prev.onclick=()=>stepHorse(-1);
    const select=document.createElement('select');select.id='v67-horse-select';select.setAttribute('aria-label','出走馬を切り替える');
    addOption(select,'','出走馬を選ぶ','');
    (r.horses||[]).forEach((h,i)=>addOption(select,String(h.id),String(h.number||i+1)+' '+String(h.name||'馬名未登録'),selectedHorseId));
    select.onchange=()=>{if(select.value)openHorse(select.value);};
    const next=document.createElement('button');next.type='button';next.textContent='次の馬 ›';next.onclick=()=>stepHorse(1);
    const count=document.createElement('span');count.id='v67-horse-pos';count.textContent=String((r.horses||[]).length)+'頭';
    bar.append(prev,select,next,count);modal.append(bar);
    if(selectedHorseId && (r.horses||[]).some(h=>String(h.id)===selectedHorseId)){
      select.value=selectedHorseId;
      count.textContent=String(r.horses.findIndex(h=>String(h.id)===selectedHorseId)+1)+' / '+r.horses.length;
    }
  }
  function install(){
    if(modal.hidden){selectedHorseId='';mountedRaceId='';return;}
    const race=current();const body=modal.querySelector('#v4DetailBody');
    if(!race||!body||!body.querySelector('.v4-table-wrap'))return;
    const id=String(race.id);
    if(mountedRaceId!==id){selectedHorseId='';mountedRaceId=id;}
    const picker=body.querySelector('.v67-racepicker');
    if(!picker||picker.dataset.raceId!==id){if(picker)picker.remove();makeRacePicker(race,body);}
    const bar=modal.querySelector('.v67-horsebar');
    if(!bar||bar.dataset.raceId!==id)makeHorseBar(race);
    else if(selectedHorseId){
      const selected=bar.querySelector('#v67-horse-select');
      if(selected && selected.value!==selectedHorseId)selected.value=selectedHorseId;
      const pos=bar.querySelector('#v67-horse-pos');
      const index=(race.horses||[]).findIndex(h=>String(h.id)===selectedHorseId);
      if(pos && index>=0)pos.textContent=String(index+1)+' / '+race.horses.length;
    }
  }
  function queueUpdate(){
    if(queued)return;queued=true;
    setTimeout(()=>{queued=false;install();},0);
  }
  // On opening, changing race or refreshing detail, a new table is rendered.
  const observer=new MutationObserver(()=>{if(!modal.hidden)queueUpdate();});
  observer.observe(modal,{subtree:true,childList:true});
  modal.addEventListener('click', e=>{
    const button=e.target.closest?.('[data-v4-expand]');
    if(button && !modal.hidden){selectedHorseId=String(button.dataset.v4Expand);queueUpdate();}
  },true);
  install();
})();