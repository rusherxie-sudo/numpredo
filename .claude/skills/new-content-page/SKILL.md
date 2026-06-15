---
name: new-content-page
description: 按 numpredo 现有数据范式脚手架一个新的程序化内容页(技巧/攻略/变体),含独有日语文案、FAQ、JSON-LD、双向内链,满足「防薄内容」硬约束。新增 guide/technique/variant 页面时使用。
disable-model-invocation: true
---

# 新增内容页（防薄内容脚手架）

为 numpredo 新增一个程序化内容页。站点北极星是 Google 自然流量获客,**每个程序化页必须有独有内容**,否则被判薄内容、不收录。所有面向用户文案一律**地道日语**。

## 步骤

### 1. 选类型与数据文件
- **技巧攻略** → `src/data/techniques.ts`(`Technique`)→ 路由 `/guide/techniques/[slug]`
- **攻略/信息长文** → `src/data/guides.ts`(`GuideArticle`)→ 路由 `/guide/[slug]`
- **变体数独** → `src/data/variants.ts`(`Variant`)→ 路由 `/variants/[slug]`
- 难度页(`/play/[level]`)为固定五档,不在此新增。

先 Read 目标数据文件顶部的接口定义和一个现有条目,照其结构追加新对象。动态路由会自动出页,**无需新建 .astro 文件**。

### 2. 填齐字段(逐项不可省）
- `slug`:URL 短横线英文,全站唯一。
- `title` / `description`:独有 meta;`title` 含目标关键词(数独 / ナンプレ / 技巧名 / 难度名),约 ≤32 全角字;`description` 约 ≤120 全角字。
- `h1` / `lead`:页面主标题与导语,与 meta 区分、不重复。
- `sections[]`:正文,**该条目专有**的讲解(技巧步骤 / 规则 / 攻略),`body` 支持 HTML,在此写**双向内链**(见步骤 4)。
- `faq[]`:≥2 条,含该条目专有问答(不要只放通用问答)。驱动 FAQPage JSON-LD。
- 类型专属字段:technique 的 `fig`/`figCaption`/`level`、variant 的 `svg`/`svgCaption` 等,照现有条目补全。

### 3. 确认 JSON-LD
对应 `[slug].astro` 已统一注入 FAQPage + BreadcrumbList,范式见 `src/pages/play/[level].astro`。确认新条目的 `faq` 非空,使 FAQPage 生效。

### 4. 双向内链,消除孤岛
- **出链**:在 `sections` 正文 HTML 内链到相关技巧 / 攻略 / 变体 / 难度页(如 `<a href="/guide/techniques/x-wing/">`)。
- **入链**:至少让一个已存在页面链接到本新页——在 `src/layouts/Base.astro` 的 `footerCols` 加导航项,或在相关页正文 / `play/[level].astro` 的 `LEVEL_TECHS` 中登记。孤岛页是本站明确要消除的问题。

### 5. slug 登记
若本页替换了旧 React 站的某个 URL,在 `public/_redirects` 加 301 映射。

### 6. 关键词调研(可选但推荐）
用 **semrush-chrome** skill(通过 Chrome 自动操作 SEMrush 采集;SEMrush MCP 已弃用)核实目标关键词的搜索量 / 竞争度,据此打磨 `title` / `h1` / `faq` 的措辞。

### 7. 自查
完成后用 **seo-content-reviewer** subagent 审查防薄内容、JSON-LD、内链与日语质量,再 `npm run build` 确认构建通过。
