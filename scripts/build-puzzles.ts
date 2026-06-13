// 构建期题库生成：用引擎离线生成各难度题库 JSON（存 src/data/puzzles/）。
// 每题通过品质断言（唯一解 + 纯逻辑可解）。运行：node scripts/build-puzzles.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  type DifficultyLevel,
  LEVEL_META,
  generateByLevel,
  gridToString,
  hasUniqueSolution,
  logicalSolve,
} from '../src/engine/index.ts';

interface PuzzleRecord {
  clues: number;
  hardest: string;
  puzzle: string; // 81 字符，'.' 为空
  solution: string;
}

const OUT_DIR = 'src/data/puzzles';
mkdirSync(OUT_DIR, { recursive: true });

// 生成全部五档。難問/超難問在现有技巧链下命中稀有，generateByLevel 取最接近，
// 仍保证「唯一解 + 纯逻辑可解」，难度后续随高级技巧扩充而提升。
const PLAN: Array<{ level: DifficultyLevel; count: number }> = [
  { level: 'beginner', count: 12 },
  { level: 'intermediate', count: 12 },
  { level: 'advanced', count: 12 },
  { level: 'hard', count: 8 },
  { level: 'extreme', count: 8 },
];

console.log('构建期题库生成（每题断言唯一解 + 纯逻辑可解）…');
const t0 = Date.now();

for (const { level, count } of PLAN) {
  const records: PuzzleRecord[] = [];
  let attempts = 0;
  while (records.length < count) {
    const { puzzle } = generateByLevel(level, 60);
    attempts++;
    if (!puzzle) continue;
    // 品质双断言（入库门槛）
    if (!hasUniqueSolution(puzzle.puzzle)) continue;
    if (!logicalSolve(puzzle.puzzle).solved) continue;
    records.push({
      clues: puzzle.clues,
      hardest: puzzle.hardest,
      puzzle: gridToString(puzzle.puzzle),
      solution: gridToString(puzzle.solution),
    });
  }
  const file = `${OUT_DIR}/${level}.json`;
  writeFileSync(file, JSON.stringify({ level, ja: LEVEL_META[level].ja, count, puzzles: records }, null, 2));
  console.log(`  ✓ ${LEVEL_META[level].ja.padEnd(3)} ${count} 题 → ${file}（${attempts} 次生成尝试）`);
}

// 每日一题池：客户端按当天日期确定性选题（全员同日同題）。30 題＝约一个月不重复。
const dailyCount = 30;
const dailyRecords: PuzzleRecord[] = [];
let dailyAttempts = 0;
while (dailyRecords.length < dailyCount) {
  const { puzzle } = generateByLevel('advanced', 50);
  dailyAttempts++;
  if (!puzzle || !hasUniqueSolution(puzzle.puzzle) || !logicalSolve(puzzle.puzzle).solved) continue;
  dailyRecords.push({
    clues: puzzle.clues,
    hardest: puzzle.hardest,
    puzzle: gridToString(puzzle.puzzle),
    solution: gridToString(puzzle.solution),
  });
}
writeFileSync(`${OUT_DIR}/daily.json`, JSON.stringify({ name: 'daily', count: dailyCount, puzzles: dailyRecords }, null, 2));
console.log(`  ✓ 毎日  ${dailyCount} 題 → ${OUT_DIR}/daily.json（${dailyAttempts} 次生成尝试）`);

console.log(`完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
