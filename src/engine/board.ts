// 棋盘工具：坐标、单元(units)、关联格(peers)、候选位掩码
import type { Grid } from './types.ts';

export const N = 9;
export const CELLS = 81;
/** 9 个数字全集的位掩码：bit(d) = 1 << (d-1)，0b111111111 = 511 */
export const MASK_ALL = 0x1ff;

export const rowOf = (i: number): number => (i / N) | 0;
export const colOf = (i: number): number => i % N;
export const boxOf = (i: number): number => 3 * ((rowOf(i) / 3) | 0) + ((colOf(i) / 3) | 0);
export const idx = (r: number, c: number): number => r * N + c;

/** 数字 d(1..9) 的位 */
export const bit = (d: number): number => 1 << (d - 1);

/** 位掩码中 1 的个数（候选数量） */
export function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

/** 位掩码 → 数字数组（升序） */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= N; d++) if (mask & bit(d)) out.push(d);
  return out;
}

// ---- 预计算 27 个单元（9 行 + 9 列 + 9 宫）----
function buildUnits(): number[][] {
  const units: number[][] = [];
  for (let r = 0; r < N; r++) units.push(Array.from({ length: N }, (_, c) => idx(r, c)));
  for (let c = 0; c < N; c++) units.push(Array.from({ length: N }, (_, r) => idx(r, c)));
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const u: number[] = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push(idx(br * 3 + r, bc * 3 + c));
      units.push(u);
    }
  return units;
}

/**
 * 棋盘上下文：一套 units 及其派生的 unitsOf/peers。
 * 标准数独 = 27 units；变体（如対角線）= 27 + 附加单元。
 * 求解器/生成器全链以 ctx 为准（默认 STANDARD_CONTEXT），变体只是「多几个 unit 的另一个实例」，
 * 不在引擎里开特殊分支——unit 内推理（单数/对/三链）对任意 unit 集合天然 sound。
 */
export interface BoardContext {
  /** 全部单元：标准 27（9行+9列+9宫）＋ 变体附加单元 */
  units: number[][];
  /** 每格所属单元在 units 中的下标 */
  unitsOf: number[][];
  /** 每格关联格（同 unit 去重去自身；标准数独恒 20 个，变体更多） */
  peers: number[][];
}

/** 由「标准 27 units + 附加 units」构建上下文（unitsOf/peers 一并派生） */
export function buildContext(extraUnits: number[][] = []): BoardContext {
  const units = [...buildUnits(), ...extraUnits];
  const unitsOf: number[][] = Array.from({ length: CELLS }, () => []);
  units.forEach((u, ui) => u.forEach((cell) => unitsOf[cell].push(ui)));
  const peers: number[][] = [];
  for (let i = 0; i < CELLS; i++) {
    const s = new Set<number>();
    for (const ui of unitsOf[i]) for (const cell of units[ui]) if (cell !== i) s.add(cell);
    peers.push([...s]);
  }
  return { units, unitsOf, peers };
}

/** 标准 9×9 数独上下文（全部默认参数的单一来源） */
export const STANDARD_CONTEXT: BoardContext = buildContext();

/** 対角線数独的两条附加单元：主对角线(r==c) + 副对角线(r+c==8)，交于中心格 40 */
export const DIAGONAL_UNITS: number[][] = [
  Array.from({ length: N }, (_, r) => idx(r, r)),
  Array.from({ length: N }, (_, r) => idx(r, N - 1 - r)),
];

/** 対角線数独上下文（标准 27 units + 2 条对角线） */
export const DIAGONAL_CONTEXT: BoardContext = buildContext(DIAGONAL_UNITS);

/** 全部 27 个单元（= STANDARD_CONTEXT.units，向后兼容别名） */
export const UNITS: number[][] = STANDARD_CONTEXT.units;

/** 每格所属的 3 个单元（行/列/宫）在 UNITS 中的下标 */
export const UNITS_OF: number[][] = STANDARD_CONTEXT.unitsOf;

/** 每格的 20 个关联格（同行/列/宫去重去自身） */
export const PEERS: number[][] = STANDARD_CONTEXT.peers;

// ---- 序列化 ----
export const cloneGrid = (g: Grid): Grid => g.slice();

/** 从字符串建盘：'.'/'0' 视为空，其余取数字 */
export function gridFromString(s: string): Grid {
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (cleaned.length !== CELLS) throw new Error(`grid string length ${cleaned.length} != 81`);
  return [...cleaned].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
}

/** 转单行字符串（空格记 '.'） */
export const gridToString = (g: Grid): string => g.map((v) => (v === 0 ? '.' : v)).join('');

/** 校验某数能否合法填入某空格 */
export function canPlace(g: Grid, i: number, d: number, ctx: BoardContext = STANDARD_CONTEXT): boolean {
  for (const p of ctx.peers[i]) if (g[p] === d) return false;
  return true;
}

/** 计算每格候选位掩码（已填格为 0） */
export function computeCandidates(g: Grid, ctx: BoardContext = STANDARD_CONTEXT): number[] {
  const cand = new Array<number>(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== 0) continue;
    let m = MASK_ALL;
    for (const p of ctx.peers[i]) if (g[p]) m &= ~bit(g[p]);
    cand[i] = m;
  }
  return cand;
}

/** 完整且每格合法 → 已解出（变体 ctx 下同时校验附加单元，如对角线） */
export function isSolved(g: Grid, ctx: BoardContext = STANDARD_CONTEXT): boolean {
  if (g.some((v) => v === 0)) return false;
  for (const u of ctx.units) {
    let seen = 0;
    for (const c of u) seen |= bit(g[c]);
    if (seen !== MASK_ALL) return false;
  }
  return true;
}
