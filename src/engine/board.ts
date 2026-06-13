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

/** 全部 27 个单元 */
export const UNITS: number[][] = buildUnits();

/** 每格所属的 3 个单元（行/列/宫）在 UNITS 中的下标 */
export const UNITS_OF: number[][] = (() => {
  const map: number[][] = Array.from({ length: CELLS }, () => []);
  UNITS.forEach((u, ui) => u.forEach((cell) => map[cell].push(ui)));
  return map;
})();

/** 每格的 20 个关联格（同行/列/宫去重去自身） */
export const PEERS: number[][] = (() => {
  const peers: number[][] = [];
  for (let i = 0; i < CELLS; i++) {
    const s = new Set<number>();
    for (const ui of UNITS_OF[i]) for (const cell of UNITS[ui]) if (cell !== i) s.add(cell);
    peers.push([...s]);
  }
  return peers;
})();

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
export function canPlace(g: Grid, i: number, d: number): boolean {
  for (const p of PEERS[i]) if (g[p] === d) return false;
  return true;
}

/** 计算每格候选位掩码（已填格为 0） */
export function computeCandidates(g: Grid): number[] {
  const cand = new Array<number>(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (g[i] !== 0) continue;
    let m = MASK_ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    cand[i] = m;
  }
  return cand;
}

/** 完整且每格合法 → 已解出 */
export function isSolved(g: Grid): boolean {
  if (g.some((v) => v === 0)) return false;
  for (const u of UNITS) {
    let seen = 0;
    for (const c of u) seen |= bit(g[c]);
    if (seen !== MASK_ALL) return false;
  }
  return true;
}
