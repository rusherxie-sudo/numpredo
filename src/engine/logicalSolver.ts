// 人类技巧求解器：逐级技巧链，是难度评级 / 提示 / 攻略演示的共用核心。
// 始终优先用最简单技巧；记录所用最难技巧与加权步数 → 难度。
import type { Grid, SolveResult, SolveStep } from './types.ts';
import { CELLS, MASK_ALL, PEERS, UNITS, bit, boxOf, colOf, digitsOf, popcount, rowOf } from './board.ts';
import { TECH_WEIGHT } from './difficulty.ts';

interface State {
  g: Grid;
  cand: number[]; // 每空格候选位掩码；已填格为 0
}

/** 落子并联动消除关联格候选 */
function place(s: State, i: number, d: number): void {
  s.g[i] = d;
  s.cand[i] = 0;
  for (const p of PEERS[i]) s.cand[p] &= ~bit(d);
}

/** 真正消除一个候选位时返回 true（已消除则 false），用于避免空转 */
function eliminate(s: State, i: number, d: number, acc: Array<[number, number]>): boolean {
  if (s.g[i] === 0 && s.cand[i] & bit(d)) {
    s.cand[i] &= ~bit(d);
    acc.push([i, d]);
    return true;
  }
  return false;
}

const emptyCellsOf = (s: State, unit: number[]): number[] => unit.filter((c) => s.g[c] === 0);

// ---- 各技巧：执行「一次」推理，成功返回 step，否则 null ----

function nakedSingle(s: State): SolveStep | null {
  for (let i = 0; i < CELLS; i++) {
    if (s.g[i] === 0 && popcount(s.cand[i]) === 1) {
      const d = digitsOf(s.cand[i])[0];
      place(s, i, d);
      return { technique: 'nakedSingle', cell: i, digit: d };
    }
  }
  return null;
}

function hiddenSingle(s: State): SolveStep | null {
  for (const u of UNITS) {
    for (let d = 1; d <= 9; d++) {
      let spot = -1;
      let n = 0;
      for (const c of u) {
        if (s.g[c] === 0 && s.cand[c] & bit(d)) {
          n++;
          spot = c;
        }
      }
      if (n === 1) {
        place(s, spot, d);
        return { technique: 'hiddenSingle', cell: spot, digit: d };
      }
    }
  }
  return null;
}

/** 区块（指向/声明）：某数候选被锁在一行/列与某宫的交集内，向外消除 */
function lockedCandidates(s: State): SolveStep | null {
  for (const u of UNITS) {
    const empties = emptyCellsOf(s, u);
    for (let d = 1; d <= 9; d++) {
      const cells = empties.filter((c) => s.cand[c] & bit(d));
      if (cells.length < 2) continue;
      // 该数候选是否共一行 / 一列 / 一宫
      const r0 = rowOf(cells[0]);
      const c0 = colOf(cells[0]);
      const b0 = boxOf(cells[0]);
      const sameRow = cells.every((c) => rowOf(c) === r0);
      const sameCol = cells.every((c) => colOf(c) === c0);
      const sameBox = cells.every((c) => boxOf(c) === b0);
      const acc: Array<[number, number]> = [];
      // 找到一条与当前 unit 不同的「线/宫」做消除目标（u 自身会被 inUnit 过滤掉）
      const targets: number[] = [];
      if (sameRow) {
        for (let c = 0; c < 9; c++) targets.push(r0 * 9 + c);
      } else if (sameCol) {
        for (let r = 0; r < 9; r++) targets.push(r * 9 + c0);
      } else if (sameBox) {
        const br = (b0 / 3) | 0;
        const bc = b0 % 3;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) targets.push((br * 3 + r) * 9 + (bc * 3 + c));
      } else continue;
      const inUnit = new Set(u);
      for (const t of targets) if (!inUnit.has(t)) eliminate(s, t, d, acc);
      if (acc.length) return { technique: 'lockedCandidates', eliminations: acc };
    }
  }
  return null;
}

function nakedPair(s: State): SolveStep | null {
  for (const u of UNITS) {
    const empties = emptyCellsOf(s, u);
    const pairs = empties.filter((c) => popcount(s.cand[c]) === 2);
    for (let a = 0; a < pairs.length; a++)
      for (let b = a + 1; b < pairs.length; b++) {
        if (s.cand[pairs[a]] !== s.cand[pairs[b]]) continue;
        const mask = s.cand[pairs[a]];
        const ds = digitsOf(mask);
        const acc: Array<[number, number]> = [];
        for (const c of empties) {
          if (c === pairs[a] || c === pairs[b]) continue;
          for (const d of ds) eliminate(s, c, d, acc);
        }
        if (acc.length) return { technique: 'nakedPair', eliminations: acc };
      }
  }
  return null;
}

