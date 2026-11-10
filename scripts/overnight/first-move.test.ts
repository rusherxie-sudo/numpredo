import test from 'node:test';
import assert from 'node:assert/strict';
import {firstMove as lesson} from '../../src/data/first-move.ts';
import {countSolutions,solveOne} from '../../src/engine/countSolver.ts';
import {gridFromString} from '../../src/engine/board.ts';
import beginner from '../../src/data/puzzles/beginner.json' with {type:'json'};
test('首页例题对应真实初级No.14，且仍有唯一解',()=>{
 assert.deepEqual(lesson.grid,gridFromString(beginner.puzzles[lesson.number-1].puzzle));
 assert.equal(countSolutions(lesson.grid,2),1);
 assert.equal(solveOne(lesson.grid)?.[lesson.target],lesson.answer);
});
test('每个错误选项确实与给定数字冲突，正确数字保留唯一解',()=>{
 for(let d=1;d<=9;d++){
  const grid=lesson.grid.slice();grid[lesson.target]=d;
  assert.equal(countSolutions(grid,2),d===lesson.answer?1:0);
  assert.equal(Boolean(lesson.rejection[d]),d!==lesson.answer);
 }
 assert.equal(lesson.grid[lesson.target],0);
});
