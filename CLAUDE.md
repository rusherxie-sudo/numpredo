# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 与用户的所有对话、注释、文档一律使用**中文**。站点面向用户的全部文案（页面/SEO/UI）一律使用**日语**——这是 SEO 内容站，日语是产品语言，不要混入其他语言。

## 项目定位

numpredo（numpredo.com）是面向日本市场的**日语数独/ナンプレ SEO 内容站**：约 80% 是静态内容页（攻略/信息/难度落地页）+ 局部强交互（可玩数独 + 求解器）。北极星是 **Google 自然流量获客**——当前 0 流量阶段，SEO 拉新优先，游戏留存类功能冻结到有流量后再做。性能即 SEO（CWV 是排名信号），所以选 Astro 岛屿架构：内容页零 JS，交互隔离成岛。

## 常用命令

```bash
npm run dev        # astro dev，本地开发
npm run build      # astro build → dist/（静态输出）
npm run preview    # 预览构建产物

npm run gen:pool   # 重新生成全部题库（见下方"题库"小节，改引擎/难度后必跑）
npm run gen:sitemap # 刷新 sitemap 的真实 lastmod（改内容页/数据文件后跑，见"部署"小节）
npm run demo       # 跑引擎自检：每道题断言唯一解 + 逻辑可解（无测试框架，这是品质门）
npm run render-demo # 导出示例 SVG 到 engine-demo/
```

**无单元测试框架**。引擎正确性靠 `scripts/demo.ts` 的运行时断言保证（可接 CI）。

**Node 版本注意**：`package.json` 写 `>=18`，但所有 `scripts/*.ts` 用 `node scripts/xxx.ts` **原生跑 TypeScript**，需 Node 22.6+/23+（开发机为 v24）。引擎内部 import 全部带 **`.ts` 显式后缀**（`tsconfig` 开了 `allowImportingTsExtensions`）——新增引擎文件时必须照此约定写后缀，否则原生执行和 Astro 构建都会失败。

## 核心架构：一套引擎，三处复用

`src/engine/` 是**框架无关的纯 TypeScript 包**（无外部依赖），是整个项目的心脏。同一套核心被复用于三个场景，理解这点才能理解全站：

1. **构建期生成题库** — `scripts/gen-pool.ts` 调 `generatePuzzle` 离线产出题库
2. **客户端运行** — `src/client/*.ts`（游戏/求解器）在浏览器直接 import 引擎，零服务器计算
3. **SVG 图解** — 页面（如 `play/[level].astro`、技巧页）构建期调 `renderBoardSvg` 生成攻略配图

引擎模块职责（全部从 `src/engine/index.ts` 统一导出）：

| 文件 | 职责 |
|------|------|
| `types.ts` | 核心类型 Grid / SolveResult / Puzzle / DifficultyLevel |
| `board.ts` | 位掩码候选、units/peers 预计算、序列化（`gridFromString`/`gridToString`） |
| `countSolver.ts` | 唯一解校验（MRV 回溯，数到 2 即停）+ `solveOne` |
| `logicalSolver.ts` | 人类技巧链 + 难度评分；`traceFirstElimination` 供图解演示 |
| `difficulty.ts` | 技巧权重 → 难度等级 |
| `generator.ts` | 完整解 → 对称挖空（每步保证唯一解 + 逻辑可解） |
| `svg.ts` | 和风 SVG 渲染（盘面/候选/高亮/消去标记，明暗主题） |

### 难度模型（关键领域概念）

难度 = **求解所用「最难技巧」**（主）+ 加权步数（次），**不是挖空数**。技巧链按认知难度递增：
`nakedSingle → hiddenSingle → lockedCandidates → nakedPair → hiddenPair → nakedTriple → xWing`
映射到五档：初級 / 中級 / 上級 / 難問 / 超難問（`difficulty.ts` 的 `TECH_WEIGHT` / `levelFromHardestWeight`）。

### 题库：预生成进 git，不在构建时生成

`src/data/puzzles/*.json`（五档 + `daily.json`）由 `npm run gen:pool` 手动生成并**提交进 git**。构建时**不**生成题库——这是刻意决策（部署稳定、可复现）。`gen-pool.ts` 里 `CFG` 控制各档题数、提示数下限（`minClues`，越低挖得越稀疏越难）、`maxScore`（抑制同档极端难题、缓解跨档难度倒挂）。`daily.json` 是**前缀稳定的追加模式**（旧序永不重排、新题乱序续尾）；daily 页按「上线日 EPOCH（2026-06-14）起算日序号」顺序消费（`daily.astro` 只嵌 90 天窗口），扩库部署不会改变当天选题。全量重生题库时必须连 `daily.json` 一起删除重建。

**运行时不做客户端生成题目**：`play/[level]` 嵌入池内前 30 道（与图解页 No.1〜30 对应，`?n=` 直达），「別の問題」池内循环；打印页按档动态 import 题库 JSON 随机抽样。`generateByLevel` 只用于离线脚本——它未命中目标难度时返回最接近档（hard 实测命中 0/5），不能拿给用户当指定难度用。

> 技术选型文档（`numpredo-技术选型定稿.md`）规划题库存 R2 + Workers Cron 选每日题，但**当前实现更简单**：题库进 git、daily 用确定性 JSON。改任何引擎/难度逻辑后，记得 `npm run gen:pool` 重新生成并提交。

