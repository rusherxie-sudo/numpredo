// 引擎品质验证脚本：实证「唯一解 + 纯逻辑可解(no-guessing) + 难度分级」，
// 并全量复核 git 题库（防「引擎改了忘跑 gen:pool」的静默脱节）。
// 运行：npm run demo   （node v24 原生跑 .ts）
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Grid, Puzzle } from '../src/engine/index.ts';
import {
  DIAGONAL_CONTEXT,
  LEVELS,
  LEVEL_META,
  TECHNIQUE_NAMES,
  TECH_INFO,
  TECH_WEIGHT,
  generateByLevel,
  generatePuzzle,
  gridFromString,
  hasUniqueSolution,
  isSolved,
  levelOf,
  logicalSolve,
} from '../src/engine/index.ts';

function render(g: Grid): string {
  const rows: string[] = [];
  for (let r = 0; r < 9; r++) {
    const cells: string[] = [];
    for (let c = 0; c < 9; c++) {
      const v = g[r * 9 + c];
      cells.push(v === 0 ? '.' : String(v));
      if (c % 3 === 2 && c !== 8) cells.push('|');
    }
    rows.push(' ' + cells.join(' '));
    if (r % 3 === 2 && r !== 8) rows.push(' ------+-------+------');
  }
  return rows.join('\n');
}

const techSummary = (tc: Record<string, number>): string =>
  Object.entries(tc)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}×${v}`)
    .join(', ') || '(无)';

let failures = 0;
const assert = (cond: boolean, msg: string): void => {
  if (!cond) {
    failures++;
    console.error('  ✗ 断言失败:', msg);
  }
};

console.log('═'.repeat(64));
console.log(' numpredo 数独引擎 · 品质验证');
console.log('═'.repeat(64));

// ---- 1. 批量生成 + 品质断言 ----
const N = 16;
console.log(`\n[1] 生成 ${N} 道题，逐题断言「唯一解 + 逻辑可解」…`);
const t0 = Date.now();
const dist: Record<string, number> = {};
const samples: Puzzle[] = [];
for (let i = 0; i < N; i++) {
  const p = generatePuzzle();
  samples.push(p);
  dist[p.level] = (dist[p.level] ?? 0) + 1;

  // 品质三断言
  assert(hasUniqueSolution(p.puzzle), `#${i} 必须唯一解`);
  const res = logicalSolve(p.puzzle);
  assert(res.solved, `#${i} 必须纯逻辑可解(no-guessing)`);
  assert(
    res.grid.join('') === p.solution.join(''),
    `#${i} 逻辑解必须等于生成解`,
  );
}
const ms = Date.now() - t0;
console.log(`    完成，用时 ${ms}ms（均 ${(ms / N).toFixed(0)}ms/题）`);
console.log(
  '    难度分布：',
  LEVELS.map((l) => `${LEVEL_META[l].ja}=${dist[l] ?? 0}`).join('  '),
);
console.log(
  '    提示数(clues)范围：',
  Math.min(...samples.map((s) => s.clues)),
  '~',
  Math.max(...samples.map((s) => s.clues)),
);

// ---- 2. 展示一道样题（题面 + 解 + 技巧链）----
const demo = samples[0];
console.log(`\n[2] 样题（${LEVEL_META[demo.level].ja} / ${demo.clues} 提示 / score=${demo.score}）`);
console.log('  题面:');
console.log(render(demo.puzzle));
console.log('  唯一解:');
console.log(render(demo.solution));
console.log('  最难技巧:', demo.hardest, '｜ 技巧链:', techSummary(demo.techniqueCounts));

// ---- 3. 按难度档定向生成（产物同样过三断言——历史盲区：此段曾只打印不校验）----
console.log('\n[3] 按难度档定向生成各 1 题：');
for (const lv of LEVELS) {
  const { puzzle, hit, attempts } = generateByLevel(lv, 80);
  if (!puzzle) {
    console.log(`    ${LEVEL_META[lv].ja.padEnd(3)} : 未生成`);
    continue;
  }
  assert(hasUniqueSolution(puzzle.puzzle), `定向${lv} 唯一解`);
  const dres = logicalSolve(puzzle.puzzle);
  assert(dres.solved, `定向${lv} 纯逻辑可解`);
  assert(dres.grid.join('') === puzzle.solution.join(''), `定向${lv} 逻辑解==生成解`);
  const tag = hit ? '✓命中' : `≈最接近(${LEVEL_META[puzzle.level].ja})`;
  console.log(
    `    ${LEVEL_META[lv].ja.padEnd(3)} : ${tag}  clues=${puzzle.clues} hardest=${puzzle.hardest} (${attempts}次尝试)`,
  );
}

// ---- 4. 技巧链元数据完备性（缺键会被 `?? 1` 静默兜底成初級，必须有守卫）----
console.log('\n[4] 技巧链 ↔ TECH_WEIGHT ↔ TECH_INFO 键完备性…');
for (const name of TECHNIQUE_NAMES) {
  assert(name in TECH_WEIGHT, `TECH_WEIGHT 缺少技巧权重: ${name}`);
  assert(name in TECH_INFO, `TECH_INFO 缺少技巧文案: ${name}`);
}
console.log(`    ✓ ${TECHNIQUE_NAMES.length} 个技巧键完备`);

