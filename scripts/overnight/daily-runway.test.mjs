import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const epoch=Date.UTC(2026,5,14),day=86400000,jst=32400000;
const slots=[['beginner',55],['intermediate',55],['advanced',55],['hard',55],['extreme',55],['beginner',455],['intermediate',455]];
const lastElapsed=Math.min(...slots.map(([lv,skip])=>JSON.parse(readFileSync(`src/data/puzzles/${lv}.json`)).puzzles.length-skip-90));
function at(ms){return spawnSync(process.execPath,['--input-type=module','-e',`Date.now=()=>${ms}; await import('./scripts/check-daily-runway.ts');`],{encoding:'utf8'});}
test('90 days left is accepted at the last JST millisecond',()=>{const r=at(epoch+(lastElapsed+1)*day-jst-1);assert.equal(r.status,0,r.stderr);assert(r.stdout.includes('=90日'));});
test('JST midnight with 89 days left blocks supply refresh',()=>{const r=at(epoch+(lastElapsed+1)*day-jst);assert.notEqual(r.status,0);assert(r.stderr.includes('必要: 90日'));});