每道入库题必须通过三条断言（`gen-pool.ts` 入桶时校验，`demo.ts` 复核）：①唯一解 ②纯逻辑可解（no-guessing）③逻辑解 == 生成解。**`countSolutions` 对矛盾输入可能指数爆炸**，调用务必传上限（如 `countSolutions(grid, 2)`）——历史上有过卡死页面的 bug。

## 内容即数据：程序化页生成

页面内容大量抽到 `src/data/*.ts`，由动态路由经 `getStaticPaths` 批量出页：

| 数据文件 | 驱动路由 | 说明 |
|---------|---------|------|
| `data/levels.ts` | `pages/play/[level].astro` | 五档难度可玩页（含独有攻略/tips/FAQ） |
| `data/techniques.ts` | `pages/guide/techniques/[slug].astro` | 技巧攻略（含构建期 SVG 图解局面） |
| `data/guides.ts` | `pages/guide/[slug].astro` | 攻略/信息长文（body 支持 HTML 内链） |
| `data/variants.ts` | `pages/variants/[slug].astro` | 变体数独内容页（不可玩，手写和风 SVG 示意） |

**防薄内容是硬约束**：每个程序化页必须注入该难度/变体/技巧**独有**的文案 + FAQ（否则被 Google 判薄内容）。新增程序化页时，给数据对象补齐独特 `lead`/`tips`/`faq`，并注入 JSON-LD（FAQPage / BreadcrumbList / WebApplication，见 `play/[level].astro` 范式）。**article 类页**（`og:type=article`：`guide/[slug]`、`guide/techniques/[slug]`、`guide/how-to-solve`、`variants/[slug]`）另注入 `Article`，其 `dateModified` **复用 `src/data/sitemap-lastmod.json`**（按 pathname 查表，不要现编日期；技巧页/how-to 页与已有的 `HowTo` 并存）。

> **FAQ 答案含内链时必须用 `set:html` 渲染**（`<dd set:html={f.a} />`），不能写 `{f.a}`——后者会把答案里的 `<a>` 转义成字面文本，内链失效且不可爬取。数据里只放可信的手写 HTML，不要塞半角 `<`/`>`（不等号变体用全角 `＜＞`）。

## 布局与设计系统

- `src/layouts/Base.astro` 是唯一布局：放全部 `<head>`/SEO meta/OGP、页头页脚、以及**全局 CSS 变量调色板**（和風"washi"主题，`--washi`/`--shu`/`--ai` 等，含 `prefers-color-scheme` 自动暗色）。新组件用这些变量，不要硬编码颜色。容器统一 1060px 宽。设计规范见 `numpredo-设计系统.md`。
- 交互岛 `src/components/SudokuGame.astro`（被 `play/[level]` 与 `daily` 共用）通过 `<script>import '../client/sudoku-game.ts'</script>` 只在需要的页注入 JS——保持内容页零 JS。

## 部署

Cloudflare Pages 托管 `dist/` 静态输出。`public/_redirects` 是旧 React 多语言站 URL → 新日语站的 301 映射（改路由时同步维护）。`astro.config.mjs` 配 `site: numpredo.com` + `@astrojs/sitemap`。

> Sitemap 只有一份：`@astrojs/sitemap` 构建生成 `sitemap-index.xml` + `sitemap-0.xml`（`robots.txt` 指向 index）。早期那份手动 `public/sitemap.xml` 已删除。
>
> **lastmod 用真实修改日，不是构建日**：每个 URL 的 `<lastmod>` 取自「该页内容源文件（页面 .astro + 它驱动的数据文件，**不含**共享布局 Base.astro）」的 git 提交日期，由 `npm run gen:sitemap` 离线算好写进 `src/data/sitemap-lastmod.json`（提交进 git），`astro.config.mjs` 的 `serialize` 构建时只读它注入。**为何离线预生成**：① 绝不用构建日兜底——那等于每次部署都谎称全站更新，Google 会判 lastmod 不可信而忽略；② CF Pages 构建环境可能 shallow clone，构建时现算 `git log` 会把日期塌缩成最近提交日 ≈ 构建日。与题库「预生成进 git」同一套防御思路。改内容页/数据文件后跑 `gen:sitemap` 刷新并提交（PostToolUse hook 会提醒；忘了只是 lastmod 偏旧，偏旧安全、偏新才有害）。
>
> **`sitemap-lastmod.json` 有两个消费方**：① `astro.config.mjs` 注入 sitemap `<lastmod>`；② 4 个 article 模板（`guide/[slug]`、`guide/techniques/[slug]`、`guide/how-to-solve`、`variants/[slug]`）`import` 它取 `Article` 的 `dateModified`。当前格式是扁平映射 `{ "/url/": "ISO日期" }`，按 pathname 查表——**改它的键格式/结构会同时打断这 4 个模板**，动结构时记得一并改模板。

## 仓库约定

- `.gitignore` 排除规划/研究文档（`numpredo-*.md`、`competitors/`、`content-plan/`、`keywords/`、`reports/`）和 `engine-demo/`——它们是工作资料，不属于站点。`numpredo-*.md` 是有价值的背景（竞品分析、技术选型、引擎品质方案、升级计划），但不会进版本库。
- 提交信息历史用中文 `feat:`/`fix:` 前缀，正文描述用户可感知的变化。
