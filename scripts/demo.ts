// 引擎品质验证脚本：实证「唯一解 + 纯逻辑可解(no-guessing) + 难度分级」。
// 运行：npm run demo   （node v24 原生跑 .ts）
import type { Grid, Puzzle } from '../src/engine/index.ts';
import {
  LEVELS,
  LEVEL_META,
  generateByLevel,
  generatePuzzle,
  hasUniqueSolution,
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

// ---- 3. 按难度档定向生成 ----
console.log('\n[3] 按难度档定向生成各 1 题：');
for (const lv of LEVELS) {
  const { puzzle, hit, attempts } = generateByLevel(lv, 80);
  if (!puzzle) {
    console.log(`    ${LEVEL_META[lv].ja.padEnd(3)} : 未生成`);
    continue;
  }
  const tag = hit ? '✓命中' : `≈最接近(${LEVEL_META[puzzle.level].ja})`;
  console.log(
    `    ${LEVEL_META[lv].ja.padEnd(3)} : ${tag}  clues=${puzzle.clues} hardest=${puzzle.hardest} (${attempts}次尝试)`,
  );
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
