# 公共题库服务端：P5 集成契约

本代码只提供服务，不启用任何远程资源。当前生产 Pages 原为静态构建；合并代码或执行迁移不等于已上线。API 默认关闭，未配置时返回 503；求解器应继续本地工作。只允许本域 Origin 的写请求。所有 API 响应 no-store、noindex，不生成索引页或 sitemap。

## 数据和校验

- 输入为 81 位字符串，0 或点表示空格，服务端保存标准化的 0 题面，不接收照片。标准数独行列宫冲突、空盘、满盘、内置示例、无解或多解拒绝。服务端独立回溯最多计数两个解，默认最多 20,000 个搜索节点，超过预算保存为 pending_validation，不可公开。
- 稳定 ID 为 SHA-256 的小写 64 位十六进制，输入 UTF-8 字符串为 `standard-9x9:` 加标准化题面（不含两端标记）。只做题面精确去重，不做旋转、镜像或数字置换去重。
- 每次投稿独立保存来源声明、确认版本与撤回令牌哈希，题面重复不会覆盖其他来源；来源默认 unverified，不对外展示；仅管理员逐条 review-source 标记 verified 后才可随已公开题面展示。unverified 与 disputed 均不公开，但原始声明与审核记录保留。verified 仅表示来源事实核实，不等于权利许可。日期可不填，填写必须是合法日期且不晚于当日日本时间，不自动填今天。doubleCells 是两个互不相同的 0–80 索引，仅作为声明，不改变标准数独校验规则。
- 候选只对管理员数据库可见。首次撤回单条有效投稿会立即隐藏整题，并记录一条撤回日志；后续需人工审核剩余有效投稿，才可再次发布。合法旧令牌重复请求仍返回 200，但不会重复隐藏题目、改写时间或新增撤回日志，也不会覆盖后续合法重审结果。若没有有效投稿不可发布。撤回令牌只返回一次，服务端只保存哈希；丢失令牌时当前版本没有匿名找回机制。

## 对外接口

所有 POST 使用 JSON、同源 Origin；4 KiB 限制。返回 JSON 错误 `{error: "..."}`。

- `POST /api/public-puzzles`：`{grid,inputMethod:"manual"|"paste"|"ocr",confirmed:true,noticeVersion:"2026-11-15",source?:{kind:"newspaper"|"other",newspaper?:"yomiuri"|"asahi"|"mainichi"|"nikkei"|"chunichi"|"other",publicationDate?:"YYYY-MM-DD",edition?:string,issue?:string,doubleCells?:[number,number]}}`。confirmed 表示已检查原始题面并接受前端展示的对应版本投稿声明；OCR 同样必须明确确认。成功 201：`{puzzleId,submissionId,withdrawToken,status:"candidate"|"pending_validation",duplicate:boolean}`，status 是本次验证结果，不能理解为公开状态。客户端须妥善保存 submissionId 与 withdrawToken，不得放在公开 URL 或日志中。
- `GET /api/public-puzzles?cursor=...`：`{items:[{id,grid,createdAt,status:"public"}],nextCursor:string|null}`。每页 20 个，按 createdAt DESC、id DESC；游标视为不透明，须 URL 编码，仅返回人工审核后公开的题目。
- `GET /api/public-puzzles/:id`：`{id,grid,createdAt,status:"public",sources:[{kind,...,verification:"verified"}]}`。最多展示 100 个 active 且 verified 的来源声明；撤回、未核实、争议来源均不显示。向已公开题目重复投稿不会公开新来源，也不继承旧投稿的核实状态。题面未通过审核或已隐藏返回 404。
- `POST /api/public-puzzles/:id/withdraw`：`{submissionId,withdrawToken}`，首次与幂等重复成功均为 200 `{status:"withdrawn"}`。错误令牌返回 404。撤回鉴权与事务提交之间可有其他请求，事务内会再次检查 active 状态和令牌哈希；只有首次撤回创建本次唯一审计标记，投稿状态与整题隐藏都受该标记约束且在同一 D1 batch 原子提交。审核/撤回按事务提交先后生效：审核先提交则首次撤回隐藏；首次撤回后管理员可依据其他有效投稿重审；同一投稿的延迟/重复撤回没有后续副作用。
- 400 游标无效；403 Origin 不符；404 不存在/不可见；405 方法错误；422 输入、确认或数学验证失败；429 限流；503 关闭、缺配置或服务故障。客户端不要把 503 或待核题当成功发布。

