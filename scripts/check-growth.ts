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
