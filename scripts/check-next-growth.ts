import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {newspaperInput} from '../src/engine/newspaper-input.ts';
import {decodeVariant,variantSymbol} from '../src/engine/variant-symbols.ts';
import {PROGRESSION_PACK} from '../src/data/progression-pack.ts';
import {SUDOKU16_PLAY} from '../src/data/sudoku16-play.ts';
import {peersFor,variantCandidates} from '../src/engine/variant-grid.ts';
import {countMini6} from '../src/data/mini6.ts';
import {countSolutions,gridFromString,logicalSolve} from '../src/engine/index.ts';
import {SOLVER_SAMPLE} from '../src/data/solver-sample.ts';
import {returnPath,toolLink} from '../src/client/learning-transfer.ts';
const source=JSON.parse(readFileSync('public/downloads/variants/manifest.json','utf8')).packs.find((p:{slug:string})=>p.slug==='16x16');
assert.deepEqual(SUDOKU16_PLAY,source.puzzles);
assert.deepEqual(decodeVariant('123456789ABCDEFG.'),[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,0]);
assert.equal(Array.from({length:16},(_,i)=>variantSymbol(i+1)).join(''),'123456789ABCDEFG');
for(const pack of [...PROGRESSION_PACK,{size:16,blockRows:4,blockCols:4,puzzles:SUDOKU16_PLAY}]){
 const peers=peersFor(pack.size,pack.blockRows,pack.blockCols);
 for(const p of pack.puzzles){
  const grid=decodeVariant(p.puzzle),answer=decodeVariant(p.solution);
  while(grid.includes(0)){
   const ds=variantCandidates(grid,pack.size,peers);
   const i=grid.findIndex((v,i)=>!v&&ds[i].length===1);assert.ok(i>=0,`${p.id} has a logical next move`);
   assert.equal(ds[i][0],answer[i]);grid[i]=ds[i][0];
  }
  assert.deepEqual(grid,answer);
  if(pack.size===6)assert.equal(countMini6(decodeVariant(p.puzzle)),1);
 }
}
// Independent 4x4 enumeration validates the progression sources, not just a stored answer.
function count4(source:string):number{
 const g=decodeVariant(source);let count=0;
 function visit():void{if(count>=2)return;const i=g.indexOf(0);if(i<0){count++;return;}for(let d=1;d<=4;d++){
  const r=Math.floor(i/4),c=i%4;
  if(g.some((v,j)=>v===d&&(Math.floor(j/4)===r||j%4===c||(Math.floor(Math.floor(j/4)/2)===Math.floor(r/2)&&Math.floor((j%4)/2)===Math.floor(c/2)))))continue;
  g[i]=d;visit();g[i]=0;
 }}visit();return count;
}
PROGRESSION_PACK[0].puzzles.forEach(p=>assert.equal(count4(p.puzzle),1));
const old=JSON.parse(readFileSync('public/downloads/activity/manifest.json','utf8'));
const next=JSON.parse(readFileSync('public/downloads/activity/manifest-02.json','utf8'));
assert.equal(next.puzzles.length,8);
assert.equal(new Set([...old.puzzles,...next.puzzles].map(p=>p.puzzle)).size,16);
for(const p of next.puzzles){
 const pool=JSON.parse(readFileSync(`src/data/puzzles/${p.level}.json`,'utf8')).puzzles;
 assert.equal(p.puzzle,pool[p.number-1].puzzle);assert.ok(!pool.slice(0,60).some((x:{puzzle:string})=>x.puzzle===p.puzzle));
 const g=gridFromString(p.puzzle);assert.equal(countSolutions(g.slice(),2),1);const solved=logicalSolve(g);assert.ok(solved.solved);assert.equal(solved.grid.join(''),p.solution);
}
assert.deepEqual(newspaperInput(SOLVER_SAMPLE.match(/.{9}/g)!.join('\n')).grid,gridFromString(SOLVER_SAMPLE));
assert.deepEqual(newspaperInput(SOLVER_SAMPLE.replace(/\./g,'０')).grid,gridFromString(SOLVER_SAMPLE));
for(const invalid of [SOLVER_SAMPLE.slice(1),'.'.repeat(81),'11'+'.'.repeat(79),SOLVER_SAMPLE.replace(/\./,'X')])assert.ok(newspaperInput(invalid).error);
const back='/guide/newspaper/#newspaper-input';assert.equal(returnPath(back),back);
for(const invalid of ['/guide/newspaper/../evil','//evil.example/guide/newspaper/','/guide/newspaper/?return=https://evil.example'])assert.equal(returnPath(invalid),null);
const carried=new URL(toolLink('/tools/solver/',gridFromString(SOLVER_SAMPLE),back),'https://numpredo.com');assert.equal(carried.search,'');assert.equal(new URLSearchParams(carried.hash.slice(1)).get('grid'),SOLVER_SAMPLE);
for(const f of ['questions','answers','guide'])assert.ok(existsSync(`public/downloads/activity/numpredo-activity-02-${f}.pdf`));
for(const f of ['questions','answers','guide'])assert.ok(existsSync(`public/downloads/progression/numpredo-progression-01-${f}.pdf`));
const embed=readFileSync('dist/embed/mini4/index.html','utf8');assert.ok(embed.includes('noindex,follow'));assert.ok(embed.includes('data-track="false"'));assert.ok(!embed.includes('googletagmanager'));
assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('/embed/'));
const headers=readFileSync('public/_headers','utf8');assert.ok(headers.includes('X-Frame-Options: SAMEORIGIN'));assert.ok(headers.includes('/embed/mini4/*\n  ! X-Frame-Options'));
console.log('✓ 16x16 game symbols and sources; 16 distinct activities; progression logical paths; safe newspaper transfer; isolated noindex embed verified');
