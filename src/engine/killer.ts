// キラー数独（加算数独）变体：cage（虚线框）约束模型 + 专用求解/生成。
//
// 架构决策（为什么 cage 不能进 ctx.units）：
//   units 语义 = 「9 格且集齐 1..9」——isSolved 要求 unit 集齐 MASK_ALL、hiddenSingle 假设
//   每个数字必在 unit 内出现,对 2〜4 格的 cage 都不成立(会产生 unsound 推理)。
//   cage 的「组内不重复」通过 **peers 注入** 复用(对任意不重复组 sound):裸单/裸对等
//   peers 类消去自动获益;「和」约束则由本模块的 cageCombo 技巧与专用回溯器单独执行。
// 标准路径零影响:本模块自成一体,不改 countSolver/generator 的任何行为。
import type { DifficultyLevel, Grid, SolveResult, SolveStep } from './types.ts';
import { type BoardContext, CELLS, MASK_ALL, STANDARD_CONTEXT, bit, digitsOf, popcount } from './board.ts';
import { type State, type TechniqueFn, eliminate, logicalSolve } from './logicalSolver.ts';
import { fullSolution } from './generator.ts';
import { levelOf } from './difficulty.ts';

export interface KillerCage {
  /** 所属格下标（2〜4 格为主,允许极少量 1 格兜底 cage） */
  cells: number[];
  /** cage 内数字之和 */
  sum: number;
}

export interface KillerContext {
  /** 标准 27 units + cage 同僚并入 peers 的棋盘上下文(供 logicalSolve/技巧链使用) */
  ctx: BoardContext;
  cages: KillerCage[];
  /** 每格所属 cage 下标（cages 必须恰好划分 81 格） */
  cageOf: number[];
}

/** 由 cage 划分构建 killer 上下文；校验 cages 恰好覆盖 81 格且互不重叠 */
export function buildKillerContext(cages: KillerCage[]): KillerContext {
  const cageOf = new Array<number>(CELLS).fill(-1);
  cages.forEach((cg, ci) => {
    for (const c of cg.cells) {
      if (c < 0 || c >= CELLS) throw new Error(`cage 含非法格下标 ${c}`);
      if (cageOf[c] !== -1) throw new Error(`格 ${c} 被多个 cage 占用`);
      cageOf[c] = ci;
    }
  });
  const missing = cageOf.indexOf(-1);
  if (missing !== -1) throw new Error(`格 ${missing} 未被任何 cage 覆盖`);
  // peers = 标准 peers ∪ cage 同僚（cage 内不重复 → 同僚关系 sound）
  const std = STANDARD_CONTEXT;
  const peers = std.peers.map((ps, i) => {
    const s = new Set(ps);
    for (const c of cages[cageOf[i]].cells) if (c !== i) s.add(c);
    return [...s];
  });
  return { ctx: { units: std.units, unitsOf: std.unitsOf, peers }, cages, cageOf };
}

/** cage 当前状态：已填数字掩码/和 + 空格清单；组内重复返回 null（非法盘面） */
function cageState(g: Grid, cage: KillerCage): { mask: number; sum: number; empties: number[] } | null {
  let mask = 0;
  let sum = 0;
  const empties: number[] = [];
  for (const c of cage.cells) {
    const v = g[c];
    if (v === 0) empties.push(c);
    else {
      const b = bit(v);
      if (mask & b) return null;
      mask |= b;
      sum += v;
    }
  }
  return { mask, sum, empties };
}

/**
 * 枚举 cage 空格的全部合法完成方式（数字取自各格候选、组内不重复、总和恰为 cage.sum），
 * 返回每个空格在**至少一个**合法组合中出现的数字掩码。某空格掩码为 0 ⇒ 当前局面矛盾。
 * cage ≤ 5 格 → 枚举成本可忽略。这是 killer 的核心消去来源（cage 单格/两格和/组合分析全被子。
 */
export function cageFeasibleMasks(cage: KillerCage, g: Grid, cand: number[]): number[] | null {
  const st = cageState(g, cage);
  if (st === null) return null;
  const { mask: usedMask, sum: usedSum, empties } = st;
  if (empties.length === 0) return usedSum === cage.sum ? [] : null;
  const need = cage.sum - usedSum;
  const k = empties.length;
  const feasible = new Array<number>(k).fill(0);
  // DFS：按空格顺序尝试候选数字（组内去重 + 和剪枝）
  const pick = new Array<number>(k).fill(0);
  const rec = (pos: number, used: number, sum: number): void => {
    if (pos === k) {
      if (sum === need) for (let t = 0; t < k; t++) feasible[t] |= bit(pick[t]);
      return;
    }
    const remain = k - pos;
    for (const d of digitsOf(cand[empties[pos]])) {
      const b = bit(d);
      if (used & b) continue;
      const s2 = sum + d;
      // 和剪枝：剩余格至少各填 1（互异 → 最小 1+2+..），至多 9+8+..（粗界已足够）
      const restMin = minSumDistinct(remain - 1, used | b);
      const restMax = maxSumDistinct(remain - 1, used | b);
      if (s2 + restMin > need || s2 + restMax < need) continue;
      pick[pos] = d;
      rec(pos + 1, used | b, s2);
    }
  };
  rec(0, usedMask, 0);
  return feasible;
}

