// 每日一题池：一次性生成并提交进 git（确定性来自「生成一次入库」，不随每次 build 变化）。
// daily.json 纳入版本控制、build 流程不再覆盖它 → 部署稳定・全員同日同題・一年（365 題）不重複。
// 客户端按当天日期 mod 365 确定性选题（全员同日同题）。
// 题库需要重新生成/扩充时，手动运行：node scripts/gen-daily.ts
import { writeFileSync } from 'node:fs';
import { generateByLevel, gridToString, hasUniqueSolution, logicalSolve } from '../src/engine/index.ts';

interface PuzzleRecord {
  clues: number;
  hardest: string;
  puzzle: string;
  solution: string;
}

const OUT = 'src/data/puzzles/daily.json';
const COUNT = 365;

const records: PuzzleRecord[] = [];
let attempts = 0;
const t0 = Date.now();

console.log(`毎日一題プール生成（${COUNT} 題、唯一解 + 純論理可解を保証）…`);
while (records.length < COUNT) {
  const { puzzle } = generateByLevel('advanced', 50);
  attempts++;
  if (!puzzle || !hasUniqueSolution(puzzle.puzzle) || !logicalSolve(puzzle.puzzle).solved) continue;
  records.push({
    clues: puzzle.clues,
    hardest: puzzle.hardest,
    puzzle: gridToString(puzzle.puzzle),
    solution: gridToString(puzzle.solution),
  });
  if (records.length % 50 === 0) console.log(`  ${records.length}/${COUNT}…`);
}

writeFileSync(OUT, JSON.stringify({ name: 'daily', count: COUNT, puzzles: records }, null, 2));
console.log(`✓ 毎日 ${COUNT} 題 → ${OUT}（${attempts} 次生成尝试、${((Date.now() - t0) / 1000).toFixed(1)}s）`);
