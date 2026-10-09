import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../odds-live-v49.js', import.meta.url), 'utf8');
const start = src.indexOf('  function normHorseName');
const end = src.indexOf('  async function requestOdds', start);
assert.ok(start > 0 && end > start, 'Validator must be available');
const validate = Function('clean', src.slice(start, end) + '\nreturn validateSnapshot;')
  (value => String(value ?? '').trim());

const names = ['ソットマツモト','ディアファザー','リングスター','ソラティオ',
 'ゲンロクコイモヨウ','ヴィンチェローズ','サイモンオリエント',
 'セイカタカキヤチク','ラフエルガ','ノヴェルアレイア','ルスカーレット',
 'ポッドエステラ','ホシノサミダレ','リアスブルー','クラウンロムパイア','ルスデルカミーノ'];
const odds = [5.7,129.6,181.5,77.8,23.8,23.4,4.8,3.9,4.5,93.9,66.4,63.3,64.8,36.8,77.8,5.4];
const rank = [5,15,16,12,7,6,3,1,2,14,11,9,10,8,13,4];
const horses = names.map((name,i) => ({ number:i+1,name,odds:odds[i],popularity:rank[i] }));
const race = {track:'東京',raceNo:1,v3DateLabel:'10/10(土)',horses};
const data = {track:'東京',raceNo:1,raceDate:'2026-10-10',horses};
const clock = Date.parse('2026-10-09T11:00:00Z'); // JST 20:00, previous day

function check(snapshot, allowed) {
  if (allowed) assert.equal(validate(snapshot, race, clock),snapshot);
  else assert.throws(() => validate(snapshot, race, clock));
}
test('complete snapshot', () => check(data,true));
test('missing horse', () => check({...data,horses:horses.slice(1)},false));
test('horse-name mismatch', () => check({...data,horses:horses.map(h=>h.number===9?{...h,name:'別馬'}:h)},false));
test('duplicate popularity', () => check({...data,horses:horses.map(h=>h.number===15?{...h,popularity:12}:h)},false));
test('wrong race', () => check({...data,raceNo:2},false));
test('wrong year', () => check({...data,raceDate:'2025-10-10'},false));
test('date without year', () => check({...data,raceDate:'10/10'},false));
test('wrong venue', () => check({...data,track:'京都'},false));
test('incomplete source date', () => check({...data,raceDate:''},false));