function hiddenPair(s: State): SolveStep | null {
  for (const u of UNITS) {
    const empties = emptyCellsOf(s, u);
    for (let d1 = 1; d1 <= 8; d1++)
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const c1 = empties.filter((c) => s.cand[c] & bit(d1));
        const c2 = empties.filter((c) => s.cand[c] & bit(d2));
        if (c1.length !== 2 || c2.length !== 2) continue;
        if (c1[0] !== c2[0] || c1[1] !== c2[1]) continue;
        const keep = bit(d1) | bit(d2);
        const acc: Array<[number, number]> = [];
        for (const c of c1) {
          for (const d of digitsOf(s.cand[c] & ~keep)) eliminate(s, c, d, acc);
        }
        if (acc.length) return { technique: 'hiddenPair', eliminations: acc };
      }
  }
  return null;
}

function nakedTriple(s: State): SolveStep | null {
  for (const u of UNITS) {
    const empties = emptyCellsOf(s, u).filter((c) => {
      const p = popcount(s.cand[c]);
      return p === 2 || p === 3;
    });
    for (let a = 0; a < empties.length; a++)
      for (let b = a + 1; b < empties.length; b++)
        for (let cc = b + 1; cc < empties.length; cc++) {
          const union = s.cand[empties[a]] | s.cand[empties[b]] | s.cand[empties[cc]];
          if (popcount(union) !== 3) continue;
          const ds = digitsOf(union);
          const trio = new Set([empties[a], empties[b], empties[cc]]);
          const acc: Array<[number, number]> = [];
          for (const c of emptyCellsOf(s, u)) {
            if (trio.has(c)) continue;
            for (const d of ds) eliminate(s, c, d, acc);
          }
          if (acc.length) return { technique: 'nakedTriple', eliminations: acc };
        }
  }
  return null;
}

/** X-Wing：某数在两行恰好落在相同两列（各 2 处）→ 该两列其他行消除；列向对称 */
function xWing(s: State): SolveStep | null {
  for (let d = 1; d <= 9; d++) {
    // 行向
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) if (s.g[r * 9 + c] === 0 && s.cand[r * 9 + c] & bit(d)) cols.push(c);
      rowCols[r] = cols;
    }
    for (let r1 = 0; r1 < 9; r1++) {
      if (rowCols[r1].length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (rowCols[r2].length !== 2) continue;
        if (rowCols[r1][0] !== rowCols[r2][0] || rowCols[r1][1] !== rowCols[r2][1]) continue;
        const [ca, cb] = rowCols[r1];
        const acc: Array<[number, number]> = [];
        for (let r = 0; r < 9; r++) {
          if (r === r1 || r === r2) continue;
          eliminate(s, r * 9 + ca, d, acc);
          eliminate(s, r * 9 + cb, d, acc);
        }
        if (acc.length) return { technique: 'xWing', eliminations: acc };
      }
    }
    // 列向
    const colRows: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) if (s.g[r * 9 + c] === 0 && s.cand[r * 9 + c] & bit(d)) rows.push(r);
      colRows[c] = rows;
    }
    for (let c1 = 0; c1 < 9; c1++) {
      if (colRows[c1].length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        if (colRows[c2].length !== 2) continue;
        if (colRows[c1][0] !== colRows[c2][0] || colRows[c1][1] !== colRows[c2][1]) continue;
        const [ra, rb] = colRows[c1];
        const acc: Array<[number, number]> = [];
        for (let c = 0; c < 9; c++) {
          if (c === c1 || c === c2) continue;
          eliminate(s, ra * 9 + c, d, acc);
          eliminate(s, rb * 9 + c, d, acc);
        }
        if (acc.length) return { technique: 'xWing', eliminations: acc };
      }
    }
  }
  return null;
}

/** 技巧链：易 → 难 */
const TECHNIQUES: Array<(s: State) => SolveStep | null> = [
  nakedSingle,
  hiddenSingle,
  lockedCandidates,
  nakedPair,
  hiddenPair,
  nakedTriple,
  xWing,
];

/**
 * 仅用已实现的人类技巧求解（不猜测）。
 * solved=false 表示需要比 X-Wing 更高级的技巧或猜测 → 视为超出当前可保障范围。
 */
