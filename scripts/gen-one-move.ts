import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildOneMoveSets } from '../src/data/one-move.ts';
import { countSolutions, gridFromString, solveOne } from '../src/engine/index.ts';

const sets=buildOneMoveSets();
mkdirSync('public/data/one-move',{recursive:true});
for(const set of sets) {
  assert.equal(new Set(set.questions.map(q=>q.id)).size,5);
  for(const q of set.questions) {
    const puzzle=JSON.parse(readFileSync(`src/data/puzzles/${q.level}.json`,'utf8')).puzzles[q.number-1].puzzle;
    const initial=gridFromString(puzzle);assert.equal(countSolutions(initial.slice(),2),1);
    const solution=solveOne(initial)!;
    q.grid.forEach((n,i)=>{if(n)assert.equal(n,solution[i]);else assert.ok(q.candidates[i].includes(solution[i]));});
    assert.equal(q.grid[q.target],0);assert.ok(q.options.includes(q.answer));assert.equal(new Set(q.options).size,q.options.length);
    if(q.placing) assert.equal(q.answer,solution[q.target]); else {assert.notEqual(q.answer,solution[q.target]);assert.ok(q.candidates[q.target].includes(q.answer));}
    assert.ok(q.marks.length && q.premise && q.outcome);
  }
  writeFileSync(`public/data/one-move/${set.slug}.json`,JSON.stringify(set)+'\n');
}
console.log(`Validated ${sets.length} technique sets / ${sets.reduce((n,s)=>n+s.questions.length,0)} real one-move positions`);
