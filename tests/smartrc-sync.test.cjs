const assert = require('node:assert/strict');
const {merge} = require('../smartrc-sync-core-v1.js');
const now = Date.parse('2026-10-29T00:00:00Z');
const packet = {date:'2026-10-25',track:'新潟',raceNo:1,revision:1,source:'https://www.smartrc.jp/v3/',observedAt:'2026-10-29T00:00:00Z',horses:[{number:1,name:'テスト馬',tenRank:2,agariRank:1,tenPast1f:12.4},{number:2,name:'テスト二',tenRank:null,agariRank:3}]};
const feed = {schema:'MYKEIBA_SMARTRC_SYNC_V1',races:[packet]};
const input = {races:[{id:'keep',v3DateLabel:'10/25(日)',track:'新潟',raceNo:'1',horses:[{id:'a',number:1,name:'テスト馬',userMark:'◎',trainingScore:66,tenRank:8},{id:'b',number:2,name:'テスト二',tenRank:4}]}]};
let r = merge(input,feed,now);
assert.equal(r.changed,2); assert.equal(r.state.races[0].horses[0].tenRank,2);
assert.equal(input.races[0].horses[0].tenRank,8); // Pure, no live mutation
assert.equal(r.state.races[0].horses[0].userMark,'◎');
assert.equal(r.state.races[0].horses[0].trainingScore,66);
assert.equal(r.state.races[0].horses[1].tenRank,4); // Missing does not erase
assert.equal(merge(r.state,feed,now).changed,0); // Idempotence
r.state.races[0].horses[0].tenRank=9;
assert.equal(merge(r.state,feed,now).state.races[0].horses[0].tenRank,9); // Manual edit remains
for (const patch of [{date:'2025-10-25'},{v3DateLabel:'10/24(土)'},{track:'東京'},{raceNo:2},{horses:[{number:1,name:'違う馬'}]}]) {
  const bad=structuredClone(input); Object.assign(bad.races[0],patch);
  assert.equal(merge(bad,feed,now).changed,0);
}
assert.equal(merge(input,feed,now+400*86400000).changed,0);
assert.equal(merge({races:[]},feed,now).changed,0);
assert.equal(merge({races:[...input.races,...input.races]},feed,now).changed,0);
for (const patch of [{tenRank:0},{agariRank:19},{tenPast1f:'124'},{tenRank:2.5}]) {
 const bad=structuredClone(feed); Object.assign(bad.races[0].horses[0],patch); assert.throws(()=>merge(input,bad,now));
}
const newer=structuredClone(feed); newer.races[0].revision=2; newer.races[0].horses[0].tenRank=3;
assert.equal(merge(r.state,newer,now).state.races[0].horses[0].tenRank,3);
assert.throws(()=>merge(input,{...feed,races:[packet,packet]},now));
console.log('PASS: merge, identity/date/roster guards, missing values, replay/manual edits, revisions, invalid data');
