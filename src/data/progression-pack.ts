import {MINI4_PUZZLES} from './mini4.ts';
import {MINI6_PUZZLES} from './mini6.ts';
export const PROGRESSION_PACK = [
  {size:4,blockRows:2,blockCols:2,puzzles:MINI4_PUZZLES.slice(0,4).map(p=>({id:`mini4-${p.id}`,puzzle:p.puzzle,solution:p.solution}))},
  {size:6,blockRows:2,blockCols:3,puzzles:MINI6_PUZZLES.slice(0,4).map((p,i)=>({id:`mini6-${i+1}`,puzzle:p.puzzle,solution:p.solution}))},
];
