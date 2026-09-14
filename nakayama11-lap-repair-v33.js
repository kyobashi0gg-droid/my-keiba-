// MY KEIBA LAB v33.1 - 中山11R ラップ君4項目の一度だけ修復
(() => {
  if (window.__MYKEIBA_NAKAYAMA11_LAP_REPAIR_V33__) return;
  window.__MYKEIBA_NAKAYAMA11_LAP_REPAIR_V33__ = true;
  const FLAG='mykeiba-v33-nakayama11-repaired';
  const SOURCE={1:{tenPast1f:'123',tenPrev1f:'132',tenRank:'1',agariRank:''},2:{tenPast1f:'',tenPrev1f:'',tenRank:'',agariRank:'4'},3:{tenPast1f:'125',tenPrev1f:'132',tenRank:'6',agariRank:'8'},4:{tenPast1f:'122',tenPrev1f:'122',tenRank:'2',agariRank:''},5:{tenPast1f:'125',tenPrev1f:'125',tenRank:'4',agariRank:'8'},6:{tenPast1f:'',tenPrev1f:'',tenRank:'',agariRank:'1'},7:{tenPast1f:'127',tenPrev1f:'131',tenRank:'2',agariRank:''},8:{tenPast1f:'',tenPrev1f:'',tenRank:'',agariRank:'1'},9:{tenPast1f:'',tenPrev1f:'130',tenRank:'8',agariRank:'7'},10:{tenPast1f:'',tenPrev1f:'',tenRank:'',agariRank:'5'},11:{tenPast1f:'126',tenPrev1f:'129',tenRank:'10',agariRank:''},12:{tenPast1f:'',tenPrev1f:'129',tenRank:'5',agariRank:'8'},13:{tenPast1f:'128',tenPrev1f:'129',tenRank:'10',agariRank:'3'},14:{tenPast1f:'124',tenPrev1f:'139',tenRank:'',agariRank:''},15:{tenPast1f:'',tenPrev1f:'131',tenRank:'9',agariRank:'6'},16:{tenPast1f:'126',tenPrev1f:'135',tenRank:'7',agariRank:''}};
  function repair(){
    try{if(localStorage.getItem(FLAG)==='1')return false;}catch{}
    const s=(typeof state!=='undefined'?state:window.state); const race=(s?.races||[]).find(r=>String(r.track||'').includes('中山')&&Number(r.raceNo)===11); if(!race)return false;
    let changed=false; for(const h of race.horses||[]){const src=SOURCE[Number(h.number)]; if(!src)continue; for(const k of ['tenPast1f','tenPrev1f','tenRank','agariRank']) if(String(h[k]??'')!==src[k]){h[k]=src[k];changed=true;}}
    try{if(changed&&typeof STORAGE_KEY!=='undefined')localStorage.setItem(STORAGE_KEY,JSON.stringify(s));localStorage.setItem(FLAG,'1');}catch{}
    if(changed) window.dispatchEvent(new CustomEvent('mykeiba:lapdata-repaired',{detail:{raceId:race.id}}));
    return changed;
  }
  window.MyKeibaNakayama11RepairV33={repair};
})();