## 受控审核操作

审核只用于可信运维，secret 绝不可放进浏览器、仓库或公开日志。使用管理员通过 D1 只读查询候选题与投稿来源进行人工审查，尤其确认题面正确、来源及适用权利；若无合法授权不得发布。操作使用 HTTPS、`Origin: https://numpredo.com`、`Authorization: Bearer <PUBLIC_PUZZLES_ADMIN_TOKEN>` 及 JSON：

- `POST /api/public-puzzles/:id/moderate`：`{status:"public"|"candidate"|"hidden",reason:"人工审核理由",rightsReviewed:true}`。public 时必须显式确认已完成权利审核、提交时验证为 unique 且当前服务重新验证唯一解、存在有效投稿；pending_validation 一律不可公开。其他状态无需 rightsReviewed。记录审核理由、状态和确认结果。
- `POST /api/public-puzzles/:id/review-source`：`{submissionId,verification:"unverified"|"verified"|"disputed",reason:"核查依据"}`，保留原声明及每次审核日志。verified 允许该条 active 来源在题面已公开时显示；改回 unverified 或 disputed 会立即从后续公共读取中移除。来源核查不会自动发布题面，也不自动推断版权授权；题面公开仍需独立 moderate + rightsReviewed，标为 verified 也不生成可索引页。

待核运算在此版本不自动重试或提供放宽预算的审核路径。需后续设计可复核、可回滚的离线复验操作，不能靠人工修改验证状态冒充结果。

## 运行依赖与上线前核对

1. 单独创建 D1 数据库、应用 `migrations/0001_public_puzzles.sql`、将 Pages production/preview 各自绑定为 `PUBLIC_PUZZLES_DB`；不要复用未经核实的旧库。设置长随机 secret `PUBLIC_PUZZLES_RATE_SALT`（至少32字符）和独立长随机 `PUBLIC_PUZZLES_ADMIN_TOKEN`；待验证后才设置 `PUBLIC_PUZZLES_ENABLED=true`。配置与部署需要另行授权。
2. 写入限流默认使用同一 D1 的原子窗口计数，每分钟每 IP 10 次；仅保存由密盐、分钟、Cloudflare 提供的 IP 构成的哈希，顺带清理前一分钟之前的键。无 IP 时共享 unknown 桶；此机制不能防止分布式滥用或穷尽 D1 配额，需结合平台边缘防护与监控。绑定缺失、密盐过短均关闭写入。可选注入兼容 Workers limiter，但 Pages 原生绑定未确认，不是部署前提。
3. `public/_routes.json` 仅将本 API 路由送入 Pages Functions；其余静态资源绕过 Functions。后续增加动态详情路由时必须由集成方合并路由配置，不可覆盖此 API。审核运维、预览/生产隔离、备份、配额、故障告警与秘钥轮换须在上线前落地。
4. 本地测试：在固定 Node 24.22.2 环境运行 `node scripts/check-public-puzzles.ts`。测试使用真实内存 SQLite 模拟 D1 事务与 HTTP handler，覆盖旧令牌重放、两次并发鉴权后交错重审、失败整体回滚，以及后续投稿/争议来源隔离。测试适配器把完整 batch 串行执行以匹配 D1 事务语义；复用现有审计表与 source_status 列，无 schema 变更，无需新增迁移。上述本地测试并不证明 Cloudflare 部署、绑定、Pages Functions 打包、实际 CPU 配额或跨区域并发已验收。上线前须在被授权的非生产环境测试唯一题投稿→管理员发布→其他客户端读取→撤回隐藏及限流；节点预算也须在目标 Workers CPU 配额下实测。
