import { mkdirSync, writeFileSync } from 'node:fs';
import { MINI6_PUZZLES } from '../src/data/mini6.ts';
import { INEQUALITY_PUZZLES } from '../src/data/inequality-puzzles.ts';
import { peersFor, variantCandidates } from '../src/engine/variant-grid.ts';
import { solve16 } from '../src/client/sudoku16-solver.ts';
const symbols='123456789ABCDEFG';
let seed=20260925;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function shuffle<T>(items:T[]):T[]{const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const order=()=>shuffle([0,1,2,3]).flatMap(b=>shuffle([0,1,2,3]).map(r=>b*4+r));
const peers=peersFor(16,4,4);
function singles(grid:number[]):boolean {while(grid.includes(0)){const ds=variantCandidates(grid,16,peers);const i=grid.findIndex((v,i)=>!v&&ds[i].length===1);if(i<0)return false;grid[i]=ds[i][0];}return true;}
const large=Array.from({length:4},(_,k)=>{
  const rows=order(),cols=order(),digits=shuffle([...symbols]);
  const solution=rows.flatMap(r=>cols.map(c=>digits[(r*4+Math.floor(r/4)+c)%16])).join('');
  const grid=[...solution].map(c=>symbols.indexOf(c)+1);let removed=0;
  for(const i of shuffle(Array.from({length:256},(_,i)=>i))){const old=grid[i];grid[i]=0;if(!singles(grid.slice()))grid[i]=old;else removed++;if(removed===80+k*8)break;}
  const result=solve16(Uint8Array.from(grid),2);
  if(result.aborted||result.count!==1||!singles(grid.slice()))throw Error('Invalid 16×16 pack');
  return {id:`large16-${k+1}`,puzzle:grid.map(v=>v?symbols[v-1]:'.').join(''),solution};
});
const packs=[
  {slug:'6x6',name:'6×6入門',size:6,blockRows:2,blockCols:3,perPage:2,puzzles:MINI6_PUZZLES.map((p,i)=>({...p,id:`mini6-${i+1}`}))},
  {slug:'inequality',name:'不等号ナンプレ入門',size:9,blockRows:3,blockCols:3,perPage:1,puzzles:INEQUALITY_PUZZLES},
  {slug:'16x16',name:'16×16入門',size:16,blockRows:4,blockCols:4,perPage:1,puzzles:large},
];
mkdirSync('public/downloads/variants',{recursive:true});
writeFileSync('public/downloads/variants/manifest.json',JSON.stringify({version:'01',packs},null,2)+'\n');
console.log('Variant manifest: 6 mini + 6 inequality + 4 large puzzles');
