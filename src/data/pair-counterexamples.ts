import { bit, digitsOf, UNITS } from '../engine/index.ts';
import type { teachingCase } from './teaching-cases.ts';

type Lesson = ReturnType<typeof teachingCase>;

// Use an actual replayed candidate state. The witness is the original puzzle's
// verified solution: the tempting elimination would remove its correct digit.
export function pairCounterexample(lesson: Lesson) {
  if (lesson.spec.technique !== 'nakedPair') throw new Error('A pair lesson is required');
  const { grid, candidates } = lesson.before;
  for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
    const unit = UNITS[unitIndex];
    for (let x = 0; x < unit.length; x++) for (let y = x + 1; y < unit.length; y++) {
      const cells: [number, number] = [unit[x], unit[y]];
      const domains = cells.map(cell => digitsOf(candidates[cell]));
      if (Math.min(...domains.map(d => d.length)) !== 2 || Math.max(...domains.map(d => d.length)) !== 3) continue;
      const common = domains[0].filter(digit => domains[1].includes(digit));
      if (common.length !== 2) continue;
      const extraCell = cells[domains[0].length === 3 ? 0 : 1];
      const extraDigit = digitsOf(candidates[extraCell]).find(digit => !common.includes(digit))!;
      if (Number(lesson.raw.solution[extraCell]) !== extraDigit) continue;
      for (const target of unit) {
        const digit = Number(lesson.raw.solution[target]);
        if (cells.includes(target) || grid[target] || !common.includes(digit) || !(candidates[target] & bit(digit))) continue;
        return { cells, common, extraCell, extraDigit, target, digit, unitIndex };
      }
    }
  }
  throw new Error(`No verified counterexample for ${lesson.spec.level} No.${lesson.spec.number}`);
}
