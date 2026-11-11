import { PEERS, bit, computeCandidates, logicalSolve, TECH_INFO, rowOf, colOf } from '../engine/index.ts';
import type { Grid, SolveStep } from '../engine/types.ts';

export interface CandidateProgress {
  readonly baseline: readonly number[];
  readonly steps: readonly SolveStep[];
  readonly applied: number;
  readonly grid: Grid;
  readonly candidates: number[];
  readonly history: readonly SolveStep[];
  readonly next: SolveStep | undefined;
}

/** 每次人工编辑建立新基线；矛盾盘面不产生可应用的轨迹。 */
export function createCandidateProgress(grid: readonly number[]): CandidateProgress {
  const baseline = grid.slice();
  const candidates = computeCandidates(baseline);
  const invalid = baseline.some((value, cell) => value
    ? PEERS[cell].some((peer) => baseline[peer] === value)
    : candidates[cell] === 0);
  const steps = invalid ? [] : logicalSolve(baseline).steps;
  return replayCandidateProgress({ baseline, steps }, 0);
}

/** 始终从基线重放原始步骤；不能对中途盘面重新求解，否则会丢失候选删除。 */
export function replayCandidateProgress(
  trace: Pick<CandidateProgress, 'baseline' | 'steps'>,
  applied: number,
): CandidateProgress {
  const count = Math.max(0, Math.min(trace.steps.length, Math.trunc(applied)));
  const grid = trace.baseline.slice();
  const candidates = computeCandidates(grid);
  const history = trace.steps.slice(0, count);
  for (const step of history) {
    if (step.cell !== undefined && step.digit !== undefined) {
      grid[step.cell] = step.digit;
      candidates[step.cell] = 0;
      for (const peer of PEERS[step.cell]) candidates[peer] &= ~bit(step.digit);
    }
    for (const [cell, digit] of step.eliminations ?? []) candidates[cell] &= ~bit(digit);
  }
  return { baseline: trace.baseline, steps: trace.steps, applied: count, grid, candidates, history, next: trace.steps[count] };
}

export function editCandidateProgress(progress: CandidateProgress, cell: number, value: number): CandidateProgress {
  const grid = progress.grid.slice();
  grid[cell] = value;
  return createCandidateProgress(grid);
}

/** 按格生成删除说明，避免对不同格的候选做笛卡尔积式描述。 */
export function describeCandidateStep(step: SolveStep): string {
  const info = TECH_INFO[step.technique];
  const name = info?.ja ?? step.technique;
  if (step.cell !== undefined && step.digit !== undefined) {
    return `数字確定 — ${name}：${info?.desc(step) ?? `${rowOf(step.cell) + 1}行${colOf(step.cell) + 1}列を${step.digit}で確定します。`}`;
  }
  const grouped = new Map<number, Array<[number, number]>>();
  for (const [cell, digit] of step.eliminations ?? []) {
    const entries = grouped.get(cell) ?? [];
    entries.push([cell, digit]);
    grouped.set(cell, entries);
  }
  return `候補削除 — ${name}：${[...grouped.values()].map((eliminations) => info?.desc({ ...step, eliminations }) ?? eliminations.map(([cell, digit]) => `${rowOf(cell) + 1}行${colOf(cell) + 1}列の候補${digit}を削除します。`).join('')).join(' ')} 数字はまだ確定しません。`;
}

export function candidateRemoval(progress: CandidateProgress, cell: number, digit: number): { step: SolveStep; number: number } | undefined {
  const index = progress.history.findIndex((step) => step.eliminations?.some(([target, removed]) => target === cell && removed === digit));
  return index < 0 ? undefined : { step: progress.history[index], number: index + 1 };
}
