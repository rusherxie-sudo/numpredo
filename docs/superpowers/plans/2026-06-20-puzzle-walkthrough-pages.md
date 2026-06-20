# 题目集图解攻略页 实现计划

> **For agentic workers:** 本项目**无单元测试框架**(CLAUDE.md)。验证用 `npm run build`(出页/编译)+ `npm run demo`(引擎断言)+ `sudoku-engine-reviewer` / `seo-content-reviewer` 复审。步骤用 checkbox 追踪。

**Goal:** 做 60 个程序化题目图解攻略页(`/play/[level]/[n]/`,5 档×12),用引擎逐步解法图解吃番号词「数独中級5」、规避薄内容。

**Architecture:** 引擎新增 `traceKeySteps`(全步快照追踪)→ 新路由 `play/[level]/[n].astro` 构建期生成静态 SVG 图解序列(零 JS)+ Article/HowTo/FAQ/Breadcrumb JSON-LD → play 索引/难度页加入口防孤儿 → gen 脚本补 60 URL 日期。

**Tech Stack:** Astro(静态)、`src/engine`(logicalSolver/svg/index)、零运行时 JS。

---

## Task 1：引擎新增 `traceKeySteps`(全步快照追踪)

**Files:**
- Modify: `src/engine/logicalSolver.ts`(在 `traceFirstElimination` 后新增)
- Modify: `src/engine/index.ts`(导出 `traceKeySteps`)

- [ ] **Step 1: 在 logicalSolver.ts 新增函数**(复用 `traceFirstElimination` 的"执行前 slice 快照"手法,改为收集全部关键步)

```ts
/**
 * 沿技巧链推进,捕获「每个关键步」执行前的盘面/候选快照 + 该步。供题目图解页逐步演示。
 * 关键步 = 消除型步骤(有 eliminations);includeSingles 时,纯填入型题也收代表单数步,避免空页。
 */
export function traceKeySteps(
  grid: Grid,
  opts: { maxSteps?: number; includeSingles?: boolean } = {},
): Array<{ grid: Grid; candidates: number[]; step: SolveStep }> {
  const { maxSteps = 8, includeSingles = true } = opts;
  const s = initState(grid);
  const out: Array<{ grid: Grid; candidates: number[]; step: SolveStep }> = [];
  while (s.g.includes(0) && out.length < maxSteps) {
    let advanced = false;
    for (const tech of TECHNIQUES) {
      const candPrev = s.cand.slice();
      const gPrev = s.g.slice();
      const step = tech(s);
      if (step) {
        const isElim = !!(step.eliminations && step.eliminations.length);
        if (isElim || (includeSingles && (step.technique === 'hiddenSingle' || step.technique === 'nakedSingle'))) {
          out.push({ grid: gPrev, candidates: candPrev, step });
        }
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }
  // 纯单数题若上面因 includeSingles 收了很多,截断到 maxSteps;若一步都没有(异常),返回空由页面兜底
  return out.slice(0, maxSteps);
}
```

- [ ] **Step 2: index.ts 导出**

`src/engine/index.ts` 第 6 行 `export { logicalSolve, traceFirstElimination } from './logicalSolver.ts';` → 追加 `traceKeySteps`。

- [ ] **Step 3: 验证引擎不变量**

Run: `npm run demo` → 期望:仍全绿(`✅ 全部品质断言通过`)。`traceKeySteps` 是只读追踪,不改生成,题库无需重生成。

- [ ] **Step 4: 提交**

```bash
git add src/engine/logicalSolver.ts src/engine/index.ts
git commit -m "feat(engine): 新增 traceKeySteps 全步快照追踪(供题目图解页)"
```

---

## Task 2：题目图解页路由 `play/[level]/[n].astro`

**Files:**
- Create: `src/pages/play/[level]/[n].astro`

