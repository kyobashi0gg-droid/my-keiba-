const assert=require('node:assert/strict');
const fs=require('node:fs');
const data=JSON.parse(fs.readFileSync('race-reviews/2026-11-21.json','utf8'));
assert.equal(data.schema,'MYKEIBA_RACE_REVIEW_V1');
assert.equal(data.races.length,3);
assert.deepEqual(data.races.map(r=>r.track+r.race_no),['京都9','京都10','福島11']);
for(const r of data.races){
 assert.equal(r.date,'2026-11-21');
 assert.match(r.source,/^https:\/\/(?:www\.)?jra\.jp\/JRADB\/accessS\.html/);
 assert.ok(r.laps.every(v=>Number.isFinite(v)&&v>9&&v<20));
 assert.equal(r.laps.length*200,Number((r.course.match(/\d+/)||[])[0]));
 const decimalSum=a=>Math.round(a.reduce((x,y)=>x+y,0)*10)/10;
 assert.equal(decimalSum(r.laps.slice(-6,-3)),r.front3);
 assert.equal(decimalSum(r.laps.slice(-3)),r.back3);
 assert.equal(Math.round((r.front3-r.back3)*10)/10,r.real33);
 assert.equal(r.results.length,r.entered);
 assert.equal(r.results.filter(h=>typeof h.finish==='number').length,r.ran);
 assert.equal(r.results.filter(h=>typeof h.finish==='number')[0].finish,1);
 assert.equal(new Set(r.results.map(h=>h.number)).size,r.entered);
 for(const h of r.results){
   assert.ok(h.number>=1&&h.name);
   assert.ok(h.passing.length===0 || h.passing.length===(r.race_no===9&&r.track==='京都'?2:4));
 }
 assert.match(r.analysis.prediction,/未照合|確認できず/);
}
const [a,b,c]=data.races;
assert.equal(a.real33,2.2);
assert.equal(b.real33,2.3);
assert.equal(c.real33,2);
assert.equal(c.results.find(h=>h.number===14).finish,15);
assert.equal(c.results.find(h=>h.number===13).finish,1);
assert.equal(a.results.find(h=>h.number===4).finish,'除外');
console.log('PASS: JRA result rows, race identity, 33 calculations and no post-hoc prediction overwrite');
