import {beginnerSteps,START_PUZZLE} from '../src/data/beginner-start.ts';
import {EXPERT_PUZZLES,EXPERT_EXAMPLE,EXPERT_COMBOS} from '../src/data/killer-expert.ts';
import killerSource from '../src/data/puzzles/killer.json' with {type:'json'};
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRILL_SPECS, buildDrill } from '../src/data/technique-drills.ts';
import { countSolutions, gridFromString, logicalSolve, bit } from '../src/engine/index.ts';
import { returnPath, toolLink } from '../src/client/learning-transfer.ts';

for (const specs of Object.values(DRILL_SPECS)) for (const spec of specs) {
  const c = buildDrill(spec);
  const solution = Number(c.raw.solution[c.cell]);
  assert.equal(c.options.filter(d => d === c.answer).length, 1);
  assert.ok(c.options.length >= 2);
  if (c.placing) assert.equal(c.answer, solution);
  else {
    assert.notEqual(c.answer, solution);
    assert.ok(c.before.candidates[c.cell] & bit(c.answer));
    assert.equal(c.after.candidates[c.cell] & bit(c.answer), 0);
    for (const d of c.options.filter(d => d !== c.answer)) assert.ok(c.after.candidates[c.cell] & bit(d));
  }
}
for (const value of ['https://evil.example/play/', '//evil.example/play/', '/play/../../evil', '/play/\\\\evil.example/', '/tools/solver/', 'javascript:alert(1)']) assert.equal(returnPath(value), null);
const back = '/play/beginner/?n=63';
assert.equal(returnPath(back), back);
assert.equal(returnPath('/?n=2#home-game'), '/?n=2#home-game');
assert.equal(returnPath('/?n=2\\evil'), null);
const link = new URL(toolLink('/tools/candidate-checker/', Array(81).fill(0), back), 'https://numpredo.com');
const transferred = new URLSearchParams(link.hash.slice(1));
assert.equal(link.search, '');
assert.equal(transferred.get('grid'), '.'.repeat(81));
assert.equal(transferred.get('return'), back);
const pack = JSON.parse(readFileSync('public/downloads/activity/manifest.json', 'utf8'));
assert.equal(pack.puzzles.length, 8);
assert.equal(new Set(pack.puzzles.map((p: {puzzle: string}) => p.puzzle)).size, 8);
for(const p of pack.puzzles) {
  const pool = JSON.parse(readFileSync(`src/data/puzzles/${p.level}.json`, 'utf8')).puzzles;
  assert.equal(p.puzzle, pool[p.number-1].puzzle);
  assert.ok(!pool.slice(0,60).some((old: {puzzle: string})=>old.puzzle === p.puzzle));
  const grid=gridFromString(p.puzzle);
  assert.equal(countSolutions(grid.slice(),2),1);
  const result=logicalSolve(grid);assert.ok(result.solved);assert.equal(result.grid.join(''),p.solution);
}
console.log('✓ Six drill answers and distractors, safe return links, eight unique source-matched activity puzzles verified');

const starter=beginnerSteps();assert.equal(starter.length,3);
assert.equal(countSolutions(gridFromString(START_PUZZLE.puzzle),2),1);
for(const [i,s] of starter.entries()){
 assert.equal(s.before[s.cell],0);assert.equal(s.answer,Number(START_PUZZLE.solution[s.cell]));
 assert.ok(s.candidates[s.cell]&bit(s.answer));
 assert.deepEqual(s.before,i?starter[i-1].after:gridFromString(START_PUZZLE.puzzle));
 assert.equal(s.after.filter((v,c)=>v!==s.before[c]).length,1);
}
assert.equal(EXPERT_PUZZLES.length,10);
for(const p of EXPERT_PUZZLES){const raw=killerSource.puzzles[p.number-1];assert.equal(p.clues,[...raw.puzzle].filter(c=>/[1-9]/.test(c)).length);assert.equal(p.cages,raw.cages.length);}
assert.deepEqual(EXPERT_COMBOS,[[7,8,9]]);
assert.deepEqual(EXPERT_EXAMPLE.cells.map(c=>Number(killerSource.puzzles[20].solution[c])).sort(),[7,8,9]);
console.log('✓ Beginner three-step continuity and answers; ten expert source rows and real cage example verified');
