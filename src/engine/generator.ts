// 题目生成器：完整解 → 中心对称挖空。
// 每挖一步都要求「唯一解 + 逻辑可解(no-guessing)」，从源头保证品质。
import type { DifficultyLevel, Grid, Puzzle } from './types.ts';
import { CELLS, MASK_ALL, PEERS, bit, digitsOf, popcount } from './board.ts';
import { hasUniqueSolution } from './countSolver.ts';
import { logicalSolve } from './logicalSolver.ts';
import { levelOf } from './difficulty.ts';

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 随机回溯生成一个合法完整解 */
export function fullSolution(): Grid {
  const g = new Array<number>(CELLS).fill(0);
  const rec = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i] !== 0) continue;
      let m = MASK_ALL;
      for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
      const c = popcount(m);
      if (c === 0) return false;
      if (c < bestCount) {
        bestCount = c;
        bestMask = m;
        best = i;
      }
    }
    if (best === -1) return true;
    for (const d of shuffle(digitsOf(bestMask))) {
      g[best] = d;
      if (rec()) return true;
      g[best] = 0;
    }
    return false;
  };
  rec();
  return g;
}

/** 中心对称的挖空顺序（成对，中心格单独一组） */
function symmetricGroups(): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i <= 40; i++) {
    const j = CELLS - 1 - i;
    groups.push(i === j ? [i] : [i, j]);
  }
  return groups;
}

/**
 * 生成一道题：尽可能挖空，同时始终保持唯一解 + 逻辑可解。
 * 难度由「挖空后求解所需的最难技巧」自然涌现，再分类。
 */
export function generatePuzzle(minClues = 17): Puzzle {
  const solution = fullSolution();
  const puzzle = solution.slice();
  let clues = 81;

  for (const group of shuffle(symmetricGroups())) {
    if (clues - group.length < minClues) continue; // 挖到提示下限即停（控制填充度→难度）
    if (group.every((i) => puzzle[i] === 0)) continue;
    const backup = group.map((i) => puzzle[i]);
    for (const i of group) puzzle[i] = 0;
    // 必须同时满足：唯一解（先验，快）+ 仅靠人类技巧可解（no-guessing）
    if (!hasUniqueSolution(puzzle) || !logicalSolve(puzzle).solved) {
      group.forEach((i, k) => (puzzle[i] = backup[k]));
    } else {
      clues -= group.length;
    }
  }

  const res = logicalSolve(puzzle);
  return {
    puzzle,
    solution,
    level: levelOf(res),
    clues: puzzle.filter((v) => v !== 0).length,
    score: res.score,
    hardest: res.hardest ?? 'nakedSingle',
    techniqueCounts: res.techniqueCounts,
  };
}

/**
 * 尝试生成指定难度的题。现有技巧链（至 X-Wing）下，越高难度命中越稀有，
 * 故反复生成并取目标档；超过 maxAttempts 返回最接近的一道（不抛错）。
 */
/** 各档提示数下限（题库生成的**单一来源**，gen-pool 也 import 此常量）：低档多提示·新手友好，高档挖到稀疏·逼出高级技巧。 */
export const LEVEL_MIN_CLUES: Record<DifficultyLevel, number> = {
  beginner: 38, intermediate: 31, advanced: 28, hard: 17, extreme: 17,
};

export function generateByLevel(level: DifficultyLevel, maxAttempts = 80): { puzzle: Puzzle; hit: boolean; attempts: number } {
  const order: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];
  const target = order.indexOf(level);
  const minClues = LEVEL_MIN_CLUES[level];
  let closest: Puzzle | null = null;
  let closestDiff = 99;
  for (let a = 1; a <= maxAttempts; a++) {
    const p = generatePuzzle(minClues);
    if (p.level === level) return { puzzle: p, hit: true, attempts: a };
    const diff = Math.abs(order.indexOf(p.level) - target);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = p;
    }
  }
  return { puzzle: closest as Puzzle, hit: false, attempts: maxAttempts };
}
