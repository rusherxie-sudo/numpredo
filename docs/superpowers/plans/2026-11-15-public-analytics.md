# 公共题库统计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐公共投稿结果事件与公共挑战本地事件口径，保留敏感 URL 统计保护。

**Architecture:** 复用现有 `track`，只发送有限枚举。详情采用页面实例状态排除看答案后完成与重复完成。既有 URL 隐私保护优先于事件送达。

**Tech Stack:** Astro 7、TypeScript、Node 24.22.2 原生运行脚本。

**Spec:** [统计合同](../../../PUBLIC-ANALYTICS.md)。

## Global Constraints

- 独立 worktree 从 integration HEAD 29f0ea6f28fb96ba98fd30485c817a813076b63e 开发；不改主树和集成树。
- 不上报题面、照片、来源原文、题目 hash/id、凭证；不更改 Base 或 GA4 配置。
- Node 命令经 tools/dev/run numpredo bash -c，显式 cd 隔离树；不浏览器、不 push/deploy、不灌入真实统计。

### Task 1: 最小事件与行为验证

**Files:** 修改 src/client/ocr-solve.ts、src/client/public-puzzles.ts、scripts/check-public-ui.ts；创建 PUBLIC-ANALYTICS.md。

**Interfaces:** 消费 `track(name: string, params: EventParams = {}): void`；事件和枚举以统计合同为准。

- [x] 投稿响应校验后发送 `track('public_submission', { result: result.duplicate === true ? 'duplicate' : result.duplicate === false ? 'accepted' : 'unknown', source_filled: sourceFilled ? 'yes' : 'no' })`；失败与本机重复分别计数。
- [x] 使用 `correct && started && !revealed && !completed` 控制首次独立完成。整题/二重框答案和求解器链接设置 revealed。
- [x] 扩展无浏览器 DOM 替身，执行真实事件处理器，断言有无来源、成功/失败/去重、首次完成、看答案排除以及敏感字段缺席。
- [x] 经固定入口运行 `npm run check:public-puzzles`、`npm run check`、`npm run build`，检查最终 diff 并本地提交。

已执行：公共题库测试通过，类型检查 0 errors / 0 warnings / 101 hints，构建及 postbuild 检查通过。线上送达未验证；详情 URL 的统计保护意味着挑战/完成/分享实际收集仍未覆盖。
