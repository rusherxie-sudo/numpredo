// 固定初级原题；网页和 PDF 共用同一份引擎推理，不生成或修改题库。
import beginner from './puzzles/beginner.json' with { type: 'json' };
import { gridFromString, gridToString, logicalSolve, computeCandidates, digitsOf, UNITS, UNITS_OF, countSolutions, isSolved } from '../engine/index.ts';
import { explainPremise } from './teaching-cases.ts';

export const TUTORIAL_NUMBER = 1;
export const TUTORIAL_GAME = '/play/beginner/?n=1#level-game';
export const TUTORIAL_DOWNLOAD_DIR = '/downloads/beginner-tutorial/';
export const cellName = (cell: number) => `${Math.floor(cell / 9) + 1}行${cell % 9 + 1}列（r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}）`;

const unitName = (unit: number) => unit < 9 ? `${unit + 1}行目` : unit < 18 ? `${unit - 8}列目` : `ブロック${unit - 17}`;
const displayDigits = (ds: number[]) => ds.length ? ds.join('・') : 'なし';

export function beginnerWalkthrough() {
  const source = beginner.puzzles[TUTORIAL_NUMBER - 1];
  // 防止教程的固定编号被悄悄替换；不依赖题库生成器。
  if (source.puzzle !== '2..7..8..17.25843..6.9437...5.....8.6..3.2..9.9.....1...1627.5..85419.62..6..5..7') throw new Error('Beginner tutorial source changed');
  const initial = gridFromString(source.puzzle);
  const result = logicalSolve(initial.slice());
  if (countSolutions(initial.slice(), 2) !== 1 || !result.solved || gridToString(result.grid) !== source.solution) throw new Error('Invalid beginner tutorial solution');
  const grid = initial.slice();
  const steps = result.steps.map((step, index) => {
    const { cell, digit } = step;
    if (cell == null || digit == null || !['nakedSingle', 'hiddenSingle'].includes(step.technique) || step.eliminations?.length || grid[cell] !== 0) throw new Error('Tutorial must place one proved single');
    const before = grid.slice(), candidates = computeCandidates(before);
    const premise = explainPremise(candidates, step);
    const groups = UNITS_OF[cell].map(unit => ({
      unit, name: unitName(unit),
      digits: [...new Set(UNITS[unit].map(c => before[c]).filter(Boolean))].sort((a, b) => a - b),
    }));
    const excluded = [...new Set(groups.flatMap(group => group.digits))].sort((a, b) => a - b);
    const reasoning = groups.map(group => group.name + 'にある数字：' + displayDigits(group.digits) + '。');
    const candidateDigits = digitsOf(candidates[cell]);
    reasoning.push('同じ行・列・ブロックにある｛' + displayDigits(excluded) + '｝は使えません。');
    reasoning.push(premise.text);
    grid[cell] = digit;
    return { number: index + 1, technique: step.technique, cell, digit, location: cellName(cell), before, after: grid.slice(), candidateDigits, groups, excluded, reasoning, remaining: grid.filter(v => v === 0).length };
  });
  if (!isSolved(grid) || gridToString(grid) !== source.solution || steps.length !== initial.filter(v => v === 0).length) throw new Error('Incomplete beginner tutorial');

  // 原题的独立对照：保留引擎的正式手序，说明同一格还可由唯一位置推出。
  const hiddenCell = 8, hiddenDigit = 5, hiddenUnit = 0;
  const originalCandidates = computeCandidates(initial);
  const hiddenStep = { technique: 'hiddenSingle', cell: hiddenCell, digit: hiddenDigit };
  const hiddenPremise = explainPremise(originalCandidates, hiddenStep);
  const spots = UNITS[hiddenUnit].filter(c => originalCandidates[c] & (1 << (hiddenDigit - 1)));
  if (spots.length !== 1 || spots[0] !== hiddenCell) throw new Error('Invalid hidden single example');
  const hidden = {
    cell: hiddenCell, digit: hiddenDigit, unit: hiddenUnit, location: cellName(hiddenCell),
    reasoning: hiddenPremise.text,
    cells: UNITS[hiddenUnit].filter(c => initial[c] === 0).map(cell => ({ cell, location: cellName(cell), candidates: digitsOf(originalCandidates[cell]) })),
    stepNumber: steps.find(s => s.cell === hiddenCell && s.digit === hiddenDigit)!.number,
  };
  return { number: TUTORIAL_NUMBER, puzzle: source.puzzle, solution: source.solution, initial, steps, hidden, questionPages: 1, answerPages: Math.ceil(steps.length / 2) + 2 };
}
