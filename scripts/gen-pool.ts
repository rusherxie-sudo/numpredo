// 統一題庫生成：一次产出全部难度题库 + daily 序列，提交进 git（build 不再生成、部署稳定）。
// 各档严格按 levelOf 入桶（难度标签真实），并按难度设定「提示数下限 minClues」：
//   低档留更多提示（盘面满、对新手友好），高档挖到稀疏（逼出高级技巧）。
//   提示数随难度递减；同档加 maxScore 上限，抑制极端难题、缓解跨档难度倒挂。
// daily.json = 全题库打乱（每天随机一档，难度偏中间有梯度）。
// 题库需要重新生成/调整时手动运行：node scripts/gen-pool.ts
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import {
  type DifficultyLevel,
  generatePuzzle,
  gridToString,
  hasUniqueSolution,
  logicalSolve,
  levelOf,
  LEVEL_META,
  LEVEL_MIN_CLUES,
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

// 各档配置：题数 + score 上限（抑制同档极端难题）。提示下限 minClues 统一取自引擎的
// LEVEL_MIN_CLUES（单一来源，与 generateByLevel 共用，避免两份常量漂移）。
const CFG: Record<DifficultyLevel, { count: number; maxScore: number }> = {
  beginner: { count: 85, maxScore: Infinity }, // 38提示·纯single·新手友好
  intermediate: { count: 120, maxScore: Infinity },
  advanced: { count: 135, maxScore: 92 }, // 排除用过多pair的"伪难"题
  hard: { count: 95, maxScore: Infinity },
  extreme: { count: 50, maxScore: Infinity },
};

// 追加模式：读入现有题库作基础（保留已出页/已收录的题，顺序不变），只补到新 count。
const buckets: Record<DifficultyLevel, PuzzleRecord[]> = {
  beginner: [], intermediate: [], advanced: [], hard: [], extreme: [],
};
for (const lv of ORDER) {
  const f = `${OUT}/${lv}.json`;
  if (existsSync(f)) buckets[lv] = (JSON.parse(readFileSync(f, 'utf-8')).puzzles ?? []) as PuzzleRecord[];
}

const t0 = Date.now();
console.log('統一題庫生成（各档提示下限 + levelOf 严格入桶）…');

for (const lv of ORDER) {
  const { count, maxScore } = CFG[lv];
  const minClues = LEVEL_MIN_CLUES[lv];
  const seen = new Set(buckets[lv].map((r) => r.puzzle)); // 去重：新题不与现有题重复
  const before = buckets[lv].length;
  let attempts = 0;
  while (buckets[lv].length < count) {
    const p = generatePuzzle(minClues);
    attempts++;
    if (p.level !== lv) continue;
    if (p.score > maxScore) continue;
    const ps = gridToString(p.puzzle);
    if (seen.has(ps)) continue;
    if (!hasUniqueSolution(p.puzzle) || !logicalSolve(p.puzzle).solved) continue;
    seen.add(ps);
    buckets[lv].push({
      clues: p.clues,
      hardest: p.hardest,
      score: p.score,
      puzzle: ps,
      solution: gridToString(p.solution),
      level: lv,
    });
  }
  const avgClues = (buckets[lv].reduce((s, r) => s + r.clues, 0) / buckets[lv].length).toFixed(0);
  console.log(`  ✓ ${LEVEL_META[lv].ja.padEnd(3)} ${count}題（現有${before}+新${count - before}・提示avg${avgClues}・${attempts}次尝试）`);
}

// 各档 level.json（play 用）
for (const lv of ORDER) {
  writeFileSync(
    `${OUT}/${lv}.json`,
    JSON.stringify({ level: lv, ja: LEVEL_META[lv].ja, count: buckets[lv].length, puzzles: buckets[lv] }, null, 2),
  );
}

// daily.json = 全题库を生成期に一度だけシャッフルした「固定スナップショット」（結果は git 提交で不変）。
// 「日替わり」の確定性は、クライアントが JST 日付インデックスで選題して担保する（生成側の乱数は再現性なしで可）。
const all = ORDER.flatMap((lv) => buckets[lv]);
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [all[i], all[j]] = [all[j], all[i]];
}
writeFileSync(`${OUT}/daily.json`, JSON.stringify({ name: 'daily', count: all.length, puzzles: all }, null, 2));

console.log(`✓ 完成 ${((Date.now() - t0) / 1000).toFixed(1)}s → daily ${all.length} 題`);
