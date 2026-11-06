import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {LESSONS} from '../src/data/expansion/lessons.ts';
import {MODELS,localAssignments} from '../src/data/expansion/models.ts';
import {EXAMPLES} from '../src/data/expansion/examples.ts';
import {buildPrintSets} from '../src/data/expansion/print-sets.ts';
import {teachingCase,explainPremise} from '../src/data/teaching-cases.ts';
import {gridFromString,countSolutions,logicalSolve,DIAGONAL_UNITS,buildContext,buildKillerContext,countSolutionsKiller,logicalSolveKiller,computeCandidates,PEERS,bit} from '../src/engine/index.ts';
import {peersFor} from '../src/engine/variant-grid.ts';
const packs=buildPrintSets();
assert.equal(LESSONS.length,12);assert.equal(EXAMPLES.length,8);assert.equal(packs.length,10);
const paths=[...LESSONS,...EXAMPLES,...packs].map(p=>p.path);assert.equal(new Set(paths).size,30);
for(const [name,model] of Object.entries(MODELS)){
 assert.ok(localAssignments(model)>0,`${name}: satisfiable premises`);assert.equal(localAssignments(model,model.digit),0,`${name}: removal valid under every assignment`);
 const bad=structuredClone(model);
 if(bad.boolean)bad.exactlyOne=bad.exactlyOne?.slice(1);
 else if(name==='hidden-triple')bad.cells[3].values.push(1);
 else if(name==='hidden-quad')bad.cells[4].values.push(1);
 else if(name==='naked-quad')bad.cells[0].values.push(5);
 else if(name==='xyz-wing')bad.cells[0].values.push(4);
 assert.ok(localAssignments(bad,bad.digit)>0,`${name}: weakening a premise invalidates the claimed removal`);
}
for(const l of LESSONS)if(l.source)teachingCase({...l.source,heading:'',question:''});
for(const e of EXAMPLES){
 const c=teachingCase(e.spec),sol=logicalSolve(c.initial.slice());assert.ok(sol.solved);assert.equal(sol.grid.join(''),c.raw.solution);
 const grid=c.initial.slice(),cand=computeCandidates(grid);
 for(const step of sol.steps){
  assert.ok(explainPremise(cand,step).text.length>0,`${e.slug}: every step has a verified premise`);
  if(step.cell!=null){assert.equal(step.digit,Number(c.raw.solution[step.cell]));grid[step.cell]=step.digit!;cand[step.cell]=0;for(const p of PEERS[step.cell])cand[p]&=~bit(step.digit!);}
  for(const [cell,digit] of step.eliminations??[]){assert.notEqual(digit,Number(c.raw.solution[cell]));cand[cell]&=~bit(digit);}
  for(let i=0;i<81;i++)if(!grid[i])assert.ok(cand[i]&bit(Number(c.raw.solution[i])));
 }
}
function countMini(puzzle:string):number {
 const grid=[...puzzle].map(c=>c==='.'?0:Number(c)),peers=peersFor(4,2,2);let count=0;
 function solve():void{if(count>=2)return;const cell=grid.indexOf(0);if(cell<0){count++;return;}for(let n=1;n<=4;n++)if(!peers[cell].some(p=>grid[p]===n)){grid[cell]=n;solve();grid[cell]=0;}}
 solve();return count;
}
for(const pack of packs){
 assert.equal(new Set(pack.items.map(i=>i.id)).size,pack.items.length);
 for(const p of pack.items){
  assert.equal(p.puzzle.length,pack.size**2);assert.equal(p.solution.length,pack.size**2);
  [...p.puzzle].forEach((v,i)=>{if(!'.0'.includes(v))assert.equal(v,p.solution[i]);});
  if(pack.kind==='mini'){
   assert.equal(countMini(p.puzzle),1);const peers=peersFor(4,2,2);[...p.solution].forEach((v,i)=>{assert.ok('1234'.includes(v));assert.ok(peers[i].every(c=>p.solution[c]!==v));});
  } else if(pack.kind==='killer'){
   const ctx=buildKillerContext(p.cages!);assert.equal(countSolutionsKiller(gridFromString(p.puzzle),ctx,2),1);const result=logicalSolveKiller(gridFromString(p.puzzle),ctx);assert.ok(result.solved);assert.equal(result.grid.join(''),p.solution);
   assert.equal(new Set(p.cages!.flatMap(c=>c.cells)).size,81);for(const c of p.cages!)assert.equal(c.cells.reduce((n,i)=>n+Number(p.solution[i]),0),c.sum);
  } else {const ctx=pack.kind==='diagonal'?buildContext(DIAGONAL_UNITS):undefined;assert.equal(countSolutions(gridFromString(p.puzzle),2,ctx),1);const result=logicalSolve(gridFromString(p.puzzle),ctx);assert.ok(result.solved);assert.equal(result.grid.join(''),p.solution);}
 }
 for(const kind of ['questions','answers']){assert.ok(existsSync(`public/downloads/collections/${pack.slug}-${kind}.pdf`));assert.ok(existsSync(`public/images/collections/${pack.slug}-${kind}.png`));}
}
assert.deepEqual(JSON.parse(readFileSync('public/downloads/collections/manifest.json','utf8')).packs,packs);
const verifiedPdfs=JSON.parse(readFileSync('src/data/expansion/pdf-checks.json','utf8')) as {file:string;sha256:string;previewSha256:string}[];
assert.equal(verifiedPdfs.length,20);
for(const record of verifiedPdfs){assert.equal(createHash('sha256').update(readFileSync(`public/downloads/collections/${record.file}`)).digest('hex'),record.sha256);assert.equal(createHash('sha256').update(readFileSync(`public/images/collections/${record.file.replace('.pdf','.png')}`)).digest('hex'),record.previewSha256);}
const sitemap=readFileSync('dist/sitemap-0.xml','utf8');
for(const path of paths){const html=readFileSync(`dist${path}index.html`,'utf8');assert.ok(html.includes(`rel="canonical" href="https://numpredo.com${path}"`),path);assert.ok(sitemap.includes(`https://numpredo.com${path}`),path);}
assert.equal((sitemap.match(/<loc>/g)??[]).length,98);
console.log('✓ 30 new indexable pages; six local techniques + counterexamples; eight complete solution replays; 76 selected puzzles + 20 PDF assets verified');
