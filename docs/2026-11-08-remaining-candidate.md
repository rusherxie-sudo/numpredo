# 11/8 剩余候选：仅本地发布准备、未部署

当前候选 `/home/ubuntu/website/numpredo-remaining-candidate-20261108`，本地准备分支 `release/prep-20261108`，baseline `abf17fd25b52db8c01093de6b9d2fea469fb73fd`。受保护main仍为`8b0dcc2`；旧18文件候选完全冻结。实时上游仅增加lastmod数据，已保留。原补丁sha256 `eb1f1d309829da013047b7071386cb9afc7403f44c0dd1ca3f44ca17c0a0698c` 的NP05/06意图均未在上游重复存在，按文件整合；门禁增加本轮PWA/离线报表测试。旧说明的路径和检查结果属于历史记录。

详细日志、逐文件来源、SHA、可重建补丁、历史生产映射在 `/home/ubuntu/website/numpredo-remaining-evidence-20261108/`。本文件不表示发布许可。

## NP10：已配置的未来固定v2队列

`src/client/pwa.ts`的`PWA_COHORT_V2`现为`enabled=true`，`enrollmentStartUtc=2026-11-09T00:00:00Z`、`enrollmentEndUtc=2026-11-16T00:00:00Z`。这是未来窗口配置，尚未发布或开始采集。严格校验绝对UTC（Z、秒或三位毫秒）、真实日期、恰好7×24小时。生产发布仍须另获授权且在固定T0之前完成审查与生效核实；准备时任何关键检查UTC≥T0即停止，不顺延窗口，不随构建滚动。禁用或无效配置完全不发v2。未开发启用/注册脚本。

只有既无group又无enrolledAt的浏览器，第一次符合原资格并随机分配且T0≤now<T1，才标记cohort=v2。旧group/time/returned标记保留，缺group但已有时间也不重分组；不会追认旧成员。组别50/50沿用crypto取随机；异常不阻断主动安装。游戏页、支持安装、两次访问或两局完成资格、7日展示/30日关闭冷却、control主动安装、standalone/installed隐藏语义保留。cohort_day仍是经过24小时的日龄，不能用旧总入组/回访数还原同批比例。

固定十事件如下，每族最多best effort一次，先成功持久化marker，再尝试gtag。仅带已有pwa_group/display_mode，不上报入组时间、ID、盘面、query/hash或招募窗参数。

| 事件（每行prompt/control两条） | 条件 |
| --- | --- |
| pwa_v2_enrolled_prompt / pwa_v2_enrolled_control | 首次新随机分组，持久化成功 |
| pwa_v2_return7_prompt / pwa_v2_return7_control | elapsed age 7–13 |
| pwa_v2_return28_prompt / pwa_v2_return28_control | elapsed age 28–34 |
| pwa_v2_played7_prompt / pwa_v2_played7_control | 入组后完成，age 0–6；达资格的前两局不计 |
| pwa_v2_installed14_prompt / pwa_v2_installed14_control | appinstalled实际通知，age 0–13；help/click/accepted都不计 |

招募关闭后，已入组成员仍计结果；显式禁用则不发v2。入组和五族标记均在现有numpredo.pwa.v1旁扩展，不改游戏存档。先读完整原模块、捕获器、调用方、GA统一入口及42fe565/5ad95b8后修改；原模块没有并发机制，新增原生Web Locks只锁状态读改写，不等待网络、不锁游戏/安装UI。无Web Locks的浏览器仍无原子CAS；不同渲染进程可读到旧状态导致重复/覆盖，旧页面也不遵循新锁。不能保证网络exactly-once。持久化后崩溃/gtag缺失或抛错会掉报，不重发；清存储、多容器、GA身份变化、拦截均会影响观察。时间倒退不形成新入组或结果。

逻辑仅在原延迟模块；PwaInstall.astro捕获器字节未改。无依赖、SW/cache/push/GA定义/BQ/服务器变更。旧统计仍继续，不声称旧口径已被修复或回填。

## 离线报表

执行：`python3 scripts/pwa/report.py INPUT.json --window 28`（或7）。程序只读本地文件，不含认证/网络/GA写入。用`python3 scripts/pwa/report.py scripts/pwa/synthetic-report.json`运行明确SYNTHETIC演算；每组分母100，return7为30/25，差5个百分点，仅证明算术，不代表自然数据或效果。

输入样例规定白名单envelope：cohort四字段、retrievedAtUtc、synthetic布尔、实际Data API request及白名单response。保留原始请求/回执由审查者核对；程序不能认证回执来源。真实使用必须使用已核实正式生效时刻，不能以fixture日期代替。无现有analytics源脚本可最小扩展，故新增独立标准库脚本。

只接受properties/539597439、响应Asia/Tokyo、hostName为numpredo.com/www.numpredo.com的AND过滤、十个固定eventName、一个绝对完整dateRange、仅eventName维度及totalUsers/eventCount；totalUsers是每事件整段DISTINCT，禁止按日/hostName分组后相加。7日版须T1+14d，28日版须T1+35d，再留显式至少48小时处理延迟；查询从T0东京日期之前覆盖至成熟日且结束整天已处理。报告GA观察身份层的ITT prompt/control比例、样本量、Wilson区间、差值和Newcombe区间，不代表真人或跨端留存，不挑实际看到提示的人。

