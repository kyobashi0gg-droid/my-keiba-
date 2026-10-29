const assert=require('node:assert/strict');const {plan}=require('../db-lab/batch-core');const feed=require('../db-lab/horse-batch-v1.json');
const first=plan(feed,[],[],'now');assert.equal(first.horseWrites.length,1);assert.equal(first.writes.length,7);
const repeat=plan(feed,first.horseWrites,first.writes,'later');assert.equal(repeat.writes.length,0);assert.equal(repeat.horseWrites.length,0);
const horses=structuredClone(first.horseWrites),runs=structuredClone(first.writes);horses[0].name='手動名';horses[0].nameCorrectedAt='then';horses[0].nameKey='手動名';runs[0].margin='0.1';runs[0].review='old';const update=plan(feed,horses,runs,'later');assert.equal(update.horseWrites[0].name,'手動名');assert.equal(update.writes[0].margin,'0.1');assert.equal(update.summary[0].addedRuns,0);
const extra={...runs[0],id:'other-run',date:'2026-07-01'};assert.equal(plan(feed,horses,[...runs,extra],'later').summary[0].afterRuns,8);
assert.throws(()=>plan(feed,[{key:'x',name:'アイムイン',registrationNo:'9999999999'}],[],'now'));
assert.throws(()=>plan(feed,[...first.horseWrites,...first.horseWrites],[],'now'));
const invalid=structuredClone(feed);invalid.horses[0].runs.push(invalid.horses[0].runs[0]);assert.throws(()=>plan(invalid,[],[],'now'));
console.log('PASS: initial registration, idempotence, corrected name, missing field preservation, old runs, identity conflict, duplicates');
