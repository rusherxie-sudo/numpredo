# numpredo（数独道）

> 面向日本市场的日语数独/ナンプレ SEO 内容站 + 可玩数独游戏与求解器。

## 核心信息
- **域名**：https://numpredo.com
- **用途**：约 80% 静态内容页（攻略/技巧/难度落地页）+ 强交互（可玩数独、求解器）。北极星 = Google 自然流量获客。
- **目标用户**：日本数独爱好者
- **站点语言**：日语（产品）；开发沟通用中文
- **GitHub**：`rusherxie-sudo/numpredo`（main，public）

## 技术栈
- Astro 7（纯静态 SSG）+ TypeScript + `@astrojs/sitemap` + `sharp`
- 包管理器：npm（package-lock.json）
- 核心：`src/engine/` 框架无关纯 TS 引擎（生成器/求解器/SVG 渲染），构建期生成题库、客户端运行、SVG 配图三处复用
- 无单元测试框架，引擎正确性靠 `scripts/demo.ts` 运行时断言（CI 品质门）

## 部署
- Cloudflare Pages（Git 集成，项目名 `numpredo2`）
- GitHub Actions：`ci.yml`（tsc + demo 断言 + build）、`daily-build.yml`（每日更新 lastmod/published 数据 → commit push → 触发部署）

## 数据依赖
- 无后端/数据库，纯静态；题库预生成进 git（`src/data/puzzles/*.json`）

## 页面类型
- `play/`（可玩数独，按难度）、`variants/`（4×4/16×16/killer/diagonal 等变体）
- `tools/`（solver/generator/candidate-checker）、`guide/`（攻略/技巧）、`print/`（打印）、`daily/`、`practice/`、`stats/`、`research/`

## SEO 结构
- sitemap-index.xml，真实 lastmod 从 git 提交日离线生成（`src/data/sitemap-lastmod.json`）
- robots.txt：AI crawler 显式允许（GPTBot/ClaudeBot 等）+ Mediapartners-Google
- canonical、JSON-LD、`public/llms.txt`
- sitemap filter 排除个人数据页 + 未验证搜索需求的量产题

## 权威文档
- `CLAUDE.md`（定位/架构/命令，最全）
- `docs/`：SEO 长期增长方案、关键词地图 v1/v2、GEO 审计、外链执行清单（2026-09-03 一批）

## 最近方向
- 0 流量阶段，SEO 拉新优先；2026-09-03 上线 4×4 页面 + SEO 外链执行 + 关键词地图 v2

## GA4
- `G-CM79TWN2J0`
