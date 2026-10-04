import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gridFromString, logicalSolve, countSolutions } from '../src/engine/index.ts';
import { PUZZLE_TECHNIQUES } from '../src/data/puzzle-techniques.ts';
const lines = readFileSync('public/data/numpredo-puzzle-analysis.csv', 'utf8').trim().split('\n');
const header = lines.shift()!.split(',');
const rows = lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [header[i], v])));
let count = 0;
for (const level of ['beginner', 'intermediate', 'advanced', 'hard', 'extreme']) {
  const puzzles: Array<{ puzzle: string; solution: string }> = JSON.parse(readFileSync(`src/data/puzzles/${level}.json`, 'utf8')).puzzles;
  const analysis = rows.filter(r => r.level === level);
  assert.equal(analysis.length, puzzles.length);
  for (const [i, puzzle] of puzzles.entries()) {
    const row = analysis[i], grid = gridFromString(puzzle.puzzle), result = logicalSolve(grid);
    assert.equal(Number(row.puzzle_id), i + 1, `${level}: stable number`);
    assert.equal(countSolutions(grid.slice(), 2), 1, `${level}/${i + 1}: unique solution`);
    assert.ok(result.solved); assert.equal(result.grid.join(''), puzzle.solution);
    assert.equal(Number(row.clues), grid.filter(Boolean).length);
    assert.equal(Number(row.logical_steps), result.steps.length);
    assert.equal(row.hardest_technique, result.hardest);
    for (const t of PUZZLE_TECHNIQUES) assert.equal(Number(row[t.key]), result.techniqueCounts[t.key] ?? 0, `${level}/${i + 1}: ${t.key}`);
    count++;
  }
}
assert.equal(count, 4395);
console.log(`✓ ${count} playable library puzzles: stable IDs, unique solutions, logical completion, and all filter metadata verified`);
