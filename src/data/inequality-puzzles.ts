import beginner from './puzzles/beginner.json' with { type:'json' };
import type { VariantPuzzle, Inequality } from '../engine/variant-grid.ts';
// Stable standard source IDs; adding true inequalities cannot add alternative solutions.
export const INEQUALITY_PUZZLES: VariantPuzzle[] = beginner.puzzles.slice(100,106).map((p,k)=>{
  const signs:Inequality[]=[];
  for(let a=0;a<81;a++)for(const b of [a%9<8?a+1:-1,a+9<81?a+9:-1]) {
    if(b<0||(a*3+b+k)%5!==0)continue;
    if(p.puzzle[a]!=='.'&&p.puzzle[a]!=='0'&&p.puzzle[b]!=='.'&&p.puzzle[b]!=='0')continue;
    signs.push([a,b,Number(p.solution[a])<Number(p.solution[b])?'<':'>']);
  }
  return {id:`ineq-${k+1}`,puzzle:p.puzzle,solution:p.solution,signs};
});
