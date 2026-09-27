import pack from './puzzles/killer.json' with {type:'json'};
import {buildKillerContext,logicalSolveKiller,gridFromString} from '../engine/index.ts';
import {killerCombinations} from '../engine/variant-grid.ts';
export const EXPERT_PUZZLES=pack.puzzles.slice(20,30).map((p,i)=>{
 const result=logicalSolveKiller(gridFromString(p.puzzle),buildKillerContext(p.cages));
 if(!result.solved||result.grid.join('')!==p.solution)throw Error('Invalid expert puzzle');
 const tactics=Object.keys(result.techniqueCounts).filter(t=>!['nakedSingle','hiddenSingle','cageCombo'].includes(t));
 return {number:i+21,clues:[...p.puzzle].filter(c=>c!=='.'&&c!=='0').length,cages:p.cages.length,tactics,steps:result.steps.length};
});
export const EXPERT_EXAMPLE=pack.puzzles[20].cages.find(c=>c.cells.length===3&&c.sum===24)!;
export const EXPERT_COMBOS=killerCombinations(EXPERT_EXAMPLE.cells.length,EXPERT_EXAMPLE.sum);
