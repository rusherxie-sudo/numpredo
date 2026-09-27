import beginner from './puzzles/beginner.json' with {type:'json'};
import {gridFromString,logicalSolve,computeCandidates} from '../engine/index.ts';
import {explainPremise} from './teaching-cases.ts';
export const START_PUZZLE=beginner.puzzles[0];
export function beginnerSteps(){
 const grid=gridFromString(START_PUZZLE.puzzle),result=logicalSolve(grid.slice());
 if(!result.solved||result.grid.join('')!==START_PUZZLE.solution)throw Error('Invalid beginner source');
 return result.steps.slice(0,3).map((step,i)=>{
  if(step.cell==null||step.digit==null||!['nakedSingle','hiddenSingle'].includes(step.technique))throw Error('Intro must use singles');
  const candidates=computeCandidates(grid),before=grid.slice(),premise=explainPremise(candidates,step);
  const cell=step.cell,answer=step.digit;grid[cell]=answer;
  return {index:i,cell,answer,before,after:grid.slice(),candidates,premise};
 });
}
