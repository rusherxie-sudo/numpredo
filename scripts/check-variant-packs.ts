import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import { MINI6_PUZZLES, countMini6 } from '../src/data/mini6.ts';
import { INEQUALITY_PUZZLES } from '../src/data/inequality-puzzles.ts';
import { peersFor, variantCandidates, killerCombinations } from '../src/engine/variant-grid.ts';
import { countSolutions,gridFromString } from '../src/engine/index.ts';
import { solve16 } from '../src/client/sudoku16-solver.ts';
const manifest=JSON.parse(readFileSync('public/downloads/variants/manifest.json','utf8'));
const symbols='123456789ABCDEFG';
for(const pack of manifest.packs){
  assert.equal(new Set(pack.puzzles.map((p:{id:string})=>p.id)).size,pack.puzzles.length);
  assert.equal(new Set(pack.puzzles.map((p:{puzzle:string})=>p.puzzle)).size,pack.puzzles.length);
  const peers=peersFor(pack.size,pack.blockRows,pack.blockCols);
  for(const p of pack.puzzles){
    const grid=[...p.puzzle].map(c=>c==='.'?0:symbols.indexOf(c)+1),solution=[...p.solution].map(c=>symbols.indexOf(c)+1);
    assert.equal(grid.length,pack.size**2);assert.equal(solution.length,grid.length);
    solution.forEach((v,i)=>{assert.ok(v>=1&&v<=pack.size);assert.ok(peers[i].every(j=>solution[j]!==v));assert.ok(!grid[i]||grid[i]===v);});
    if(pack.slug==='inequality'){assert.ok(p.signs.some(([a,b]:number[])=>b===a+1));assert.ok(p.signs.some(([a,b]:number[])=>b===a+9));}
    for(const [a,b,op] of p.signs??[])assert.ok(op==='<'?solution[a]<solution[b]:solution[a]>solution[b]);
    if(pack.size===6)assert.equal(countMini6(grid.slice()),1);
    if(pack.size===9)assert.equal(countSolutions(gridFromString(p.puzzle),2),1);
    if(pack.size===16){const result=solve16(Uint8Array.from(grid),2);assert.equal(result.aborted,false);assert.equal(result.count,1);assert.deepEqual(Array.from(result.solution!),solution);}
    while(grid.includes(0)){
      const ds=variantCandidates(grid,pack.size,peers,p.signs);
      grid.forEach((_,i)=>assert.ok(ds[i].includes(solution[i]),`Candidate lost at ${p.id}/${i}`));
      const i=grid.findIndex((v,i)=>!v&&ds[i].length===1);assert.ok(i>=0,`Logical hint stalled: ${p.id}`);grid[i]=ds[i][0];
    }
    assert.deepEqual(grid,solution);
  }
  for(const kind of ['questions','answers'])assert.ok(existsSync(`public/downloads/variants/numpredo-${pack.slug}-01-${kind}.pdf`));
}
assert.deepEqual(manifest.packs[0].puzzles,MINI6_PUZZLES.map((p,i)=>({...p,id:`mini6-${i+1}`})));
assert.deepEqual(manifest.packs[1].puzzles,INEQUALITY_PUZZLES);
const empty=Array(36).fill(0),peers=peersFor(6,2,3);
const ds=variantCandidates(empty,6,peers,[[0,1,'<'],[1,2,'<']]);
assert.deepEqual(ds[0],[1,2,3,4]);assert.deepEqual(ds[2],[3,4,5,6]);
empty[0]=6;empty[1]=1;assert.equal(variantCandidates(empty,6,peers,[[0,1,'<']])[0].length,0);
// Independent exhaustive subset oracle, including include/exclude filters.
for(let count=1;count<=9;count++)for(let sum=1;sum<=45;sum++)for(const [required,excluded] of [[[],[]],[[1],[9]],[[2,5],[3,8]]] as [number[],number[]][]){
  const expected:number[][]=[];
  for(let mask=1;mask<512;mask++){
    const digits=Array.from({length:9},(_,i)=>i+1).filter(d=>mask&(1<<(d-1)));
    if(digits.length===count&&digits.reduce((a,b)=>a+b,0)===sum&&required.every(d=>digits.includes(d))&&excluded.every(d=>!digits.includes(d)))expected.push(digits);
  }
  assert.deepEqual(killerCombinations(count,sum,required,excluded).map(x=>x.join(',')).sort(),expected.map(x=>x.join(',')).sort());
}
for(const [n,sum] of [[0,10],[10,10],[2.5,10],[2,46],[2,NaN]])assert.deepEqual(killerCombinations(n,sum),[]);
assert.deepEqual(killerCombinations(2,10,[1],[1]),[]);
assert.deepEqual(killerCombinations(2,10,[1,1]),[]);
console.log('✓ 16 print puzzles: unique solutions, constraints, complete logical hints, stable sources; Killer exhaustive subset oracle passed');
