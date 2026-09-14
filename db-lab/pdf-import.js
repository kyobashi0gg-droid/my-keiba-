(() => {
  const $ = id => document.getElementById(id);
  const venues = ['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'];
  const normText = v => String(v || '').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();

  function buildRows(items, tolerance=2.5){
    const rows=[];
    for(const item of items){
      let row=rows.find(r=>Math.abs(r.y-item.y)<tolerance);
      if(!row){row={y:item.y,items:[]};rows.push(row)}
      row.items.push(item);
    }
    rows.sort((a,b)=>a.y-b.y);
    rows.forEach(r=>r.items.sort((a,b)=>a.x-b.x));
    return rows;
  }

  async function extractPages(file){
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const data=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data}).promise;
    const pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo);
      const content=await page.getTextContent();
      const height=page.view?.[3]||842;
      const items=content.items.filter(i=>i.str?.trim()).map(i=>({text:normText(i.str),x:i.transform?.[4]??0,y:height-(i.transform?.[5]??0)}));
      const rows=buildRows(items);
      pages.push({pageNo,items,rows,text:rows.map(r=>r.items.map(i=>i.text).join(' ')).join('\n')});
    }
    return pages;
  }

  function inBox(page,x1,x2,y1,y2,p=()=>true){return page.items.filter(i=>i.x>=x1&&i.x<=x2&&i.y>=y1&&i.y<=y2&&p(i.text))}
  function nearest(items,targetY){return [...items].sort((a,b)=>Math.abs(a.y-targetY)-Math.abs(b.y-targetY))[0]}

  function parseRace(page){
    const trackItem=inBox(page,15,70,70,108,t=>venues.includes(t))[0];
    const raceNoItem=inBox(page,62,105,70,108,t=>/^\d{1,2}$/.test(t))[0];
    if(!trackItem||!raceNoItem)return null;

    const anchors=inBox(page,18,31,140,790,t=>/^(?:[1-9]|1[0-8])$/.test(t)).map(anchor=>{
      const nameItem=nearest(inBox(page,64,116,anchor.y-2.3,anchor.y+2.3,t=>/[ァ-ヶーA-Za-z]/.test(t)),anchor.y);
      return nameItem?{anchor,nameItem}:null;
    }).filter(Boolean);
    if(anchors.length<2)return null;

    const raceNameItem=nearest(inBox(page,60,175,48,78,t=>!/^\d{1,2}\/\d{1,2}/.test(t)&&!venues.includes(t)),58);
    const avg33=page.text.match(/([+-]?\d+(?:\.\d+)?)\s*\(平均33ラップ\)/)?.[1]||'';
    const course=page.text.match(/\b(芝|ダ)\s*(\d{3,4})\b/);
    const surface=course?.[1]==='ダ'?'ダート':(course?.[1]||'');
    const distance=course?.[2]||'';
    const horses=anchors.map(x=>({number:Number(x.anchor.text),name:x.nameItem.text})).sort((a,b)=>a.number-b.number);
    return {pageNo:page.pageNo,track:trackItem.text,raceNo:raceNoItem.text,raceName:raceNameItem?.text||'新聞取込レース',surface,distance,avg33,horses};
  }

  let races=[];
  function label(r){return `${r.track} ${r.raceNo}R ${r.raceName} / ${r.surface}${r.distance} / 平均33 ${r.avg33!==''?(Number(r.avg33)>=0?'+':'')+Math.abs(Number(r.avg33)):'—'}`}
  function applyRace(r){
    if(!r)return;
    $('track').value=r.track||'';
    $('raceNo').value=r.raceNo||'';
    $('raceName').value=r.raceName||'';
    if(r.surface)$('surface').value=r.surface;
    $('distance').value=r.distance||'';
    const avg = Number(r.avg33);
    $('avg33').value = Number.isFinite(avg) ? String(avg) : '';
    $('avg33').dispatchEvent(new Event('input',{bubbles:true}));
    $('avg33').dispatchEvent(new Event('change',{bubbles:true}));
    $('horses').value=(r.horses||[]).map(h=>h.name).join('\n');
    $('pdfStatus').textContent=`${label(r)} を入力しました。馬場状態だけ当日の状態を選んでください。`;
    window.MyKeibaDbLabPdfRace={...r,avg33:Number.isFinite(avg)?String(avg):''};
  }

  async function importPdf(file){
    const status=$('pdfStatus');
    status.textContent='新聞PDFを解析しています…';
    try{
      const pages=await extractPages(file);
      races=pages.map(parseRace).filter(Boolean).sort((a,b)=>a.pageNo-b.pageNo);
      if(!races.length){status.textContent='レースページを認識できませんでした。';return}
      const sel=$('pdfRaceSelect');
      sel.innerHTML=races.map((r,i)=>`<option value="${i}">${label(r)}</option>`).join('');
      $('pdfRaceRow').hidden=false;
      applyRace(races[0]);
      status.textContent=`${races.length}レースを認識しました。レースを選ぶと条件と出走馬を自動入力します。`;
    }catch(err){console.error(err);status.textContent='PDF解析に失敗しました。もう一度読み込んでください。'}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('pdfInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importPdf(f)});
    $('applyPdfRace')?.addEventListener('click',()=>applyRace(races[Number($('pdfRaceSelect').value)||0]));
    $('pdfRaceSelect')?.addEventListener('change',()=>applyRace(races[Number($('pdfRaceSelect').value)||0]));
  });
})();