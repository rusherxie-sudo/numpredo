# numpredo 任务台账

> 单一事实来源。状态：进行中 → 就绪 → 冻结待解冻 → 后续。
> 更新日期：2026-09-05（接手首轮审计 + 内链优化 + 漏收录页攻坚后）

## 进行中（P0：3 个漏收录页）

**现状**：`/guide/number-place/`、`/guide/sudoku-algorithm/`、`/print/blank/` 仍 `Discovered - currently not indexed`（从未被抓取）。

**已尽自动化之能（2026-09-05 全部完成）**：
- ✅ 内链补强：number-place 已接 how-to-solve 正文 + sudoku-vs-numpre 正文/FAQ（4.5k 曝光高频页）；sudoku-algorithm 已接 solver + research 正文；print/blank 已有 nav + print×2 + generator
- ✅ sitemap 重提（HTTP 204，lastSubmitted 已刷新）
- ✅ IndexNow 提交（HTTP 200，Bing 即时）
- ❌ **GSC「请求索引」无 API**：URL Inspection 只读、Indexing API 仅限 JobPosting 且未启用

**唯一剩余动作（需人工）**：在 GSC 后台 UI 对 3 个 URL 逐个点「请求索引」（有日配额）。否则等自然抓取 3–7 天（已靠新内链 + sitemap 重提抬升优先级）。

## 就绪（下一轮候选，按优先级）

1. **`/play/advanced/` 上級词簇攻坚** — 27–57 位、272+ 曝光近零点击；内链已饱和，缺口在 authority，需内容深度 + 外链。
2. **`/print/senior/` 高齢者词簇 top3** — pos 7–8，KD 仅 6，SEO+外链双线最易攻。
3. **`/variants/4x4/` 观察** — 9/6–10 查首次 query 曝光（已收录但 0 曝光），10/1 复盘 mini4 事件。

## 冻结待解冻（有明确日期，不做无谓改动）

- `/guide/sudoku-vs-numpre/` CTR 修复（4,511 曝光 / 0.66%）→ **9/19 解冻**
- `/daily/` CTR 修复（3,816 曝光 / 1.47%）→ **9/18 解冻**

## 后续（低优先级）

- sem-3ue（Semrush）关键词量/KD 复核
- 399 重定向 / 8 个 404 收敛复核（GSC 无公开 API，靠后台导出）
