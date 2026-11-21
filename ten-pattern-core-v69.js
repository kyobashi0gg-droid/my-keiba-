/* MY KEIBA LAB v69 — テンPを使う初動先行圧の試算（純粋関数）。
 * P15/P30/P50 は「近走のテン3F順位の距離別パターン」であり、実通過順ではない。
 * P未確認・P非該当(0)を区別し、取得率が低い場合は33を試算しない。
 */
(function(root){
  'use strict';
  const valid = new Set([0,15,30,50]);
  function pattern(v){
    if(v===null || v===undefined || v==='') return null;
    const n=typeof v==='number'?v:Number(v);
    return valid.has(n)?n:null;
  }
  function rankSignal(x,n){
    const rank=Number(x.tenRank ?? x.speedRank);
    if(!Number.isFinite(rank)||rank<1) return .4;
    if(rank<=2) return 1;
    if(rank<=Math.max(3,Math.ceil(n*.25))) return .8;
    if(rank<=Math.ceil(n*.45)) return .45;
    return .15;
  }
  function score(x,n){
    const p=pattern(x.h?.tenPattern);
    if(p===null) return null;
    const prior=({0:.1,15:.78,30:.60,50:.40})[p];
    let value=prior+.22*rankSignal(x,n);
    const back=['差し','追込'].includes(x.h?.style);
    if(back) value=Math.min(value,.45);
    return Math.round(value*100)/100;
  }
  function band(base,pressure){
    if(!Number.isFinite(base)||!['高','やや高','中','低'].includes(pressure)) return null;
    const m={'高':[-.8,-.3],'やや高':[-.5,-.1],'中':[-.3,.3],'低':[.2,.7]}[pressure];
    return {min:Math.round((base+m[0])*10)/10,max:Math.round((base+m[1])*10)/10};
  }
  function analyze(race,legacy){
    if(!race||!legacy||!Array.isArray(legacy.horses)) return null;
    const n=Math.max(1,(race.horses||[]).length);
    const horses=legacy.horses.map(x=>{
      const p=pattern(x.h?.tenPattern), s=score(x,n), back=['差し','追込'].includes(x.h?.style);
      let kind='P未確認';
      if(s!==null){
        if(back&&p!==0) kind='脚質メモと要照合';
        else if(s>=.72) kind='先行力上位';
        else if(s>=.48) kind='先行候補';
        else if(p===0&&rankSignal(x,n)>=.8) kind='テン速い・位置要確認';
        else kind='先行根拠弱め';
      }
      return {h:x.h,p,score:s,kind,legacyPosition:x.position,
        needsReview:back&&p!==null&&p!==0};
    });
    const known=horses.filter(x=>x.p!==null);
    const strong=known.filter(x=>x.score>=.72);
    const possible=known.filter(x=>x.score>=.48&&x.score<.72);
    const effective=strong.length+.5*possible.length;
    const coverage=known.length/n;
    const ready=coverage>=.6;
    let pressure='判定保留';
    if(ready){
      if(strong.length>=3&&effective>=3.5) pressure='高';
      else if(strong.length>=2&&effective>=2.5) pressure='やや高';
      else if(effective<1.5) pressure='低';
      else pressure='中';
    }
    const reference33=ready?band(legacy.base,pressure):null;
    return {horses,coverage,knownCount:known.length,total:n,
      p15:known.filter(x=>x.p===15).length,
      p30:known.filter(x=>x.p===30).length,
      p50:known.filter(x=>x.p===50).length,
      none:known.filter(x=>x.p===0).length,
      strong,possible,effective,ready,pressure,
      reference33,legacyPressure:legacy.pressure,
      legacyMain:legacy.mainRange,base:legacy.base};
  }
  const api={pattern,score,band,analyze};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.MyKeibaTenPatternCoreV69=api;
})(typeof window==='undefined'?globalThis:window);
