const assert=require('node:assert/strict');
const persist=require('../ten-pattern-persist-v70.js');
function storage(){
 const m=new Map();
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k),raw:m};
}
const s=storage();
const one={id:'race-1',date:'2026-11-21',track:'福島',raceNo:11,raceName:'福島記念',
 horses:[{id:'1',number:1,name:'カラマティアノス'},{id:'14',number:14,name:'サヴォーナ'}]};
const old=structuredClone(one);
persist.record(s,one,one.horses[0],0,Date.parse('2026-11-21T05:00:00Z'));
persist.record(s,one,one.horses[1],15,Date.parse('2026-11-21T05:00:00Z'));
assert.equal(persist.take(s,one)[persist.horseKey(one.horses[1])].value,15);
// Simulate another module overwriting the main storage with stale race data.
s.setItem('my-keiba-lab-v2',JSON.stringify({races:[structuredClone(old)]}));
const loaded=JSON.parse(s.getItem('my-keiba-lab-v2'));
assert.equal(persist.restore(s,loaded.races[0],loaded).restored,2);
assert.equal(loaded.races[0].horses[0].tenPattern,0);
assert.equal(loaded.races[0].horses[1].tenPattern,15);
assert.equal(JSON.parse(s.getItem('my-keiba-lab-v2')).races[0].horses[1].tenPattern,15);
// Race with a different roster must never inherit an older race's ten-P.
const different=structuredClone(one);different.horses[1].name='別の馬';
assert.equal(persist.restore(s,different,{races:[different]}).restored,0);
// Different date is a different race.
const tomorrow=structuredClone(one);tomorrow.date='2026-11-22';
assert.equal(persist.restore(s,tomorrow,{races:[tomorrow]}).restored,0);
// User can explicitly reset P to 未確認 without silently treating it as non-applicable 0.
persist.record(s,one,one.horses[0],null,Date.parse('2026-11-21T05:10:00Z'));
assert.equal(persist.restore(s,loaded.races[0],loaded).restored,1);
assert.equal('tenPattern' in loaded.races[0].horses[0],false);
// A newer official sync must supersede a stale manual value.
const updated=structuredClone(one);
updated.horses[1].tenPattern=30;
updated.horses[1].smartrcSync={
 observedAt:'2026-11-21T06:00:00Z',values:{tenPattern:30}};
assert.equal(persist.restore(s,updated,{races:[updated]}).restored,0);
assert.equal(updated.horses[1].tenPattern,30);
// The user can manually override an earlier published sync.
persist.record(s,updated,updated.horses[1],50,Date.parse('2026-11-21T07:00:00Z'));
assert.equal(persist.restore(s,updated,{races:[updated]}).restored,1);
assert.equal(updated.horses[1].tenPattern,50);
// Backup recovery is only offered on exact race/horse with stored valid values.
const s2=storage();
s2.setItem('my-keiba-smartrc-before-sync-v1',JSON.stringify({races:[{...one,horses:[
 {...one.horses[0],tenPattern:0},{...one.horses[1],tenPattern:15}]}]}));
assert.equal(persist.backupPreview(s2,one).length,2);
assert.equal(persist.restoreBackup(s2,one,{races:[one]}),2);
assert.equal(one.horses[1].tenPattern,15);
assert.equal(persist.backupPreview(s2,different).length,0);
assert.equal(persist.backupPreview(s2,one).length,0);
// Reject unsafe values rather than interpreting them as P15/P30/P50.
assert.throws(()=>persist.record(s,one,one.horses[0],51));
assert.throws(()=>persist.record(s,one,one.horses[0],'15'));
console.log('PASS ten-P reload, record integrity, race identity, missing P, backup recovery and sync precedence');
