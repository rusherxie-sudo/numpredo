// 候选进度回归：真实样例与独立解校验，不以另一份重放实现作预期。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bit, computeCandidates, countSolutions, gridFromString, logicalSolve, solveOne } from '../../src/engine/index.ts';
import { candidateRemoval, createCandidateProgress, describeCandidateStep, editCandidateProgress, replayCandidateProgress } from '../../src/client/candidate-progress.ts';

const SAMPLE = '..42.....3......6.5..3...71..5.72.43..39.65..21.53.6..15...3..4.8......5.....17..';
const start = () => createCandidateProgress(gridFromString(SAMPLE));

test('样例真实消候选：不填数、保留删除、能继续并可完整撤销', () => {
  const initial = start();
  const index = initial.steps.findIndex((step) => step.eliminations?.length);
  assert.equal(index, 22);
  const before = replayCandidateProgress(initial, index);
  const step = before.next!;
  const after = replayCandidateProgress(before, index + 1);
  assert.deepEqual(after.grid, before.grid);
  assert.notDeepEqual(after.candidates, before.candidates);
  assert.deepEqual(after.next, initial.steps[index + 1]);
  for (const [cell, digit] of step.eliminations!) {
    assert.ok(before.candidates[cell] & bit(digit));
    assert.equal(after.candidates[cell] & bit(digit), 0);
    assert.ok(computeCandidates(after.grid)[cell] & bit(digit), '基础重算会错误恢复这个候选');
    assert.equal(candidateRemoval(after, cell, digit)?.number, index + 1);
  }
  const continued = replayCandidateProgress(after, index + 2);
  for (const [cell, digit] of step.eliminations!) assert.equal(continued.candidates[cell] & bit(digit), 0);
  const undo = replayCandidateProgress(after, index);
  assert.deepEqual(undo.grid, before.grid);
  assert.deepEqual(undo.candidates, before.candidates);
  assert.equal(candidateRemoval(undo, step.eliminations![0][0], step.eliminations![0][1]), undefined);
  const reset = replayCandidateProgress(continued, 0);
  assert.deepEqual(reset.grid, initial.grid);
  assert.deepEqual(reset.candidates, initial.candidates);
  assert.deepEqual(initial.grid, gridFromString(SAMPLE));
  assert.equal(initial.applied, 0);
});

test('完整真实轨迹每个前缀保留唯一解，所有剩余空格保留答案候选', () => {
  const initial = start();
  const original = initial.grid.slice();
  assert.equal(countSolutions(original, 2), 1);
  const solution = solveOne(original)!;
  let placements = 0;
  let eliminations = 0;
  for (let applied = 0; applied <= initial.steps.length; applied++) {
    const state = replayCandidateProgress(initial, applied);
    assert.equal(countSolutions(state.grid, 2), 1);
    for (let cell = 0; cell < 81; cell++) {
      if (state.grid[cell]) assert.equal(state.grid[cell], solution[cell]);
      else assert.ok(state.candidates[cell] & bit(solution[cell]), '逻辑删除必须保留唯一解候选');
    }
    if (applied > 0) {
      const step = state.history.at(-1)!;
      if (step.cell !== undefined) {
        placements++;
        assert.equal(state.grid.filter(Boolean).length, original.filter(Boolean).length + placements);
        assert.equal(state.candidates[step.cell], 0);
      } else eliminations++;
    }
  }
  assert.ok(placements > 0 && eliminations > 0);
  const final = replayCandidateProgress(initial, initial.steps.length);
  assert.deepEqual(final.grid, solution);
  assert.equal(final.next, undefined);
  assert.deepEqual(initial.grid, original);
});

test('人工编辑清空旧轨迹，以当前可见盘面为新基线且不修改旧状态', () => {
  const old = replayCandidateProgress(start(), 24);
  const previousGrid = old.grid.slice();
  const cell = old.grid.findIndex((value) => value !== 0);
  const edited = editCandidateProgress(old, cell, 0);
  assert.equal(edited.applied, 0);
  assert.equal(edited.history.length, 0);
  assert.equal(edited.baseline[cell], 0);
  assert.deepEqual(edited.candidates, computeCandidates(edited.grid));
  assert.deepEqual(edited.steps, logicalSolve(edited.grid).steps);
  assert.deepEqual(old.grid, previousGrid);
  const pasted = createCandidateProgress(gridFromString(SAMPLE));
  assert.equal(pasted.applied, 0);
  assert.deepEqual(pasted.grid, gridFromString(SAMPLE));
});

test('说明逐格对应删除数字，区分候选删除与数字确定', () => {
  const text = describeCandidateStep({ technique: 'hiddenPair', eliminations: [[30, 3], [48, 4], [30, 5]] });
  assert.match(text, /候補削除/);
  assert.match(text, /4行4列のマスから候補3・5/);
  assert.match(text, /6行4列のマスから候補4/);
  assert.doesNotMatch(text, /候補3・4・5/);
  assert.match(text, /数字はまだ確定しません/);
  assert.match(describeCandidateStep(start().next!), /数字確定/);
});

test('冲突盘、无候选盘、空盘、完成盘不会提供可应用的伪步骤', () => {
  const conflict = gridFromString('11' + '.'.repeat(79));
  const impossible = new Array<number>(81).fill(0);
  for (let i = 0; i < 8; i++) impossible[i] = i + 1;
  impossible[17] = 9;
  const solved = solveOne(gridFromString(SAMPLE))!;
  for (const grid of [conflict, impossible, new Array<number>(81).fill(0), solved]) {
    const state = createCandidateProgress(grid);
    assert.equal(state.next, undefined);
    assert.equal(state.steps.length, 0);
    assert.deepEqual(replayCandidateProgress(state, 1).grid, grid);
  }
});