export function logicalSolve(grid: Grid): SolveResult {
  const s: State = { g: grid.slice(), cand: new Array(CELLS).fill(0) };
  // 初始化候选
  for (let i = 0; i < CELLS; i++) {
    if (s.g[i] !== 0) continue;
    let m = MASK_ALL;
    for (const p of PEERS[i]) if (s.g[p]) m &= ~bit(s.g[p]);
    s.cand[i] = m;
  }

  const steps: SolveStep[] = [];
  const techniqueCounts: Record<string, number> = {};
  let score = 0;
  let hardestWeight = 0;
  let hardest: string | null = null;

  // 矛盾检测：空格无候选 → 该盘非法
  const contradiction = (): boolean => {
    for (let i = 0; i < CELLS; i++) if (s.g[i] === 0 && s.cand[i] === 0) return true;
    return false;
  };

  outer: while (s.g.includes(0)) {
    if (contradiction()) break;
    for (const tech of TECHNIQUES) {
      const step = tech(s);
      if (step) {
        steps.push(step);
        const w = TECH_WEIGHT[step.technique] ?? 1;
        techniqueCounts[step.technique] = (techniqueCounts[step.technique] ?? 0) + 1;
        score += w;
        if (w > hardestWeight) {
          hardestWeight = w;
          hardest = step.technique;
        }
        continue outer;
      }
    }
    break; // 无技巧可推进
  }

  return { solved: !s.g.includes(0), grid: s.g, steps, techniqueCounts, hardest, score };
}

function initState(grid: Grid): State {
  const s: State = { g: grid.slice(), cand: new Array(CELLS).fill(0) };
  for (let i = 0; i < CELLS; i++) {
    if (s.g[i] !== 0) continue;
    let m = MASK_ALL;
    for (const p of PEERS[i]) if (s.g[p]) m &= ~bit(s.g[p]);
    s.cand[i] = m;
  }
  return s;
}

/**
 * 沿技巧链推进，捕获「第一个产生候选消除的步骤」及其**执行前**的盘面/候选快照。
 * 供攻略图解使用：渲染消除前的候选盘 + 高亮该技巧消除的候选 → 精确演示，且来自引擎真实推理。
 */
export function traceFirstElimination(
  grid: Grid,
): { grid: Grid; candidates: number[]; step: SolveStep } | null {
  const s = initState(grid);
  while (s.g.includes(0)) {
    let advanced = false;
    for (const tech of TECHNIQUES) {
      const candPrev = s.cand.slice();
      const gPrev = s.g.slice();
      const step = tech(s);
      if (step) {
        if (step.eliminations && step.eliminations.length) {
          return { grid: gPrev, candidates: candPrev, step };
        }
        advanced = true; // 填入型步骤（裸単/隐単），继续推进
        break;
      }
    }
    if (!advanced) break;
  }
  return null;
}

/**
 * 沿技巧链推进，捕获「每个关键步」执行前的盘面/候选快照 + 该步。供题目图解页逐步演示。
 * 关键步 = 消除型步骤（有 eliminations）；includeSingles 时，纯填入型题也收代表单数步，避免空页。
 */
export function traceKeySteps(
  grid: Grid,
  opts: { maxSteps?: number } = {},
): Array<{ grid: Grid; candidates: number[]; step: SolveStep }> {
  const { maxSteps = 8 } = opts;
  const s = initState(grid);
  // 先完整推演，收集每一步「执行前」的盘面/候选快照（保持解题顺序）。
  const all: Array<{ grid: Grid; candidates: number[]; step: SolveStep }> = [];
  while (s.g.includes(0)) {
    let advanced = false;
    for (const tech of TECHNIQUES) {
      const candPrev = s.cand.slice();
      const gPrev = s.g.slice();
      const step = tech(s);
      if (step) {
        all.push({ grid: gPrev, candidates: candPrev, step });
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }
  // 选步优先级：消除型「難しい一手」 > hiddenSingle（有教学价值） > nakedSingle（trivial）。
  // 解题前期多是裸単填入，难点技巧在中后期——必须按技巧重要性选，而非取开头 N 步。
  const elim = all.filter((x) => x.step.eliminations && x.step.eliminations.length);
  if (elim.length >= maxSteps) return elim.slice(0, maxSteps);
  const hidden = all.filter((x) => x.step.technique === 'hiddenSingle');
  if (elim.length > 0) {
    const keep = new Set<(typeof all)[number]>([...elim, ...hidden.slice(0, maxSteps - elim.length)]);
    return all.filter((x) => keep.has(x)).slice(0, maxSteps); // 保持解题原序
  }
  if (hidden.length > 0) return hidden.slice(0, maxSteps);
  return all.slice(0, Math.min(maxSteps, 4)); // 纯裸単的极初级题：展示前几手起步
}
