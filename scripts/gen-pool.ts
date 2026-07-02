// 統一題庫生成：一次产出全部难度题库 + daily 序列，提交进 git（build 不再生成、部署稳定）。
// 各档严格按 levelOf 入桶（难度标签真实），并按难度设定「提示数下限 minClues」：
//   低档留更多提示（盘面满、对新手友好），高档挖到稀疏（逼出高级技巧）。
//   提示数随难度递减；同档加 maxScore 上限，抑制极端难题、缓解跨档难度倒挂。
// daily.json = 前缀稳定追加（既存顺序不变+新题乱序追加，扩库不漂移当日选题；每天随机一档，难度有梯度）。
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
  // hard 上限压 score 尾部倒挂（2026-07 重建后 hard max=141 > extreme max=114）。
  // 追加模式下只约束**未来新增题**（存量不裁，避免为调参再全站换题面）——扩库时逐步稀释尾部。
  hard: { count: 95, maxScore: 112 },
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

// 保险丝：某档命中率异常趋零时 fail-fast 并给出诊断，而不是无输出死循环（引擎/CFG 改坏时的防线）
const MAX_ATTEMPTS_PER_LEVEL = 200000;

for (const lv of ORDER) {
  const { count, maxScore } = CFG[lv];
  const minClues = LEVEL_MIN_CLUES[lv];
  const seen = new Set(buckets[lv].map((r) => r.puzzle)); // 去重：新题不与现有题重复
  const before = buckets[lv].length;
  let attempts = 0;
  while (buckets[lv].length < count) {
    if (++attempts > MAX_ATTEMPTS_PER_LEVEL) {
      throw new Error(
        `${lv} 尝试 ${attempts} 次仍只有 ${buckets[lv].length}/${count} 题——命中率异常，检查引擎技巧链 / minClues / maxScore 配置`,
      );
    }
    const p = generatePuzzle(minClues);
    if (p.level !== lv) continue;
    if (p.score > maxScore) continue;
    const ps = gridToString(p.puzzle);
    if (seen.has(ps)) continue;
    // 入桶前完整过三大品质断言（唯一解 / 纯逻辑可解 / 逻辑解==生成解）——与 demo.ts 同一标准
    const res = logicalSolve(p.puzzle);
    if (!hasUniqueSolution(p.puzzle) || !res.solved) continue;
    if (res.grid.join('') !== p.solution.join('')) continue;
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

// daily.json = 前缀稳定的追加模式：既存 daily 的顺序保持不变，只把「池里新增的题」打乱后追加到末尾。
// 消费方（daily.astro）按「EPOCH 起算日序号 → 池内序号」顺序索引——前缀不重排 ⇒ 扩库部署不会改变
// 当天及既往日期的选题（旧实现全量重洗，365→485 那次扩库曾导致当天中途换题）。
// 注意：若人工删除各档 bucket json 全量重生题库，必须同时删除 daily.json 一起重建，
// 否则旧题滞留 daily 前缀、其难度标签可能与新引擎脱节。
const prevDaily: PuzzleRecord[] = existsSync(`${OUT}/daily.json`)
  ? ((JSON.parse(readFileSync(`${OUT}/daily.json`, 'utf-8')).puzzles ?? []) as PuzzleRecord[])
  : [];
const inDaily = new Set(prevDaily.map((r) => r.puzzle));
const fresh = ORDER.flatMap((lv) => buckets[lv]).filter((r) => !inDaily.has(r.puzzle));
for (let i = fresh.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
}
const all = [...prevDaily, ...fresh];
writeFileSync(`${OUT}/daily.json`, JSON.stringify({ name: 'daily', count: all.length, puzzles: all }, null, 2));

console.log(`✓ 完成 ${((Date.now() - t0) / 1000).toFixed(1)}s → daily ${all.length} 題`);

// daily 池余量预警：顺序消费（每日 1 题）耗尽后 daily.astro 会走取模回绕（题目复用且扩库会漂移当日选题）。
// 余量低于窗口天数（daily.astro 的 WINDOW=90）就该扩库了。EPOCH 与 daily.astro 保持一致：2026-06-14。
const EPOCH = Math.floor(Date.UTC(2026, 5, 14) / 86400000);
const remain = all.length - (Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000) - EPOCH);
if (remain < 90) console.warn(`⚠ daily 池余量仅 ${remain} 天（<90）——请扩库（调大 CFG count 后重跑），避免回绕复用旧题`);
else console.log(`  daily 池余量 ${remain} 天`);
