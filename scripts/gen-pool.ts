// 統一題庫生成：一次产出全部难度题库 + daily 序列，提交进 git（build 不再生成、部署稳定）。
// 各档严格按 levelOf 入桶（保证难度标签真实），各档大小 = daily 该档出现天数。
// daily.json = 全题库打乱（每天随机一档，难度偏中间有梯度）。
// 题库需要重新生成/调整时手动运行：node scripts/gen-pool.ts
import { writeFileSync } from 'node:fs';
import {
  type DifficultyLevel,
  generatePuzzle,
  gridToString,
  hasUniqueSolution,
  logicalSolve,
  LEVEL_META,
} from '../src/engine/index.ts';

interface PuzzleRecord {
  clues: number;
  hardest: string;
  puzzle: string;
  solution: string;
  level: DifficultyLevel;
}

const OUT = 'src/data/puzzles';
const ORDER: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];

// daily 难度分布（365天，每天随机一档，偏中间有梯度）；同时即各档题库大小。
const TARGET: Record<DifficultyLevel, number> = {
  beginner: 55, // 15%
  intermediate: 90, // 25%
  advanced: 110, // 30%
  hard: 73, // 20%
  extreme: 37, // 10%
};

const buckets: Record<DifficultyLevel, PuzzleRecord[]> = {
  beginner: [], intermediate: [], advanced: [], hard: [], extreme: [],
};
const full = (l: DifficultyLevel) => buckets[l].length >= TARGET[l];
const allFull = () => ORDER.every(full);

let gen = 0;
const t0 = Date.now();
console.log('統一題庫生成（各档 levelOf 严格入桶、唯一解 + 純論理可解）…');
console.log('  目标:', ORDER.map((l) => `${LEVEL_META[l].ja}${TARGET[l]}`).join(' '));

while (!allFull()) {
  const p = generatePuzzle();
  gen++;
  if (full(p.level)) continue;
  // 入桶门槛双断言（与原 build 一致）
  if (!hasUniqueSolution(p.puzzle) || !logicalSolve(p.puzzle).solved) continue;
  buckets[p.level].push({
    clues: p.clues,
    hardest: p.hardest,
    puzzle: gridToString(p.puzzle),
    solution: gridToString(p.solution),
    level: p.level,
  });
  if (gen % 3000 === 0) {
    console.log(`  ${gen} 次:`, ORDER.map((l) => `${LEVEL_META[l].ja}${buckets[l].length}/${TARGET[l]}`).join(' '));
  }
}

// 各档 level.json（play 用）
for (const l of ORDER) {
  writeFileSync(
    `${OUT}/${l}.json`,
    JSON.stringify({ level: l, ja: LEVEL_META[l].ja, count: buckets[l].length, puzzles: buckets[l] }, null, 2),
  );
}

// daily.json = 全题库打乱（每天随机一档）
const all = ORDER.flatMap((l) => buckets[l]);
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [all[i], all[j]] = [all[j], all[i]];
}
writeFileSync(`${OUT}/daily.json`, JSON.stringify({ name: 'daily', count: all.length, puzzles: all }, null, 2));

const dt = (Date.now() - t0) / 1000;
console.log(`✓ 完成：${gen} 次生成、${dt.toFixed(1)}s`);
console.log('  各档:', ORDER.map((l) => `${LEVEL_META[l].ja}${buckets[l].length}`).join(' '), `→ daily ${all.length} 題`);
