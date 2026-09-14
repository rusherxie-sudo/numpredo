import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teachingCase, techniqueCases, guideCases, explainPremise } from '../src/data/teaching-cases.ts';
import { bit, countSolutions } from '../src/engine/index.ts';
import { MINI6_PUZZLES, traceMini6, countMini6, mini6Peers } from '../src/data/mini6.ts';
import { SAMPLE_PUZZLES } from '../src/data/sudoku16-samples.ts';
import { solve16 } from '../src/client/sudoku16-solver.ts';

let cases=0;
for (const [group,specs] of [['guide/techniques',techniqueCases],['guide',guideCases]] as const) {
  for(const [slug,spec] of Object.entries(specs)) {
    const c=teachingCase(spec), solution=[...c.raw.solution].map(Number);
    assert.equal(c.step.technique,spec.technique);
    assert.equal(countSolutions(c.initial.slice(),2),1);
    for(const state of [c.before,c.after]) for(let i=0;i<81;i++) {
      if(state.grid[i]) assert.equal(state.grid[i],solution[i]);
      else assert.ok(state.candidates[i]&bit(solution[i]),`${slug}: true answer removed at ${i}`);
    }
    if(c.step.cell!=null) assert.equal(c.step.digit,solution[c.step.cell]);
    for(const [cell,digit] of c.step.eliminations??[]) {
      assert.ok(c.before.candidates[cell]&bit(digit));
      assert.notEqual(solution[cell],digit);
      assert.equal(c.after.candidates[cell]&bit(digit),0);
    }
    assert.ok(c.premise.cells.length && c.premise.text.length>20);
    assert.throws(()=>explainPremise(Array(81).fill(0),c.step));
    // A diagram with every cell admitting the target digit must never prove a fish/strong link.
    if(['xWing','swordfish','skyscraper'].includes(spec.technique)) assert.throws(()=>explainPremise(Array(81).fill(1022),c.step));
    const html=readFileSync(`dist/${group}/${slug}/index.html`,'utf8');
    assert.ok(html.includes(`/play/${spec.level}/?n=${spec.number}`));
    assert.ok(html.includes('class="case-answer"'));
    assert.ok(html.includes(c.outcome));
    cases++;
  }
}
for(const p of MINI6_PUZZLES) {
  const grid=[...p.puzzle].map(c=>c==='.'?0:Number(c));
  assert.equal(countMini6(grid.slice()),1);
  const trace=traceMini6(p.puzzle);assert.equal(trace.solution,p.solution);
  for(const s of trace.steps) {
    assert.equal(s.before[s.cell],0);
    const allowed=[1,2,3,4,5,6].filter(d=>mini6Peers[s.cell].every(j=>s.before[j]!==d));
    assert.deepEqual(allowed,[s.digit]);
  }
  const invalid=grid.slice();invalid[0]=invalid[1]=1;assert.equal(countMini6(invalid),0);
}
const parse16=(s:string)=>Uint8Array.from(s,c=>Math.max(0,'123456789ABCDEFG'.indexOf(c)+1));
for(const p of SAMPLE_PUZZLES) {
  const grid=parse16(p.puzzle), result=solve16(grid);
  assert.equal(result.count,1);assert.equal(result.aborted,false);
  assert.deepEqual(result.solution,parse16(p.solution));
  assert.ok(p.label.includes(String(grid.filter(Boolean).length)));
  const invalid=grid.slice();invalid[0]=invalid[1]=1;assert.equal(solve16(invalid).count,0);
}
assert.equal(solve16(new Uint8Array(255)).count,0);
assert.equal(solve16(new Uint8Array(256).fill(17)).count,0);
assert.equal(solve16(new Uint8Array(256)).count,2);
console.log(`✓ ${cases} real teaching cases, 6 mini lessons, 5 large samples: answers, candidate safety, negative premises and rendered source links verified`);
