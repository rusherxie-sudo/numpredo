// 依赖生产构建产物；由 postbuild 执行，也可在构建后运行 npm run check:value。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOLVER_SAMPLE } from '../src/data/solver-sample.ts';
import {
  countSolutions,
  gridFromString,
  LEVEL_META,
  levelOf,
  logicalSolve,
  renderStepFigures,
  solveOne,
  TECH_INFO,
  traceKeySteps,
} from '../src/engine/index.ts';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const distHtml = (pathname: string): string => readFileSync(join(distDir, pathname, 'index.html'), 'utf8');
const solverFile = join(distDir, 'tools/solver/index.html');
if (!existsSync(solverFile)) {
  console.error('缺少 dist/tools/solver/index.html，请先运行 npm run build。');
  process.exit(1);
}

let failures = 0;
const ok = (cond: boolean, message: string): void => {
  if (cond) {
    console.log(`  ✓ ${message}`);
  } else {
    failures++;
    console.error(`  ✗ ${message}`);
  }
};

const plain = (html: string): string => html
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;|&#38;/g, '&')
  .replace(/&lt;|&#60;/g, '<')
  .replace(/&gt;|&#62;/g, '>')
  .replace(/&quot;|&#34;/g, '"')
  .replace(/&#39;|&#x27;/g, "'")
  .replace(/\s+/g, '');

const standardTotal = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'].reduce(
  (sum, slug) => sum + JSON.parse(readFileSync(join(projectRoot, 'src/data/puzzles', `${slug}.json`), 'utf8')).puzzles.length,
  0,
);
const stdLabel = standardTotal.toLocaleString('ja-JP');
const analysisLabel = `全${stdLabel}問の分析データ`;

console.log('\n[1] 固定示例的引擎校验');
const grid = gridFromString(SOLVER_SAMPLE);
const given = grid.map((value) => value !== 0);
const solution = solveOne(grid.slice());
const solutionCount = countSolutions(grid.slice(), 2);
const logical = logicalSolve(grid.slice());
ok(solutionCount === 1, `唯一解（解数=${solutionCount}）`);
ok(solution !== null && logical.solved, '纯逻辑可解，且存在回溯解');
ok(solution !== null && logical.grid.join('') === solution.join(''), '逻辑解与回溯解的 81 格一致');
const clues = grid.filter(Boolean).length;
const steps = logical.steps.length;
const hardest = logical.hardest ?? 'nakedSingle';
ok(clues > 0 && steps > 0, `实测提示数=${clues}，逻辑步数=${steps}`);
ok(hardest in TECH_INFO, `最难技巧已定义：${hardest}`);
const figures = renderStepFigures(traceKeySteps(grid.slice(), { maxSteps: 2 }), given, 26);
ok(figures.length === 2, '生成两张精选步骤图');
ok(figures.every((f) => f.svg.startsWith('<svg') && f.text.length > 0 && f.slug), '步骤图包含 SVG、说明和技巧链接');

console.log('\n[2] 求解器页面、固定示例和结构化数据');
const solverHtml = readFileSync(solverFile, 'utf8');
ok(solverHtml.includes(`data-puzzle="${SOLVER_SAMPLE}"`), '静态示例与浏览器样例使用同一盘面');
ok(
  solverHtml.includes(`data-clues="${clues}"`) && solverHtml.includes(`data-steps="${steps}"`),
  '示例属性的提示数和步数与实测结果一致',
);
ok(
  solverHtml.includes(`ヒント<strong>${clues}個</strong>`) && solverHtml.includes(`論理手数<strong>${steps}手</strong>`),
  '示例可见正文的提示数和步数与实测结果一致',
);
ok(solverHtml.includes(`最難テクニックは<strong>${TECH_INFO[hardest].ja}</strong>`), '可见正文显示实际最难技巧');
ok(solverHtml.includes(`難易度の目安：${LEVEL_META[levelOf(logical)].ja}`), '可见正文显示实际难度');
for (const figure of figures) {
  ok(solverHtml.includes(figure.text), '构建页面包含引擎生成的步骤解释');
  if (figure.slug) ok(solverHtml.includes(`/guide/techniques/${figure.slug}/`), `图解含技巧链接：${figure.slug}`);
}

const faqStart = solverHtml.indexOf('<dl class="faq">');
const faqEnd = solverHtml.indexOf('</dl>', faqStart);
ok(faqStart >= 0 && faqEnd > faqStart, '可见 FAQ 列表存在');
const faqSlice = solverHtml.slice(faqStart, faqEnd);
const visiblePairs = [...faqSlice.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)]
  .map((m) => [plain(m[1]), plain(m[2])]);
const faqJsons = [...solverHtml.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]) as Record<string, unknown>)
  .filter((json) => json['@type'] === 'FAQPage');
ok(faqJsons.length === 1, 'FAQPage JSON-LD 恰好一个');
const faqMain = (faqJsons[0]?.mainEntity as Array<{ name: unknown; acceptedAnswer: { text: unknown } }> | undefined) ?? [];
ok(visiblePairs.length > 0 && visiblePairs.length === faqMain.length, `可见 FAQ 与结构化数据均为 ${visiblePairs.length} 条`);
ok(
  visiblePairs.every(([vq, va], i) => {
    const item = faqMain[i];
    return item !== undefined && vq === plain(String(item.name)) && va === plain(String(item.acceptedAnswer?.text ?? ''));
  }),
  'FAQ 问题、答案和顺序与结构化数据一致',
);

console.log('\n[3] 标准 9×9 题库统计范围');
const researchHtml = distHtml('research/puzzle-analysis');
ok(researchHtml.includes(`全${stdLabel}問の数独を分析`), '分析页标题与标准题库数量一致');
ok(researchHtml.includes(`集計対象：標準9×9数独 ${stdLabel}問`), '分析页明确统计范围和题量');
ok(researchHtml.includes('キラー数独・対角線数独・ミニ4×4は別ルールの問題集のため集計対象外'), '分析页明确不含其他规则题库');
const homeHtml = distHtml('.');
ok(homeHtml.includes(`全${stdLabel}問の分析`), '首页分析链接与标准题库数量一致');
ok(homeHtml.includes('標準9×9を三重に検証'), '首页质量说明明确标准 9×9 范围');
const aboutHtml = distHtml('about');
ok(aboutHtml.includes(`${stdLabel}問`), '关于页题量与标准题库数量一致');
ok(aboutHtml.includes('キラー数独・対角線数独・ミニ4×4などの別ルールの問題集は含めていません'), '关于页明确不含其他规则题库');
ok(solverHtml.includes(analysisLabel), '页脚分析链接与标准题库数量一致');

if (failures > 0) {
  console.error(`\n✗ check:value 未通过：${failures} 处不一致`);
  process.exit(1);
}
console.log('\n✓ check:value 通过：页面示例、统计范围和结构化数据一致');