/** 从 1..9 中避开 usedMask 取 n 个互异数字的最小和 */
function minSumDistinct(n: number, usedMask: number): number {
  let s = 0;
  for (let d = 1; d <= 9 && n > 0; d++) if (!(usedMask & bit(d))) { s += d; n--; }
  return n > 0 ? Infinity : s;
}

/** 从 1..9 中避开 usedMask 取 n 个互异数字的最大和 */
function maxSumDistinct(n: number, usedMask: number): number {
  let s = 0;
  for (let d = 9; d >= 1 && n > 0; d--) if (!(usedMask & bit(d))) { s += d; n--; }
  return n > 0 ? -Infinity : s;
}

/** killer 专用技巧：逐 cage 枚举合法组合,把「不在任何合法组合内」的候选消去 */
export function makeCageComboTechnique(kctx: KillerContext): TechniqueFn {
  return (s: State): SolveStep | null => {
    for (const cage of kctx.cages) {
      const feas = cageFeasibleMasks(cage, s.g, s.cand);
      if (feas === null) return null; // 盘面已矛盾——交给外层 contradiction 检测终止
      const empties = cage.cells.filter((c) => s.g[c] === 0);
      const acc: Array<[number, number]> = [];
      empties.forEach((c, t) => {
        for (const d of digitsOf(s.cand[c] & ~feas[t])) eliminate(s, c, d, acc);
      });
      if (acc.length) return { technique: 'cageCombo', eliminations: acc };
    }
    return null;
  };
}

/** 完整盘面是否满足全部 cage 约束（组内不重复 + 和相等） */
export function cagesSatisfied(g: Grid, kctx: KillerContext): boolean {
  for (const cage of kctx.cages) {
    const st = cageState(g, cage);
    if (st === null || st.empties.length > 0 || st.sum !== cage.sum) return false;
  }
  return true;
}

/** killer 逻辑求解：标准技巧链 + cageCombo；solved 需同时满足标准 units 与 cage 约束 */
export function logicalSolveKiller(grid: Grid, kctx: KillerContext): SolveResult {
  const res = logicalSolve(grid, kctx.ctx, [makeCageComboTechnique(kctx)]);
  if (res.solved && !cagesSatisfied(res.grid, kctx)) return { ...res, solved: false };
  return res;
}

/**
 * killer 解数统计（至多数到 limit）。MRV 回溯 + cage 剪枝：
 * 试填时检查所在 cage 的部分和上下界；cage 填满时强制和相等——保证计数精确。
 * ⚠ 与 countSolutions 同款风险：矛盾输入可能指数爆炸,limit 必传（默认 2）,given 冲突前置拦截。
 */
export function countSolutionsKiller(grid: Grid, kctx: KillerContext, limit = 2): number {
  if (killerGivensConflict(grid, kctx)) return 0;
  const g = grid.slice();
  const { cages, cageOf } = kctx;
  const peers = kctx.ctx.peers;
  let count = 0;

  const cageAllows = (i: number, d: number): boolean => {
    const cage = cages[cageOf[i]];
    const st = cageState(g, cage)!; // g[i]==0 时组内无重复由 peers 保证,此处必非 null
    const s2 = st.sum + d;
    const rest = st.empties.length - 1; // 除 i 外剩余空格
    if (rest === 0) return s2 === cage.sum;
    const used = st.mask | bit(d);
    return s2 + minSumDistinct(rest, used) <= cage.sum && s2 + maxSumDistinct(rest, used) >= cage.sum;
  };

  const solve = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i] !== 0) continue;
      let m = MASK_ALL;
      for (const p of peers[i]) if (g[p]) m &= ~bit(g[p]);
      const c = popcount(m);
      if (c === 0) return;
      if (c < bestCount) {
        bestCount = c;
        bestMask = m;
        best = i;
        if (c === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      if (!cageAllows(best, d)) continue;
      g[best] = d;
      solve();
      g[best] = 0;
      if (count >= limit) return;
    }
  };

  solve();
  return count;
}