- [ ] **Step 1: 写路由**。要点(参考 `play/[level].astro` 的 SVG 图解 + JSON-LD 范式):
  - `getStaticPaths`:`LEVELS.flatMap(meta => [1..12].map(n => ({ params:{level:meta.slug, n:String(n)}, props:{meta, n, puzzle: meta.puzzles[n-1]} })))`
  - 构建期:`const sol = logicalSolve(gridFromString(puzzle.puzzle))` 取 clues/hardest/steps 数;`const keySteps = traceKeySteps(gridFromString(puzzle.puzzle))`
  - 题面 SVG:`renderBoardSvg(grid, {given, theme:TOKEN_THEME, cell:36, ...})`
  - 每关键步 SVG:`renderBoardSvg(step.grid, {given, candidates:step.candidates, cellHighlights, candidateMarks:(step.step.eliminations||[]).map(([cell,digit])=>({cell,digit,type:'eliminate'})), theme:TOKEN_THEME, cell:36})`(单数步:高亮 step.step.cell)
  - 内容结构按 spec §5(H1/特徴/一手ずつ図解/つまずいたら内链技巧页/遊ぶ印刷/他の問題/FAQ)
  - JSON-LD:Article + HowTo(每 keyStep 一 HowToStep)+ FAQPage + BreadcrumbList(参考 `guide/[slug].astro`/`play/[level].astro`)
  - title `数独${meta.ja} No.${n}｜一手ずつ図解で解き方 - numpredo`;canonical `/play/${slug}/${n}/`
  - 技巧名→slug 映射:用 `LEVEL_TECHS` 同款或按 hardest 映射到 `/guide/techniques/[slug]`

- [ ] **Step 2: 验证出页**

Run: `npm run build` → 期望:新增 60 页(`/play/beginner/1/` … `/play/extreme/12/`),零错误,总页数 39→99。

- [ ] **Step 3: 抽查防薄 + 图解**

Run: `cat dist/play/intermediate/5/index.html | sed 's/<[^>]*>//g' | tr -d ' \n' | wc -m`(字数)+ 确认多个 `<svg>` + JSON-LD 存在。抽查初级题(纯单数)`dist/play/beginner/1/` 图解不空。

- [ ] **Step 4: 提交**

```bash
git add src/pages/play/[level]/[n].astro
git commit -m "feat(play): 新增60个题目图解攻略页(/play/[level]/[n]/)吃番号词"
```

---

## Task 3：防孤儿内链入口

**Files:**
- Modify: `src/pages/play/index.astro`(加"問題集 No.1〜"区块)
- Modify: `src/pages/play/[level].astro`(难度页加"この難易度の問題集 No.1〜12"入口)

- [ ] **Step 1: play/index.astro 加区块**——在变体区块后,列各档"問題集（一手ずつ図解）→ No.1"。
- [ ] **Step 2: play/[level].astro 加入口**——SudokuGame 下方或攻略区,链 No.1〜12(`/play/${slug}/${i}/`)。
- [ ] **Step 3: 验证** `npm run build` 零错误;`grep -c "play/intermediate/1" dist/play/index.html` ≥1。
- [ ] **Step 4: 提交** `git commit -m "feat(play): 题目图解页加 play 索引/难度页内链入口(防孤儿)"`

---

## Task 4：gen 脚本加路由映射

**Files:**
- Modify: `scripts/gen-sitemap-lastmod.ts`(`DYNAMIC_DATA` 加 `'play/[level]/[n].astro': 'src/data/puzzles/...'`)
- Modify: `scripts/gen-published.ts`(同)

- [ ] **Step 1:** 两脚本的 `DYNAMIC_DATA` 加映射。注意:`[level]/[n]` 是嵌套动态,slug 来源是 levels(beginner..extreme)× n(1..12)——脚本的 slug 提取逻辑按 levels.ts 的 slug × [1..12] 拼 URL。若脚本现有 slug 提取不支持双参数,在脚本里对该路由特判:URL = `/play/${level}/${n}/`,源文件取对应 `puzzles/${level}.json` + 路由文件。
- [ ] **Step 2: 验证**(留到 Task 5 commit 后跑,因为读 git 日期)。

---

## Task 5：验证、复审、提交、上线

- [ ] **Step 1:** `sudoku-engine-reviewer` 复审 Task 1 的 `traceKeySteps`(守不变量、demo 绿)。
- [ ] **Step 2:** `seo-content-reviewer` 复审题目页防薄内容(独特图解+数据驱动+内链无孤儿+JSON-LD)。
- [ ] **Step 3:** 修复审发现的必修项。
- [ ] **Step 4:** `npm run build` 终验(99 页)。
- [ ] **Step 5:** commit 全部 → `npm run gen:sitemap && npm run gen:published`(补 60 URL 日期)→ commit 日期 → `git push`。
- [ ] **Step 6:** 部署后催收录代表页(各档 No.5)。

---

## Self-Review（spec 覆盖核对）

- spec §3 架构 → Task 2 ✅ / §4 引擎函数 → Task 1 ✅ / §5 内容结构 → Task 2 ✅ / §6 SEO+Schema → Task 2 ✅ / §7 防孤儿 → Task 3 ✅ / §6 gen 脚本 → Task 4 ✅ / §10 验收 → Task 5 ✅。无缺口。
