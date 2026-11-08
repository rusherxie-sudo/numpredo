> 本文记录原overnight候选，现保留为历史来源。11/8剩余整合已迁入独立新候选，当前路径、基线与验证见[剩余候选](2026-11-08-remaining-candidate.md)。

# 2026-11-08 未发布候选

候选位置：`/home/ubuntu/website/numpredo-overnight-candidate-20261107`，分支 `overnight/candidate-20261107`。HEAD/base 为 `8b0dcc2d7f96a4e1f709ae7bf3c1b2fbe627a827`，业务差异全部未提交，不能用 HEAD 冒充候选内容版本。冻结文件 SHA-256、完整 patch、逐文件 diff、原始检查及浏览器证据位于 `/home/ubuntu/website/numpredo-overnight-evidence-20261107/`。

| 项目 | 本地结果 | 尚未完成的边界 |
| --- | --- | --- |
| NP05 | partial：CI 与每日更新复用完整 SHA 门禁；日次重取 main 后重装对应依赖、生成并在最终提交验证余量、类型、引擎、合同、完整 build；拒绝 SHA 变动和脏产物。失败提供 Actions 摘要。193天最短余量，420个供题引用逐项核验 | 不推送/激活；没有候选远端 CI；摘要不是通知，外部通知送达和实际生产供题连续性待验收 |
| NP06 | done（本地候选）：从受保护提交 `181e4cdfd654a1911e5d0e8acb9de005b738003a` 安全整合9个业务文件；12篇各保留原3节再增加4节、原1问再增加2问；复核6个局部模型、反例、实际引擎例题和 Killer 计算图；修正同一行四格也全属同宫的不可成立表述 | 仍未发布；局部模型不是完整题；只有 claiming 对应原引擎 lockedCandidates，其余5个新增模型技巧不宣称引擎支持 |
| NP08 | done（本地验证）：390/1440宽各验证普通题、每日第6题、实际消候选3条链。少剧透区域/理由→对应手筋练习→真实作答→返回；盘面、笔记、用时等值；继续输入后刷新保持 | 未发现需修复产品缺陷；保留9手筋180练习；不证明学习效果、真机/BFCache或生产统计接收 |
| NP09 | done（本地数字路径），partial（实体使用）：用途卡→实际预览→实际下载；两宽共12份PDF/36页，逐数字匹配题源；题答分离、16题不重复、续包和记录表、许可及生成器均验证 | 不扩商业许可；打印对话框以stub记录意向，不等于实体打印成功；未获得真实使用增长证据 |

Node：`/home/ubuntu/website/numpredo-overnight-evidence-20261107/runtime/node_modules/node/bin/node`，`v24.22.2`。候选仅一次 npm ci、一次 check、一次 demo、一次完整 build（含 prebuild/postbuild）。类型检查0 errors/0 warnings，100条既有hints；27项不同原生测试通过；10个浏览器场景通过，其中包括24次深化页面检查、6条完整学习链和2条打印路径。原检查未降级，索引入口98，首屏64KiB门槛保留。

所有浏览器导航前阻断非本地来源及collect；未向生产注入统计、未人工发送测试事件。主目录、保存深化worktree及NP01 worktree未改动。构建的one-move生成未产生业务diff，dist/.astro/node_modules是候选忽略产物；不把构建日期写进提交式lastmod manifest。本次没有运行manifest生成器。

下一最高优先级是独立审查冻结diff和证据。审查后如未来另有发布授权，应对真实提交SHA重新跑门禁；本次绝不提交、push、部署、触发工作流、提交索引、改后台/scope或通知外部。回退仅为丢弃本地候选，不操作线上；本轮没有执行丢弃。
