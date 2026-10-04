// Build-only: reuse the publicly reproducible analysis; no puzzle order changes.
import { readFileSync } from 'node:fs';
import { LEVELS } from './levels.ts';
import { PUZZLE_TECHNIQUES, type LibraryPuzzle } from './puzzle-techniques.ts';
const lines = readFileSync('public/data/numpredo-puzzle-analysis.csv', 'utf8').trim().split('\n');
const header = lines.shift()!.split(',');
export const PUZZLE_LIBRARY: Record<string, LibraryPuzzle[]> = Object.fromEntries(LEVELS.map(l => [l.slug, []]));
for (const line of lines) {
  const fields = line.split(',');
  const row = Object.fromEntries(header.map((key, i) => [key, fields[i]]));
  if (!PUZZLE_LIBRARY[row.level]) throw new Error(`Unknown analysis level: ${row.level}`);
  PUZZLE_LIBRARY[row.level].push({ n: Number(row.puzzle_id), clues: Number(row.clues), steps: Number(row.logical_steps), hardest: row.hardest_technique, techniques: PUZZLE_TECHNIQUES.filter(t => Number(row[t.key]) > 0).map(t => t.key) });
}
for (const level of LEVELS) {
  const rows = PUZZLE_LIBRARY[level.slug];
  if (rows.length !== level.puzzles.length || rows.some((r, i) => r.n !== i + 1 || r.clues !== [...level.puzzles[i].puzzle].filter(c => /[1-9]/.test(c)).length)) throw new Error(`Analysis needs regeneration: ${level.slug}`);
}
