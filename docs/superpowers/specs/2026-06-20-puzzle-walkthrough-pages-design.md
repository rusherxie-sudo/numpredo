# 题目集图解攻略页 设计文档

- **日期**：2026-06-20
- **状态**：已批准（brainstorming）
- **作者**：Claude + 用户

## 1. 目标

做 **60 个程序化"题目图解攻略页"**（5 档难度 × 各 12 题），吃番号词「数独中級5」「数独中級6」等导航词簇（scored.csv ⑨簇，月搜 ~20 万量级）。

核心策略：用**引擎生成的逐步解法图解**作为每页的独特内容，规避程序化页的薄内容陷阱，对竞品本土题库站（number-place-puzzle.net / numpre7.com，只有"一堆题"、零图解、技术老旧）做降维打击。

## 2. 已敲定的形态决策（brainstorming）

| 维度 | 决策 |
|------|------|
| 形态 | 一题一页·完整图解攻略 |
| 规模 | 每档前 12 题，共 **60 页** |
| 图解深度 | 关键步（消除型步骤；纯单数的初级题展示代表单数发现步） |
| 可玩性 | **静态图解（零 JS）** + 「同じ難易度で遊ぶ」按钮跳可玩页 |
| URL | `/play/[level]/[n]/`（n = 1..12） |

## 3. 架构

- **新动态路由**：`src/pages/play/[level]/[n].astro`
  - `getStaticPaths`：`LEVELS × [1..12]` = 60 页；props 传 `{ levelMeta, n, puzzle }`
  - 与现有 `src/pages/play/[level].astro`（处理 `/play/[level]/`）不冲突（路由深度不同）
- **题源**：现有 `src/data/puzzles/[level].json` 各档 `[0..11]`（已在 git，无需新题库、无需 gen:pool）
- **构建期图解**：对每道题调引擎生成图解序列 → `renderBoardSvg` 渲染每步 → 内联静态 SVG，**零运行时 JS**

## 4. 关键实现细节：引擎需新增"全步追踪"函数

**问题**：`logicalSolve(grid).steps` 返回步骤序列，但**不含每步执行前的盘面/候选快照**；渲染图解需要"这一步之前盘面+候选长什么样"。现有 `traceFirstElimination`（logicalSolver.ts:287）只为**第一个消除步**捕获了快照。

**方案**：在 `src/engine/logicalSolver.ts` 新增泛化函数（导出 + 加进 `index.ts`）：

```ts
// 沿技巧链推进，捕获「每个关键步」执行前的盘面/候选快照 + 该步。
// 关键步 = 消除型步骤(有 eliminations)；可选附带代表性单数填入步(供纯单数题)。
export function traceKeySteps(grid: Grid, opts?: { maxSteps?: number; includeSingles?: boolean }):
  Array<{ grid: Grid; candidates: number[]; step: SolveStep }>
```

- 复用 `traceFirstElimination` 的"执行前 slice 快照"手法，改为**收集全部关键步**而非首个即返回。
- `maxSteps` 默认 ~8（难题步骤多，精选前 N 个关键步，避免页面过长）。
- `includeSingles`：初级纯单数题（无消除步）时，取前若干 `hiddenSingle/nakedSingle` 步展示（高亮该格 + 说明"这格只能填 X"），保证不空页。
- **纯只读追踪，不改生成逻辑** → 不需 `npm run gen:pool` 重生成题库（但因触碰 `src/engine/`，须 `sudoku-engine-reviewer` 复审守住不变量）。

## 5. 每页内容结构（防薄 = 独特图解序列 + 数据驱动）

1. 面包屑：ホーム › プレイ › 中級 › No.5
2. **H1**「数独 中級 No.5｜一手ずつ図解で解き方」
3. 题面盘 SVG + **「この問題の特徴」**：数据驱动一句话（提示 N 个・最難技巧 X・全 Y 手，来自 `logicalSolve` 的 clues/hardest/steps，**每题不同**）
4. **「一手ずつ図解」**：`traceKeySteps` 的关键步序列 —— 每步一张 SVG（执行前盘面 + 候选 + 该步高亮/消除标记）+ 一句日语说明（数据驱动："この行で〇は2マスに絞られ…"）
5. **「つまずいたら」**：内链该题最難技巧的详解页 `/guide/techniques/[slug]`（技巧文字不在此重复）
6. **「遊ぶ・印刷」**：`/play/[level]/`（按钮「同じ難易度で遊ぶ」）+ `/print/`
7. **「他の問題」**：同档其他编号 No.1〜12 + 其他难度
8. **FAQ**：数据驱动 + 通用（この問題の難易度は？/解けないときは？）

## 6. SEO / 结构化数据

- **title**：`数独 ${ja} No.${n}｜一手ずつ図解で解き方 - numpredo`（吃「数独中級5」）
- **description**：数据驱动（含难度 + 最難技巧 + 「図解」「解き方」）
- **JSON-LD**：`Article` + `HowTo`（解题步骤天然适配，每 step 一个 HowToStep）+ `FAQPage` + `BreadcrumbList`
- **lastmod / datePublished**：60 个新 URL —— 在 `scripts/gen-sitemap-lastmod.ts` 与 `scripts/gen-published.ts` 的 `DYNAMIC_DATA` 加 `play/[level]/[n].astro → src/data/puzzles/[level].json` 映射；commit 后跑两脚本补日期。

## 7. 防孤儿（内链入口）

- `src/pages/play/index.astro` 加"問題集（一手ずつ図解）"区块，链到各档 No.1
- `src/pages/play/[level].astro` 难度页加"この難易度の問題集 No.1〜12"入口
- 题目页之间互链（同档相邻编号 + 其他难度同编号）

## 8. 防薄内容自检

- **独特来源**：60 条引擎真实解法路径（SVG 序列各不相同）+ 数据驱动特征描述 + 题号 → 无雷同
- **复用而非重复**：技巧解释靠内链到 `/guide/techniques/[slug]`，不在题目页堆技巧文字
- **每页 SVG 数**：题面 1 + 关键步 ≤8 + 解答 1 ≈ 3〜10 张静态 SVG，零 JS，CWV 可控

## 9. 边界与风险

- **初级纯单数题**：无消除步 → `includeSingles` 展示代表单数发现，有教学价值，不空页
- **前 12 道是否"图解友好"**：少数题可能关键步极少/极多 → `traceKeySteps` 的 maxSteps 截断 + 至少展示 1 步兜底；实现后抽查
- **HTML 体积**：多 SVG 但静态零 JS；单页控制在合理范围（关键步 ≤8）
- **gen 脚本**：`DYNAMIC_DATA` 加映射后，60 URL 的 lastmod/published 才会被生成

## 10. 验收标准

- 60 页 `npm run build` 全部出页、零错误
- `sudoku-engine-reviewer` 复审 `traceKeySteps` 守住引擎不变量、`npm run demo` 仍绿
- `seo-content-reviewer` 复审防薄内容通过（独特图解 + 数据驱动 + 内链无孤儿）
- 抽查 dist 产物：JSON-LD（Article/HowTo/FAQ/Breadcrumb）合法、图解 SVG 渲染正确、内链有效
- `gen-sitemap` / `gen-published` 补上 60 URL 的日期