缺少必要事件行不补零；count异常、重复/未知事件、分子超过分母、eventCount不等于totalUsers、空分母、50/50极端异常、采样/阈值/受限数据、日期/域名/完整性不符均拒绝出率。严格一次性eventCount检查也可能拒绝同一GA身份多个浏览器的正常业务情况，此时调查口径而不放宽/截断。7日版允许尚无return28行，但仍校验已提供的所有行。显式0必须由原回执提供，不能手造缺失行。

## 验证与复用

首轮实现前9组RED全部失败（exit1），实现后GREEN全过；历史补齐默认禁用/捕获器第10组后，对保存上游源码再执行RED十组失败、候选GREEN十组通过。最终另补时钟异常不放宽冷却用例，先RED再GREEN，历史最终11项断言通过。本次仅调整第10组默认配置断言，并直接验证未注入的真实配置在固定T0/T1边界的行为；显式禁用/无效配置注入测试原意不变。后续加强持久化顺序/日期合法性/合成十事件覆盖也有独立日志。第10组的游戏/构建/原预算另外实际通过，不人为破坏旧回归来制造RED。

Node24实际check（0 errors/0 warnings，100既有hints）、完整build含原postbuild、原合同/日界90→89天/8门禁测试、原产物预算检查通过；最大初始65470/65536，未放宽。游戏/安装浏览器综合运行包含prompt/control原生入口（模拟事件）、iOS说明、standalone、PWA存储故障下主动安装与独立游戏存档，以及填数刷新保存；所有外部请求在导航前拦截，成功第三方响应0。模拟appinstalled不是实体OS安装。完整命令/exit code见evidence；两处浏览器测试脚本问题、一处npm路径问题和一次Cloudflare分页参数400（改为每页25后通过）保留失败日志，未当成产品缺陷。

未变的NP06内容/模型和游戏学习链、引擎全题库demo复用旧证据，不重复完整学习/打印/下载测试。NP09仅对旧12 PDF/36页补字体检查：A4 210×297mm、文本边界、最小8pt；日文字体嵌入，Helvetica/Helvetica-Bold为PDF基础字体未嵌入。旧16题去重复用，不代表实体打印/组织者效果。

## 其他任务与生产边界

NP04只读补查完成，历史技术根因仍未证实；9/7实际SHA6b85b85未改首页标题/H1/CTA。9/8daily两次标题变更是候选断点，不是证实的首页根因。89eb678/098c320为9/22 JST后续归档重建修复，f356ab2为9/26下降后的直接玩实验。Git/生产成功/字段对照表见evidence/NP04.md；未改SEO字段，未重复请求Bing。

NP05生产验收partial：GitHub main未保护、rulesets空；当前Cloudflare Git集成自动部署main，build command为`npx astro build`，不执行npm完整品质门，也不证明依赖CI成功后部署。最新daily run42407712847以8b0dcc2为运行head，于2026-11-07T19:45:40Z success，生成abf17fd；canonical生产bfe186e4对应abf17fd，于19:46:15.766425Z成功。这些真实成功不能覆盖未提交候选。当前供题瓶颈hard到2027-05-19（含2026-11-08为193天），90天门槛未降；无需扩题。生产HTML的真实供题窗口未在本轮请求，不以工作流成功代替供题证据。

未来精确设置需求：生产构建应调用完整check-release-candidate.sh并绑定最终SHA；main保护/ruleset要求CI quality-gate成功且不允许自动部署绕过失败；日次在最终生成提交后验证，再允许发布。正常Git集成可能早于独立CI完成，不能仅增加required check便宣称部署门禁已闭环。当前仓库无显式失败通知route；Actions摘要不是通知，GET无法证明个人通知偏好/送达。上述均仅记录，未激活/调整任何设置。

NP06仅整合旧未发布安全深化意图，无新产品扩展；NP09数字证据partial（实体待验）；NP10本地候选done、生产实验与自然数据仍partial。所有生产均未改动；AdSense跳过，本次仅授权本地提交；未push任何ref、未部署/上传、未触发workflow、未发统计/外联/通知，未操作飞书任务。

下一最高优先级：父级通过SFTP取证、按基线archive独立重建并复审完整patch。发布/实验启用必须另获授权。

本次准备复用冻结浏览器5上下文、旧27测试与12 PDF/36页证据；不额外重跑独立浏览器/全站检查。最终已提交SHA仍须实际完整执行门禁（含其自身check/demo/build与原pre/postbuild）。lastmod在实际内容提交后用既有生成器生成，第二次仅提交清单，以真实Git内容日期归因；不伪造提交时间。Cloudflare未来同SHA完整门禁不替代尚未满足的GitHub main required-check/ruleset要求；保留daily机器写权限。新证据在仓库外 `/home/ubuntu/website/evidence/release-prep-20261108`，旧冻结证据只读保留。