/** given 是否已违反 killer 规则（peers 重复涵盖行/列/宫/cage;另查 cage 部分和越界） */
function killerGivensConflict(grid: Grid, kctx: KillerContext): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0) continue;
    for (const p of kctx.ctx.peers[i]) if (p > i && grid[p] === grid[i]) return true;
  }
  for (const cage of kctx.cages) {
    const st = cageState(grid, cage);
    if (st === null) return true;
    const k = st.empties.length;
    if (k === 0) {
      if (st.sum !== cage.sum) return true;
    } else if (
      st.sum + minSumDistinct(k, st.mask) > cage.sum ||
      st.sum + maxSumDistinct(k, st.mask) < cage.sum
    ) return true;
  }
  return false;
}

// ---- 生成 ----

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 正交邻居 */
function neighborsOf(i: number): number[] {
  const out: number[] = [];
  const r = (i / 9) | 0;
  const c = i % 9;
  if (r > 0) out.push(i - 9);
  if (r < 8) out.push(i + 9);
  if (c > 0) out.push(i - 1);
  if (c < 8) out.push(i + 1);
  return out;
}

/**
 * 把完整解随机划分为连通 cage（目标 2〜4 格;组内数字互异是 killer 规则的硬前提）。
 * 生长失败的孤格优先并入相邻 cage（数字不冲突且并后 ≤5 格）,实在不行保留 1 格 cage
 * （sum=其数字,等效直接提示——极少出现,对可解性无害）。
 */
export function generateKillerCages(solution: Grid): KillerCage[] {
  const cageIdx = new Array<number>(CELLS).fill(-1);
  const cages: number[][] = [];
  for (const seed of shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
    if (cageIdx[seed] !== -1) continue;
    const target = [2, 2, 3, 3, 3, 4][Math.floor(Math.random() * 6)];
    const cells = [seed];
    let digits = bit(solution[seed]);
    cageIdx[seed] = cages.length;
    while (cells.length < target) {
      const frontier = shuffle(
        cells.flatMap(neighborsOf).filter((n) => cageIdx[n] === -1 && !(digits & bit(solution[n]))),
      );
      if (!frontier.length) break;
      const pick = frontier[0];
      cells.push(pick);
      digits |= bit(solution[pick]);
      cageIdx[pick] = cages.length;
    }
    cages.push(cells);
  }
  // 孤格并入相邻小 cage（数字不冲突）
  for (let i = 0; i < cages.length; i++) {
    if (cages[i].length > 1) continue;
    const cell = cages[i][0];
    const host = neighborsOf(cell)
      .map((n) => cageIdx[n])
      .find((ci) => ci !== i && cages[ci].length < 5 && !cages[ci].some((c) => solution[c] === solution[cell]));
    if (host !== undefined) {
      cages[host].push(cell);
      cageIdx[cell] = host;
      cages[i] = [];
    }
  }
  return cages
    .filter((cs) => cs.length > 0)
    .map((cs) => ({ cells: cs.sort((a, b) => a - b), sum: cs.reduce((s, c) => s + solution[c], 0) }));
}

export interface KillerPuzzle {
  puzzle: Grid;
  solution: Grid;
  cages: KillerCage[];
  level: DifficultyLevel;
  clues: number;
  score: number;
  hardest: string;
  techniqueCounts: Record<string, number>;
}

/** 中心对称挖空顺序（与 generator.ts 同款;成对,中心格单独一组） */
function symmetricGroups(): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i <= 40; i++) {
    const j = CELLS - 1 - i;
    groups.push(i === j ? [i] : [i, j]);
  }
  return groups;
}

/**
 * 生成一道 killer 题：完整解 → cage 划分 → 对称挖空。
 * 每挖一步保持「唯一解（killer 约束下）+ 逻辑可解（标准链+cageCombo,不猜测）」——与标准题同一品质门。
 * minClues 控制填充度:killer 的 cage 和是强力隐形提示,可挖得比标准题深（下限需实测标定）。
 */
export function generateKillerPuzzle(minClues = 10): KillerPuzzle {
  const solution = fullSolution();
  const cages = generateKillerCages(solution);
  const kctx = buildKillerContext(cages);
  const puzzle = solution.slice();
  let clues = CELLS;

  for (const group of shuffle(symmetricGroups())) {
    if (clues - group.length < minClues) continue;
    if (group.every((i) => puzzle[i] === 0)) continue;
    const backup = group.map((i) => puzzle[i]);
    for (const i of group) puzzle[i] = 0;
    if (countSolutionsKiller(puzzle, kctx, 2) !== 1 || !logicalSolveKiller(puzzle, kctx).solved) {
      group.forEach((i, k) => (puzzle[i] = backup[k]));
    } else {
      clues -= group.length;
    }
  }

  const res = logicalSolveKiller(puzzle, kctx);
  return {
    puzzle,
    solution,
    cages,
    level: levelOf(res),
    clues: puzzle.filter((v) => v !== 0).length,
    score: res.score,
    hardest: res.hardest ?? 'nakedSingle',
    techniqueCounts: res.techniqueCounts,
  };
}