// ---- 5. git 题库全量复核：三断言 + 难度标签与现算一致 + daily 溯源（实测全量仅 ~1s）----
console.log('\n[5] 复核 git 题库全部题目…');
const t5 = Date.now();
// 相对脚本自身定位（fileURLToPath 兼容路径含空格/非 ASCII 的场景）——从任意 cwd 跑都能找到题库，避免静默跳过复核
const POOL_DIR = fileURLToPath(new URL('../src/data/puzzles', import.meta.url));
const poolSeen = new Set<string>();
let poolCount = 0;
for (const lv of LEVELS) {
  const f = `${POOL_DIR}/${lv}.json`;
  if (!existsSync(f)) {
    console.log(`    （${f} 不存在，跳过——题库重建前属正常）`);
    continue;
  }
  const rows = JSON.parse(readFileSync(f, 'utf-8')).puzzles as Array<{
    puzzle: string; solution: string; level: string; score: number; hardest: string;
  }>;
  for (const [i, row] of rows.entries()) {
    const g = gridFromString(row.puzzle);
    assert(hasUniqueSolution(g), `题库 ${lv}#${i + 1} 唯一解`);
    const res = logicalSolve(g);
    assert(res.solved, `题库 ${lv}#${i + 1} 纯逻辑可解`);
    assert(res.grid.join('') === gridFromString(row.solution).join(''), `题库 ${lv}#${i + 1} 逻辑解==入库解`);
    assert(levelOf(res) === row.level, `题库 ${lv}#${i + 1} 难度标签脱节: 存储=${row.level} 现算=${levelOf(res)}（引擎改动后忘跑 gen:pool？）`);
    poolSeen.add(row.puzzle);
    poolCount++;
  }
}
if (existsSync(`${POOL_DIR}/daily.json`)) {
  const daily = JSON.parse(readFileSync(`${POOL_DIR}/daily.json`, 'utf-8')).puzzles as Array<{ puzzle: string }>;
  for (const [i, row] of daily.entries()) assert(poolSeen.has(row.puzzle), `daily#${i + 1} 不在任何档位桶内`);
  console.log(`    ✓ 档位桶 ${poolCount} 题复核 + daily ${daily.length} 题溯源，用时 ${Date.now() - t5}ms`);
}

// ---- 6. 対角線変体：生成断言（引擎上下文注入的实证）----
// 三断言全部在 DIAGONAL_CONTEXT 下执行；第四条 isSolved(solution, ctx) 单独防
// 「fullSolution 漏传 ctx 只生成标准解」的系统性缺陷（前三条可能被碰巧合法的解掩盖）。
console.log('\n[6] 対角線変体：生成 3 题，逐题断言（对角线上下文）…');
const t6 = Date.now();
for (let i = 0; i < 3; i++) {
  const p = generatePuzzle(28, DIAGONAL_CONTEXT);
  assert(hasUniqueSolution(p.puzzle, DIAGONAL_CONTEXT), `対角線#${i} 唯一解（对角线规则下）`);
  const res = logicalSolve(p.puzzle, DIAGONAL_CONTEXT);
  assert(res.solved, `対角線#${i} 纯逻辑可解(no-guessing)`);
  assert(res.grid.join('') === p.solution.join(''), `対角線#${i} 逻辑解==生成解`);
  assert(isSolved(p.solution, DIAGONAL_CONTEXT), `対角線#${i} 解必须满足两条对角线约束`);
}
console.log(`    ✓ 3 题全过（唯一解+逻辑可解+对角线约束），用时 ${Date.now() - t6}ms`);

// ---- 7. 対角線题库全量复核（与 [5] 同一防线：引擎改动后忘跑 gen:pool 即红）----
if (existsSync(`${POOL_DIR}/diagonal.json`)) {
  console.log('\n[7] 复核対角線题库全部题目…');
  const t7 = Date.now();
  const rows = JSON.parse(readFileSync(`${POOL_DIR}/diagonal.json`, 'utf-8')).puzzles as Array<{
    puzzle: string; solution: string; level: string;
  }>;
  for (const [i, row] of rows.entries()) {
    const g = gridFromString(row.puzzle);
    assert(hasUniqueSolution(g, DIAGONAL_CONTEXT), `対角線题库#${i + 1} 唯一解`);
    const res = logicalSolve(g, DIAGONAL_CONTEXT);
    assert(res.solved, `対角線题库#${i + 1} 纯逻辑可解`);
    assert(res.grid.join('') === gridFromString(row.solution).join(''), `対角線题库#${i + 1} 逻辑解==入库解`);
    assert(isSolved(gridFromString(row.solution), DIAGONAL_CONTEXT), `対角線题库#${i + 1} 解满足对角线约束`);
    assert(levelOf(res) === row.level, `対角線题库#${i + 1} 难度标签脱节: 存储=${row.level} 现算=${levelOf(res)}`);
  }
  console.log(`    ✓ ${rows.length} 题复核通过，用时 ${Date.now() - t7}ms`);
} else {
  console.log('\n[7] （diagonal.json 不存在，跳过——変体题库生成前属正常）');
}

// ---- 结果 ----
console.log('\n' + '═'.repeat(64));
if (failures === 0) {
  console.log(' ✅ 全部品质断言通过：唯一解 + 纯逻辑可解 + 难度分级有效');
  console.log('═'.repeat(64));
  process.exit(0);
} else {
  console.error(` ❌ ${failures} 条断言失败`);
  console.log('═'.repeat(64));
  process.exit(1);
}
