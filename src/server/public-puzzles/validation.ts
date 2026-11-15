import { STANDARD_CONTEXT, bit, popcount } from '../../engine/board.ts';
import { SOLVER_SAMPLE } from '../../data/solver-sample.ts';

export type ValidationStatus = 'unique' | 'pending_validation' | 'conflict' | 'unsolvable' | 'multiple' | 'empty' | 'complete' | 'known_example';
export function normalizeGrid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9.]{81}$/.test(value)) throw new Error('invalid_grid');
  return value.replaceAll('.', '0');
}
/** 复用标准引擎上下文；节点上限同时约束无解及恶意难题，不能用 Promise 超时中断同步回溯。 */
export function validateGrid(grid: string, maxNodes = 20000): { status: ValidationStatus; nodes: number } {
  const g = [...grid].map(Number);
  const result = (status: ValidationStatus) => ({ status, nodes });
  let nodes = 0;
  if (g.every(v => v === 0)) return result('empty');
  for (const unit of STANDARD_CONTEXT.units) {
    let seen = 0;
    for (const i of unit) if (g[i]) { const b = bit(g[i]); if (seen & b) return result('conflict'); seen |= b; }
  }
  if (g.every(Boolean)) return result('complete');
  if (grid === SOLVER_SAMPLE.replaceAll('.', '0')) return result('known_example');
  let count = 0, exhausted = false;
  function solve(): void {
    if (++nodes > maxNodes) { exhausted = true; return; }
    let best = -1, mask = 0, size = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      let m = 511;
      for (const p of STANDARD_CONTEXT.peers[i]) if (g[p]) m &= ~bit(g[p]);
      const n = popcount(m);
      if (!n) return;
      if (n < size) { best = i; mask = m; size = n; if (n === 1) break; }
    }
    if (best < 0) { count++; return; }
    for (let d = 1; d <= 9; d++) if (mask & bit(d)) {
      g[best] = d; solve(); g[best] = 0;
      if (count >= 2 || exhausted) return;
    }
  }
  solve();
  return result(exhausted ? 'pending_validation' : count === 0 ? 'unsolvable' : count === 1 ? 'unique' : 'multiple');
}
export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
}
export interface SourceClaim { kind: 'newspaper' | 'other'; newspaper?: string; publicationDate?: string; edition?: string; issue?: string; doubleCells?: number[] }
export function parseSource(value: unknown, now = new Date()): SourceClaim | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_source');
  const s = value as Record<string, unknown>;
  if (!['newspaper', 'other'].includes(String(s.kind))) throw new Error('invalid_source');
  const out: SourceClaim = { kind: s.kind as SourceClaim['kind'] };
  if (s.newspaper !== undefined) {
    if (!['yomiuri', 'asahi', 'mainichi', 'nikkei', 'chunichi', 'other'].includes(String(s.newspaper))) throw new Error('invalid_newspaper');
    out.newspaper = String(s.newspaper);
  }
  if (s.publicationDate !== undefined) {
    const date = String(s.publicationDate);
    const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today) throw new Error('invalid_publication_date');
    out.publicationDate = date;
  }
  for (const key of ['edition', 'issue'] as const) if (s[key] !== undefined) {
    if (typeof s[key] !== 'string' || s[key].length > 80 || /[<>\x00-\x1f]/.test(s[key])) throw new Error('invalid_source_text');
    out[key] = s[key];
  }
  if (s.doubleCells !== undefined) {
    const cells = s.doubleCells;
    if (!Array.isArray(cells) || cells.length !== 2 || cells[0] === cells[1] || !cells.every(v => Number.isInteger(v) && v >= 0 && v < 81)) throw new Error('invalid_double_cells');
    out.doubleCells = cells;
  }
  return out;
}
