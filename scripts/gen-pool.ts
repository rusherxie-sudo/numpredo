// 統一題庫生成：一次产出全部难度题库 + daily 序列，提交进 git（build 不再生成、部署稳定）。
// 各档严格按 levelOf 入桶（难度标签真实），并按难度设定「提示数下限 minClues」：
//   低档留更多提示（盘面满、对新手友好），高档挖到稀疏（逼出高级技巧）。
//   提示数随难度递减；同档加 maxScore 上限，抑制极端难题、缓解跨档难度倒挂。
// daily.json = 全题库打乱（每天随机一档，难度偏中间有梯度）。
// 题库需要重新生成/调整时手动运行：node scripts/gen-pool.ts
import { writeFileSync } from 'node:fs';
import {
  type DifficultyLevel,
  generatePuzzle,
  gridToString,
  hasUniqueSolution,
  logicalSolve,
  levelOf,
  LEVEL_META,
} from '../src/engine/index.ts';

interface PuzzleRecord {
  clues: number;
  hardest: string;
  score: number;
  puzzle: string;
  solution: string;
  level: DifficultyLevel;
}

const OUT = 'src/data/puzzles';
const ORDER: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];

// 各档配置：题数 + 提示下限（控制填充度→难度梯度）+ score 上限（抑制同档极端难题）。
// minClues 高 → 挖得浅 → 提示多、简单；低 → 挖到稀疏 → 逼出高级技巧。
const CFG: Record<DifficultyLevel, { count: number; minClues: number; maxScore: number }> = {
  beginner: { count: 55, minClues: 38, maxScore: Infinity }, // 38提示·纯single·新手友好
  intermediate: { count: 90, minClues: 31, maxScore: Infinity },
  advanced: { count: 110, minClues: 28, maxScore: 92 }, // 排除用过多pair的"伪难"题
  hard: { count: 73, minClues: 17, maxScore: Infinity },
  extreme: { count: 37, minClues: 17, maxScore: Infinity },
};

const buckets: Record<DifficultyLevel, PuzzleRecord[]> = {
  beginner: [], intermediate: [], advanced: [], hard: [], extreme: [],
};

const t0 = Date.now();
console.log('統一題庫生成（各档提示下限 + levelOf 严格入桶）…');

for (const lv of ORDER) {
  const { count, minClues, maxScore } = CFG[lv];
  let attempts = 0;
  while (buckets[lv].length < count) {
    const p = generatePuzzle(minClues);
    attempts++;
    if (p.level !== lv) continue;
    if (p.score > maxScore) continue;
    if (!hasUniqueSolution(p.puzzle) || !logicalSolve(p.puzzle).solved) continue;
    buckets[lv].push({
      clues: p.clues,
      hardest: p.hardest,
      score: p.score,
      puzzle: gridToString(p.puzzle),
      solution: gridToString(p.solution),
      level: lv,
    });
  }
  const avgClues = (buckets[lv].reduce((s, r) => s + r.clues, 0) / count).toFixed(0);
  console.log(`  ✓ ${LEVEL_META[lv].ja.padEnd(3)} ${count}題（提示avg${avgClues}・${attempts}次尝试）`);
}

// 各档 level.json（play 用）
for (const lv of ORDER) {
  writeFileSync(
    `${OUT}/${lv}.json`,
    JSON.stringify({ level: lv, ja: LEVEL_META[lv].ja, count: buckets[lv].length, puzzles: buckets[lv] }, null, 2),
  );
}

// daily.json = 全题库打乱（每天随机一档）
const all = ORDER.flatMap((lv) => buckets[lv]);
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [all[i], all[j]] = [all[j], all[i]];
}
writeFileSync(`${OUT}/daily.json`, JSON.stringify({ name: 'daily', count: all.length, puzzles: all }, null, 2));

console.log(`✓ 完成 ${((Date.now() - t0) / 1000).toFixed(1)}s → daily ${all.length} 題`);
