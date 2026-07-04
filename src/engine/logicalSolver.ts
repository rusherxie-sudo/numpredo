// 人类技巧求解器：逐级技巧链，是难度评级 / 提示 / 攻略演示的共用核心。
// 始终优先用最简单技巧；记录所用最难技巧与加权步数 → 难度。
import type { Grid, SolveResult, SolveStep } from './types.ts';
import { type BoardContext, CELLS, MASK_ALL, STANDARD_CONTEXT, bit, boxOf, colOf, digitsOf, isSolved, popcount, rowOf } from './board.ts';
import { TECH_WEIGHT } from './difficulty.ts';

interface State {
  g: Grid;
  cand: number[]; // 每空格候选位掩码；已填格为 0
  ctx: BoardContext; // units/peers 来源（标准 or 变体）——unit 内推理对任意 unit 集合 sound
}

/** 落子并联动消除关联格候选 */
function place(s: State, i: number, d: number): void {
  s.g[i] = d;
  s.cand[i] = 0;
  for (const p of s.ctx.peers[i]) s.cand[p] &= ~bit(d);
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
  for (const u of s.ctx.units) {
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

/** 行 r / 列 c / 宫 b 的 9 格坐标（lockedCandidates 的消除目标线） */
function lineCells(kind: 'row' | 'col' | 'box', k: number): number[] {
  if (kind === 'row') return Array.from({ length: 9 }, (_, c) => k * 9 + c);
  if (kind === 'col') return Array.from({ length: 9 }, (_, r) => r * 9 + k);
  const br = (k / 3) | 0;
  const bc = k % 3;
  const out: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push((br * 3 + r) * 9 + (bc * 3 + c));
  return out;
}

/**
 * 区块（指向 pointing ＋ 声明 claiming）：某数在 unit 内的候选若同时全落在另一条「行/列/宫」，
 * 该数必在两者交集内 → 从那条线的 unit 外格消除。
 * unit=宫、候选共行/列 → 指向；unit=行/列、候选共宫 → 声明。
 * （容器恰为 unit 自身时全部被 inUnit 过滤，无害空转——换取三方向统一处理，不再漏 claiming。）
 */
function lockedCandidates(s: State): SolveStep | null {
  for (const u of s.ctx.units) {
    const empties = emptyCellsOf(s, u);
    for (let d = 1; d <= 9; d++) {
      const cells = empties.filter((c) => s.cand[c] & bit(d));
      if (cells.length < 2) continue;
      const containers: Array<['row' | 'col' | 'box', number] | null> = [
        cells.every((c) => rowOf(c) === rowOf(cells[0])) ? ['row', rowOf(cells[0])] : null,
        cells.every((c) => colOf(c) === colOf(cells[0])) ? ['col', colOf(cells[0])] : null,
        cells.every((c) => boxOf(c) === boxOf(cells[0])) ? ['box', boxOf(cells[0])] : null,
      ];
      const inUnit = new Set(u);
      for (const cont of containers) {
        if (!cont) continue;
        const acc: Array<[number, number]> = [];
        for (const t of lineCells(cont[0], cont[1])) if (!inUnit.has(t)) eliminate(s, t, d, acc);
        if (acc.length) return { technique: 'lockedCandidates', eliminations: acc };
      }
    }
  }
  return null;
}

function nakedPair(s: State): SolveStep | null {
  for (const u of s.ctx.units) {
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
  for (const u of s.ctx.units) {
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
  for (const u of s.ctx.units) {
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

/**
 * Swordfish：X-Wing 的三阶推广。某数在三条基线（行 or 列）各落在 2〜3 处，且其跨线的
 * 列（行）并集**恰为 3**（无鳍 finless）→ 这三条覆盖线的其他格消除该数。
 * 正确性：三基行的该数候选全落在 3 列内，列唯一性 ⇒ 三行的三个该数一一占满这 3 列 →
 * 其他行的这 3 列不可能再放该数。基线取 2〜3 处（1 处已被 hiddenSingle 处理、且并集必<3 无意义）。
 */
function swordfish(s: State): SolveStep | null {
  for (let d = 1; d <= 9; d++) {
    // 行向：每行该数的候选列；取候选数 2〜3 的行做基线，找并集恰为 3 列的三行
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) if (s.g[r * 9 + c] === 0 && s.cand[r * 9 + c] & bit(d)) cols.push(c);
      rowCols[r] = cols;
    }
    const baseRows: number[] = [];
    for (let r = 0; r < 9; r++) if (rowCols[r].length === 2 || rowCols[r].length === 3) baseRows.push(r);
    for (let i = 0; i < baseRows.length; i++)
      for (let j = i + 1; j < baseRows.length; j++)
        for (let k = j + 1; k < baseRows.length; k++) {
          const rs = [baseRows[i], baseRows[j], baseRows[k]];
          const cols = new Set<number>([...rowCols[rs[0]], ...rowCols[rs[1]], ...rowCols[rs[2]]]);
          if (cols.size !== 3) continue;
          const rowsSet = new Set(rs);
          const acc: Array<[number, number]> = [];
          for (const c of cols) for (let r = 0; r < 9; r++) if (!rowsSet.has(r)) eliminate(s, r * 9 + c, d, acc);
          if (acc.length) return { technique: 'swordfish', eliminations: acc };
        }
    // 列向对称
    const colRows: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) if (s.g[r * 9 + c] === 0 && s.cand[r * 9 + c] & bit(d)) rows.push(r);
      colRows[c] = rows;
    }
    const baseCols: number[] = [];
    for (let c = 0; c < 9; c++) if (colRows[c].length === 2 || colRows[c].length === 3) baseCols.push(c);
    for (let i = 0; i < baseCols.length; i++)
      for (let j = i + 1; j < baseCols.length; j++)
        for (let k = j + 1; k < baseCols.length; k++) {
          const cs = [baseCols[i], baseCols[j], baseCols[k]];
          const rows = new Set<number>([...colRows[cs[0]], ...colRows[cs[1]], ...colRows[cs[2]]]);
          if (rows.size !== 3) continue;
          const colsSet = new Set(cs);
          const acc: Array<[number, number]> = [];
          for (const r of rows) for (let c = 0; c < 9; c++) if (!colsSet.has(c)) eliminate(s, r * 9 + c, d, acc);
          if (acc.length) return { technique: 'swordfish', eliminations: acc };
        }
  }
  return null;
}

/**
 * Skyscraper（单数字链）：某数在两条线（行 or 列）各恰 2 处，一端共享同一「交叉线」(base)、
 * 另一端(roof)落在不同交叉线上 → base 交叉线最多容一个该数 ⇒ 两个 roof 至少一真 ⇒
 * 同时能「看到」两个 roof 的格(共同 peer)不可能是该数，消除之。
 * 用 ctx.peers 求共同可见格 → 対角線変体でも sound（対角線越しに両 roof を見るマスも消せる）。
 */
function skyscraper(s: State): SolveStep | null {
  const cross = (byRow: boolean, i: number): number => (byRow ? colOf(i) : rowOf(i));
  for (const byRow of [true, false]) {
    for (let d = 1; d <= 9; d++) {
      // 每条线上该数恰 2 个候选的，记录其两端坐标
      const lines: number[][] = [];
      for (let a = 0; a < 9; a++) {
        const cs: number[] = [];
        for (let b = 0; b < 9; b++) {
          const i = byRow ? a * 9 + b : b * 9 + a;
          if (s.g[i] === 0 && s.cand[i] & bit(d)) cs.push(i);
        }
        if (cs.length === 2) lines.push(cs);
      }
      for (let x = 0; x < lines.length; x++)
        for (let y = x + 1; y < lines.length; y++) {
          const L1 = lines[x];
          const L2 = lines[y];
          // 两端各试作 base：一端共享交叉线(base)、另一端不共享(roof)
          for (const e1 of [0, 1])
            for (const e2 of [0, 1]) {
              const base1 = L1[e1];
              const roof1 = L1[1 - e1];
              const base2 = L2[e2];
              const roof2 = L2[1 - e2];
              if (cross(byRow, base1) !== cross(byRow, base2)) continue; // base 必须同一交叉线
              if (cross(byRow, roof1) === cross(byRow, roof2)) continue; // roof 必须不同交叉线（否则退化为 X-Wing）
              const p1 = new Set(s.ctx.peers[roof1]);
              const acc: Array<[number, number]> = [];
              for (const t of s.ctx.peers[roof2]) {
                if (t === roof1 || t === roof2) continue;
                if (p1.has(t)) eliminate(s, t, d, acc);
              }
              if (acc.length) return { technique: 'skyscraper', eliminations: acc };
            }
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
  swordfish,
  skyscraper,
];

/**
 * 技巧链名单（与 TECHNIQUES 一一对应，新增技巧时同步）。
 * demo.ts 用它断言 TECH_WEIGHT / TECH_INFO 键完备——缺键会被静默兜底成权重 1（初級），必须有守卫。
 */
export const TECHNIQUE_NAMES: readonly string[] = [
  'nakedSingle', 'hiddenSingle', 'lockedCandidates', 'nakedPair', 'hiddenPair', 'nakedTriple', 'xWing', 'swordfish', 'skyscraper',
];
// 双数组脱节即时爆炸（不能用 fn.name 派生——客户端 minify 会改函数名；length 比较不受影响）
if (TECHNIQUES.length !== TECHNIQUE_NAMES.length) {
  throw new Error(`TECHNIQUES(${TECHNIQUES.length}) 与 TECHNIQUE_NAMES(${TECHNIQUE_NAMES.length}) 数量脱节——新增技巧时两处同步`);
}

/**
 * 仅用已实现的人类技巧求解（不猜测）。
 * solved=false 表示需要比 X-Wing 更高级的技巧或猜测 → 视为超出当前可保障范围。
 */
export function logicalSolve(grid: Grid, ctx: BoardContext = STANDARD_CONTEXT): SolveResult {
  const s = initState(grid, ctx);

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

  // isSolved 校验合法性而非仅「填满」：若未来技巧引入 unsound 消除填出错解，这里不再放行
  return { solved: isSolved(s.g, ctx), grid: s.g, steps, techniqueCounts, hardest, score };
}

function initState(grid: Grid, ctx: BoardContext): State {
  const s: State = { g: grid.slice(), cand: new Array(CELLS).fill(0), ctx };
  for (let i = 0; i < CELLS; i++) {
    if (s.g[i] !== 0) continue;
    let m = MASK_ALL;
    for (const p of ctx.peers[i]) if (s.g[p]) m &= ~bit(s.g[p]);
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
  ctx: BoardContext = STANDARD_CONTEXT,
): { grid: Grid; candidates: number[]; step: SolveStep } | null {
  const s = initState(grid, ctx);
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
 * 选步优先级：消除型「難しい一手」> hiddenSingle（起步示例·限量）> nakedSingle（纯单数题兜底）。
 */
export function traceKeySteps(
  grid: Grid,
  opts: { maxSteps?: number } = {},
  ctx: BoardContext = STANDARD_CONTEXT,
): Array<{ grid: Grid; candidates: number[]; step: SolveStep }> {
  const { maxSteps = 8 } = opts;
  const s = initState(grid, ctx);
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
    // 消去型の難点はすべて見せ、起步の隠れた単数は最多2手だけ添える（図解を難点に集中、雷同図を避ける）
    const keep = new Set<(typeof all)[number]>([...elim, ...hidden.slice(0, Math.min(maxSteps - elim.length, 2))]);
    return all.filter((x) => keep.has(x)).slice(0, maxSteps); // 保持解题原序
  }
  if (hidden.length > 0) return hidden.slice(0, maxSteps);
  return all.slice(0, Math.min(maxSteps, 4)); // 纯裸単的极初级题：展示前几手起步
}
