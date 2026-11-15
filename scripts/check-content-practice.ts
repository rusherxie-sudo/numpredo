// 独立验证本批教学推理及真实错误反例，不改动题库。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import killer from '../src/data/puzzles/killer.json' with {type:'json'};
import intermediate from '../src/data/puzzles/intermediate.json' with {type:'json'};
import {MINI6_PUZZLES,mini6Candidates,countMini6} from '../src/data/mini6.ts';
import {gridFromString,computeCandidates,digitsOf,PEERS} from '../src/engine/board.ts';
import {countSolutions} from '../src/engine/countSolver.ts';

const p=killer.puzzles[20], cage=p.cages.find(c=>c.sum===24&&c.cells.length===3)!;
assert.deepEqual(cage.cells,[4,5,14]);
assert.equal(p.puzzle[6],'8');
// 穷举三个不同数字的所有有序分配，独立于组合工具和逻辑求解器。
const allocations:number[][]=[];
for(let a=1;a<=9;a++)for(let b=1;b<=9;b++)for(let c=1;c<=9;c++){
 if(new Set([a,b,c]).size!==3 || a+b+c!==24)continue;
 const ds=[a,b,c];
 if(cage.cells.every((cell,i)=>PEERS[cell].every(peer=>p.puzzle[peer]!==String(ds[i]))))allocations.push(ds);
}
assert.equal(allocations.length,2);
assert.deepEqual([...new Set(allocations.map(x=>x[2]))],[8]);
assert.deepEqual([...new Set(allocations.map(x=>x[0]))].sort(),[7,9]);
assert.equal(p.solution[14],'8');
console.log('P1: exhaustive cage allocations confirm r2c6=8; r1c5/r1c6 remain 7 or 9');

const mini=MINI6_PUZZLES[1], grid=[...mini.puzzle].map(x=>x==='.'?0:+x);
assert.equal(countMini6(grid.slice(),2),1);
assert.deepEqual(mini6Candidates(grid,6),[5]);
assert.equal(mini.solution[6],'5');
assert.deepEqual(grid.slice(6,12).filter(Boolean).sort(),[2,4]);
assert.deepEqual(grid.filter((_,i)=>i%6===0).filter(Boolean).sort(),[1,2,3,4,6]);
assert.deepEqual([0,1,2,6,7,8].map(i=>grid[i]).filter(Boolean).sort(),[2,3,6]);
const badMini=grid.slice();badMini[6]=6;assert.equal(countMini6(badMini,2),0);
console.log('P2: 6x6 problem 2 r2c1=5; full row/column/2x3 exclusions and wrong 6 verified');

const standard=intermediate.puzzles[6], original=gridFromString(standard.puzzle);
assert.deepEqual(digitsOf(computeCandidates(original)[16]),[1,8]);
assert.equal(countSolutions(original.slice(),2),1);
assert.equal(standard.solution[16],'8');
const incorrect=original.slice();incorrect[16]=1;assert.equal(countSolutions(incorrect,2),0);
console.log('P3: original intermediate 7 unique; r2c8 candidates 1/8; false singleton 1 has no completion');

for(const [path,text] of [
 ['variants/killer','No.21の一手を考える'],
 ['variants/6x6','問題2で自分で探す'],
 ['guide/candidate-update','candidate-missing-example'],
] as const)assert.ok(readFileSync('dist/'+path+'/index.html','utf8').includes(text));
console.log('Rendered P1/P2/P3 sections exist');
