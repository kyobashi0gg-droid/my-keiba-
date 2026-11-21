const assert=require('node:assert/strict');
const fs=require('node:fs');
const data=JSON.parse(fs.readFileSync('race-reviews/2026-11-21.json','utf8'));
assert.equal(data.schema,'MYKEIBA_RACE_REVIEW_V1');
assert.equal(data.races.length,5);
assert.deepEqual(new Set(data.races.map(r=>r.track+r.race_no)),new Set(['京都9','福島10','京都10','京都11','福島11']));
for(const r of data.races){
 assert.equal(r.date,'2026-11-21');
 assert.match(r.source,/^https:\/\/(?:www\.|own\.)?jra(?:\.go)?\.jp\/JRADB\/accessS\.html/);
 assert.ok(r.laps.every(v=>Number.isFinite(v)&&v>6&&v<20));
 assert.equal((r.first_split_m??200)+200*(r.laps.length-1),Number((r.course.match(/\d+/)||[])[0]));
 const decimalSum=a=>Math.round(a.reduce((x,y)=>x+y,0)*10)/10;
 if(r.front3===null){
   assert.equal(r.real33,null);
   assert.equal(r.course,'ダ1150m');
   assert.equal(r.front_segment_m,550);
   assert.equal(decimalSum(r.laps.slice(0,3)),r.front_segment_sec);
 }else{
   assert.equal(decimalSum(r.laps.slice(-6,-3)),r.front3);
   assert.equal(Math.round((r.front3-r.back3)*10)/10,r.real33);
 }
 assert.equal(decimalSum(r.laps.slice(-3)),r.back3);
 assert.equal(r.results.length,r.entered);
 assert.equal(r.results.filter(h=>typeof h.finish==='number').length,r.ran);
 assert.equal(r.results.filter(h=>typeof h.finish==='number')[0].finish,1);
 assert.equal(new Set(r.results.map(h=>h.number)).size,r.entered);
 for(const h of r.results){
   assert.ok(h.number>=1&&h.name);
   assert.ok(h.passing.length===0 || h.passing.length===((r.race_no===9&&r.track==='京都')||(r.race_no===10&&r.track==='福島')?2:4));
 }
 assert.ok(r.analysis.prediction?.length>50);
 if(r.forecast) assert.equal(r.forecast.pairs.every(p=>r.results.some(h=>h.number===p.numbers[0])&&r.results.some(h=>h.number===p.numbers[1])),true);
}
const get=(track,n)=>data.races.find(r=>r.track===track&&r.race_no===n);
assert.equal(get('京都',9).real33,2.2);
assert.equal(get('京都',10).real33,2.3);
assert.equal(get('福島',11).real33,2);
assert.equal(get('京都',11).real33,1.8);
assert.equal(get('福島',10).real33,null);
assert.equal(get('福島',10).forecast.pairs[0].result.includes('成功'),true);
assert.equal(get('京都',11).forecast.pairs[0].result.includes('不成立'),true);
assert.equal(get('福島',11).results.find(h=>h.number===14).finish,15);
assert.equal(get('福島',11).results.find(h=>h.number===13).finish,1);
assert.equal(get('京都',9).results.find(h=>h.number===4).finish,'除外');
console.log('PASS: JRA result rows, race identity, 33 calculations and no post-hoc prediction overwrite');
