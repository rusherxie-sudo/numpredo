// 唯一解校验：回溯计数，最多数到 limit（默认 2）即停 —— 用于品质断言「解数 === 1」
import type { Grid } from './types.ts';
import { CELLS, MASK_ALL, PEERS, UNITS, bit, popcount } from './board.ts';

/** given 之间是否已违反数独规则（同一行/列/宫出现重复数字）。
 * 矛盾输入会让回溯指数爆炸（卡死页面），必须前置拦截。 */
function givensConflict(grid: Grid): boolean {
  for (const u of UNITS) {
    let seen = 0;
    for (const i of u) {
      if (grid[i] !== 0) {
        const b = bit(grid[i]);
        if (seen & b) return true;
        seen |= b;
      }
    }
  }
  return false;
}

/**
 * 统计 grid 的解的个数，至多统计到 limit。
 * 返回 0（无解）/ 1（唯一解）/ >=2（多解，达到 limit 即返回）。
 * 采用 MRV 启发式（优先填候选最少的空格）以加速。
 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (givensConflict(grid)) return 0; // 矛盾的 given → 无解（且避免指数爆炸）
  const g = grid.slice();
  let count = 0;

  const solve = (): void => {
    if (count >= limit) return;

    // 选候选最少的空格（MRV）
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i] !== 0) continue;
      let m = MASK_ALL;
      for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
      const c = popcount(m);
      if (c === 0) return; // 此空格无候选 → 死路
      if (c < bestCount) {
        bestCount = c;
        bestMask = m;
        best = i;
        if (c === 1) break;
      }
    }

    if (best === -1) {
      // 无空格 → 找到一个完整解
      count++;
      return;
    }

    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      g[best] = d;
      solve();
      g[best] = 0;
      if (count >= limit) return;
    }
  };

  solve();
  return count;
}

/** 是否唯一解 */
export const hasUniqueSolution = (grid: Grid): boolean => countSolutions(grid, 2) === 1;

/** 求任意一个完整解（无解返回 null）—— 供生成器取解 */
export function solveOne(grid: Grid): Grid | null {
  if (givensConflict(grid)) return null; // 矛盾的 given → 无解（且避免指数爆炸）
  const g = grid.slice();
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
        if (c === 1) break;
      }
    }
    if (best === -1) return true;
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      g[best] = d;
      if (rec()) return true;
      g[best] = 0;
    }
    return false;
  };
  return rec() ? g : null;
}
