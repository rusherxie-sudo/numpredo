// SVG 渲染验证：把引擎产物渲成真实 SVG 文件（题面 / 候选视图 / 技巧消除演示）。
// 运行：node scripts/render-demo.ts
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import {
  LEVEL_META,
  computeCandidates,
  generateByLevel,
  renderBoardSvg,
  traceFirstElimination,
  type CandidateMark,
} from '../src/engine/index.ts';

const OUT = 'engine-demo';
mkdirSync(OUT, { recursive: true });

const sizeKB = (f: string): string => (statSync(f).size / 1024).toFixed(1) + 'KB';

// 取一道「上級」题（我们的 SEO 突破口难度）
const { puzzle: p } = generateByLevel('advanced', 80);
const given = p.puzzle.map((v) => v !== 0);

// 1) 题面（given 加粗深色）
const f1 = `${OUT}/puzzle.svg`;
writeFileSync(
  f1,
  renderBoardSvg(p.puzzle, {
    given,
    title: `上級ナンプレ（数独）問題 ${p.clues}ヒント`,
    desc: 'numpredo の上級ナンプレ問題。唯一解・論理だけで解ける高品質パズル。',
  }),
);

// 2) 解答
const f2 = `${OUT}/solution.svg`;
writeFileSync(f2, renderBoardSvg(p.solution, { given, title: '上級ナンプレの解答' }));

// 3) 候选视图（空格显示铅笔候选）
const f3 = `${OUT}/candidates.svg`;
writeFileSync(
  f3,
  renderBoardSvg(p.puzzle, {
    given,
    candidates: computeCandidates(p.puzzle),
    title: '候補数字（メモ）表示',
    desc: '各空きマスに入りうる候補数字を表示。',
  }),
);

// 4) 技巧消除演示（来自引擎真实推理的第一个消除步骤）
const trace = traceFirstElimination(p.puzzle);
let f4 = '(无消除步骤——该题靠单数即可解)';
if (trace) {
  const marks: CandidateMark[] = trace.step.eliminations!.map(([cell, digit]) => ({ cell, digit, type: 'eliminate' }));
  const cells = [...new Set(trace.step.eliminations!.map(([c]) => c))].map((cell) => ({ cell }));
  f4 = `${OUT}/technique-${trace.step.technique}.svg`;
  writeFileSync(
    f4,
    renderBoardSvg(trace.grid, {
      given,
      candidates: trace.candidates,
      cellHighlights: cells,
      candidateMarks: marks,
      title: `${trace.step.technique} で候補を消去`,
      desc: `${trace.step.technique}：赤い候補が消去される。論理 steps の実演。`,
    }),
  );
}

console.log('════════════════════════════════════════════════════');
console.log(' SVG 渲染验证（盘面 / 候选 / 技巧演示共用同一渲染器）');
console.log('════════════════════════════════════════════════════');
console.log(`样题：${LEVEL_META[p.level].ja} / ${p.clues} 提示 / 最难技巧 ${p.hardest}`);
console.log(`  1. 题面          → ${f1}  (${sizeKB(f1)})`);
console.log(`  2. 解答          → ${f2}  (${sizeKB(f2)})`);
console.log(`  3. 候选视图      → ${f3}  (${sizeKB(f3)})`);
if (trace) {
  console.log(`  4. 技巧消除演示  → ${f4}  (${sizeKB(f4)})`);
  console.log(`     演示技巧：${trace.step.technique}，消除候选数：${trace.step.eliminations!.length}`);
} else {
  console.log(`  4. 技巧消除演示  → ${f4}`);
}
console.log('\n全部为矢量 SVG，文字内嵌日语（利 image pack + a11y），均 KB 级（利 CWV）。');
