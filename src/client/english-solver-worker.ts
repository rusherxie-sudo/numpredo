import { countSolutions, solveOne } from '../engine/countSolver.ts';
import { logicalSolve } from '../engine/logicalSolver.ts';
import { solve16 } from '../engine/solve16.ts';
import type { SolveStep } from '../engine/types.ts';

export interface SolverResult {
  count: number;
  solution?: number[];
  limited?: boolean;
  logical?: { steps: SolveStep[]; solved: boolean };
}

self.addEventListener('message', ({ data }: MessageEvent<{ size: number; grid: number[] }>) => {
  const { size, grid } = data;
  let result: SolverResult;
  if (size === 16) {
    const { count, solution, aborted } = solve16(Uint8Array.from(grid));
    result = { count, solution: solution && Array.from(solution), limited: aborted };
  } else {
    const count = countSolutions(grid);
    const logical = count === 1 ? logicalSolve(grid) : undefined;
    const solution = logical?.solved ? logical.grid : count ? solveOne(grid) ?? undefined : undefined;
    result = { count, solution, logical };
  }
  self.postMessage(result);
});
