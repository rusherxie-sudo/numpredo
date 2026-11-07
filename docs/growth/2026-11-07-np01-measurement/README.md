# NP01 测量实施候选（未发布）

范围：标准 9×9 游戏、既有提示学习入口、PDF/打印意向、最小 URL 隐私收缩。未 push、merge、部署或修改 GA 平台配置。未扩页、改题库/PDF、Sitemap、全站日期、广告或同意配置。没有修改12篇深化分支或 stash。

## 隔离与基线

- 原 main 与开发 base：`2bc6f665d53be4df5effe1be528cdee8e8a0992a`，开始核实工作区干净；没有 fetch。
- 分支：`feat/np01-measurement-20261107`。
- worktree：`/home/ubuntu/website/numpredo-np01-measurement-20261107`。
- Git refs 清单和完整 bundle：`/home/ubuntu/np01-audit-20261107/implementation-logs/refs-before.txt`、`/home/ubuntu/np01-audit-20261107/refs-before.bundle`。
- 原生产 main 指本地已核实 main 指针；没有把该指针当作 Cloudflare 当前部署的独立证明。PROJECT 历史发布记录仍供参考，真正发布前应重新只读核实当前生产部署。
- 最终 candidate SHA、diffstat、命令退出码和服务清理记录见仓库外 `/home/ubuntu/np01-audit-20261107/implementation-result.md`，避免在提交中自引用 SHA。

## 事件字典

历史事件保留名称、参数与原有触发范围。特别是 `game_start` 仍每组件首次 pointerdown/keydown 一次；`one_move_return` 仍是旧点击语义；`print_pdf_download` 不因新增预览观测扩大触发范围。没有新增 `page_view`。

所有新事件带 `measurement_version=np01`。标准游戏公共参数为 `game_mode=library|daily|archive`、`game_level=beginner|intermediate|advanced|hard|extreme`，每日/归档另有 `daily_slot=0..6`。首页难度映射 beginner，重复难度使用题目实际 level 和不同 slot。新参数有运行时白名单。

| 事件 | 实际含义与额外参数 |
| --- | --- |
| puzzle_first_input | 每局首次真实手动、改变盘面、非零且与当前行列宫无冲突的数字写入；不检查答案正确性；在 complete 前记录 |
| game_hint | 每次实际呈现提示；纠错、单数、消候选、兜底使用同一记录出口；提示后立即持久化 h |
| game_complete（旧事件扩展） | 原调用点和原参数保留，增加版本/公共参数及 hint_used、input_observed，均 yes/no/unknown |
| game_learning_open | 提示内 guide/practice 链接真实激活，并成功保存本地往返证明；learning_kind、technique 为有限枚举 |
| game_learning_return | 同标签页从实际到达的学习页返回，并验证原局、原存档及 revision；与返回链接点击不同 |
| game_learning_input | 成功返回后首个满足有效输入定义的数字写入；与 first_input 独立 |
| pdf_link_click | 本站已知 PDF 链接真实激活；pdf_entry=download/preview/related，pdf_kind=standard/variant/collection/progression/activity，pdf_role=questions/answers/combined/guide |
| pdf_preview_view | 真实预览图已成功加载、有自然宽高、至少50%进入视口；每元素每文档一次；只有 kind/role |
| print_intent | 即将真实调用 window.print；print_kind=generated/blank/technique/mini6/mini4/solver16/generator；不代表系统打印成功 |

不上传题号、盘面、格号、数字、日期、题目 hash、保存 revision/generation、随机 attempt、URL、标题、文件名或自建个人 ID。旧事件中历史题号等字段未扩充。未为报表便利设置 source/medium/campaign。

## 生命周期与兼容

Saved 原 p/s/c/n/e/d/h 保持兼容，新增可选 `measurement`：v=1、input/hint 三态、revision、generation。新局 no/no；旧局缺字段 input=unknown，旧 h=1/0/缺失分别 yes/no/unknown。h 明确存在时为主。unknown 保存时不写成 h=0；新提示立即转换 yes。

同局 first_input 标志先存档再排队；本地“已观测”不等于 GA 收到，失败不重放。切题、A→B→A、刷新保留逐局标志；重开增加本地 generation、重置标志并清理往返。apply 清空提示阶段。完成恢复只展示旧结果。标准非 collection 的首页/精选池使用独立本地命名空间，避免与完整题库相同编号冲突。存储不可用时以组件内 Map 保留切题状态；刷新后不保证跨页去重/恢复。

输入排除候选、选格、扫描固定格、删除、同值切换删除、暂停、完成、满9个数字锁定、undo/redo、load/apply 和提示程序化动作。无冲突但答案错误的猜测仍计有效输入。提示本身不填数。

学习往返仅使用既有练习/guide 页面。sessionStorage 一个版本化 pending，TTL 两小时，包含本地 back、目的地、已访问标志、原存档证明及 revision/generation。出发先暂停和保存盘面/笔记/h/用时，再记录 open；旧练习点击事件保留。练习页或 guide 真实渲染后才能标记 visited。返回核对原状态后发一次 return，保留暂停遮罩，由用户继续；外出时间不累积。存档迁移前先核对 pending 对应真实槽位，防止已删除存档被旧迁移重建后误报。过期、损坏、缺失、其他题、revision 不符、重开、跨 JST 日无法恢复均不报成功。新的实际出发替换旧 pending。

返回地址只允许本站固定游戏/报纸路径、n/d/tab 和有限锚点，拒外链、协议相对、反斜杠、原始/编码/多重编码路径穿越、重复参数和无效日期/编号/tab；消费阶段另核对实际题面和槽位。保留用户原业务 URL，不把任意 query 带到学习回跳地址。直接访问 guide 不生成往返。存储无法可靠保存时不给出成功恢复承诺。

PDF 共享观测只由已有打印工具/资源模板加载；普通内容页没有增加全站 PDF 脚本。guide 的本地返回入口内联在两个相关模板，复用构建时序列化的同一个安全校验函数，未扩大纯内容页外部脚本预算。新 NP01 辅助代码只在标准游戏动态载入，学习模块在提示/有 pending 返回时载入；新模块加载失败允许游戏降级。

## 隐私收缩及限制

GA config 的 page_location、page_referrer 显式只保留真实 http(s) origin/path，去掉所有 search/hash；空 referrer 保持空值。没有额外 config/page_view、伪造来源、UTM 重写或业务地址改写。白名单只控制本站新事件参数，不能声称约束官方 gtag 所有运行时自动字段。

百度不接收 NP01 事件。首页、play/daily/tools/print/practice/variants 功能页有 query/hash 时不加载百度，延迟加载时再次检查 URL。普通干净内容页保持原行为。这是百度测量口径收缩，发布切点需单独记录，不能把数量变化当增长/流失。

真实 gtag.js、后台 enhanced measurement、自动 file_download/link_url、history 自动浏览、真实 collect 序列化、自然 UTM 归因和服务端接收均未验证；本地外部脚本全部阻断，未下载真实统计脚本或发送合成统计流量。去掉 config page_location 的 UTM 与官方自动 campaign 读取的交互未知；不承诺原 UTM 归因完整，也不重新拼回自由 query 规避隐私边界。干净内容页上的百度及其 referrer 处理没有被此页级收缩全面验证。没有扩大同意/广告权限，也没有将延迟加载称为用户同意。

## 验证证据与覆盖边界

所有原始日志位于 `/home/ubuntu/np01-audit-20261107/implementation-logs/`。日志只保留用例名、有限事件计数、状态等值布尔和错误/退出信息，不导出存档、真实棋盘、个人数据、自由事件值、HAR 或 Cookie。

四个 slice 按 input/hint → return → PDF/print → privacy 顺序实施：

| slice | 真实行为 RED（退出1） | 初次 GREEN（退出0） |
| --- | --- | --- |
| input/hint | input-red.log：有效数字写入事件实际0，预期1 | input-green.log：first_input/hint 各1、h立即持久 |
| return | return-red.log：实际原题返回事件0，预期1 | return-green.log：返回及返回后输入各1 |
| PDF/print | pdf-red.log：已加载可见预览曝光0，预期1 | pdf-green.log：预览、PDF点击及print stub通过 |
| privacy | privacy-red.log：page_location仍含合成title查询 | privacy-green.log：query/hash清除，敏感页百度不加载 |

RED 是真实旧行为断言失败，不是缺模块/import 失败。首次测试 fixture 曾错误假定页面包含 solution，修正为使用公开题库/引擎后才记录 input-red；不将环境错误充当 RED。后续预算迭代 build.log、build-budget-retry*.log、build-final.log 均保留真实失败，未放宽门禁。browser-storage-failure.log、storage-debug*.log 记录 dev toolbar 自身在禁用 storage 时抛错；storage-debug2.log 定位到 Astro dev toolbar，生产静态产物 storage-built.log 已通过，未为此修改工具栏或掩盖产品错误。

命令入口：

```sh
npm ci
npm run check
npm run demo
npm run build
node --test scripts/np01/contracts.test.ts
NP01_RUNNER=/home/ubuntu/np01-audit-20261107/browser-runner node scripts/np01/browser.mjs input
# 同一入口另有 return / pdf / privacy，供逐 slice 行为复核
NP01_RUNNER=/home/ubuntu/np01-audit-20261107/browser-runner NP01_ORIGIN=http://127.0.0.1:4392 NP01_BUILT=1 node scripts/np01/regression.mjs
git diff --check
```

浏览器 runner 是仓库外的隔离 Playwright 安装，不修改 package.json/lock。context 独立、serviceWorkers:block，在 newPage/goto 前安装 context route，只有指定本地 origin 放行；所有其他来源 abort，collect 路由先检查所有请求中合成哨兵/禁用字段。正常测试只观察真实 Arguments 队列；transport 用例明确为本地测试替身消费者，serialize 到本地 collect 再截断，仅验证本站队列/边界，绝不是 Google 官方接收证明。外部成功请求最终统计和具体覆盖用例以最终结果文件/浏览器日志为准。

现有 build 包括 prebuild 与全部 postbuild（SEO/脚本预算、value、one-move、expansion）；不是只运行 Astro 编译。未运行不存在的 npm test，也未执行题库/PDF/扩页生成命令。构建前置的既有 one-move 校验生成流程未产生业务内容差异。

已覆盖和未覆盖的最终精确清单、所有命令退出码及日志路径在结果文件追加记录。Chrome 手机/桌面证据不等于 WebKit/真机打印/GA 服务端验收；BFCache 浏览器保留策略、引擎无法到达的 fallback 分支及真实统计脚本另列限制，不虚报测试范围。

## GA 平台与报表口径

负责人提供的 vps2 只读核验：properties/539597439，Asia/Tokyo，defaultUri=https://numpredo.com；host 主域/www 固定。current 独立总量16683 sessions /12302 engaged/43237 PV，日合计16783/12433/43237；previous 独立13507/9887/27367，日合计13280/9615/27367。差异原因未查明。全部 API200，元数据未返回阈值/采样字段不等于 false，不能用官方 HLL 一般说明断定本次具体根因。本轮未读取任何后台凭据或原始个人数据。

已注册 result/level，新参数未注册；本阶段不改平台配置。上线后参数在常规报表可用、自然事件收到、真实自动字段安全仍待另行验收。建议获准后按需登记 measurement_version/hint_used/game_mode/learning_kind，其他参数按实际分析需求登记，不注册题号、URL、局ID或时间戳。

默认 Asia/Tokyo、成熟日期窗、固定 host 范围，以 eventName × sessionDefaultChannelGroup 分别报告包含事件的会话、用户、事件数。Organic Search 不等于日本流量，加国家条件必须注明。日明细不能替代独立总量，各事件会话不能相加。原 PDF download 报表标注“PDF链接意向”，打印标注“打印意向”。

常规报表不得直接将 game_complete / puzzle_first_input 称为完成率：跨会话/旧存档/不同局与拦截漏记不可精确 join，本期没有上传局ID。input_observed 只说明本地观测过。学习 return/open、input/return 是观测闭环，不是学习效果、掌握程度或因果提升。不得把新增埋点导致的计数变化写成增长。

## 发布与回滚（本轮未执行）

1. 负责人先审精确 candidate SHA、diff、日志和未验收项；未获后续明确授权不 push/merge main/部署/改平台。
2. 真正发布前重核 main/生产部署、CI及现有未知修改。使用正常 PR/合并和既有部署流程，记录实际发布时点/前一部署；不 force push，不改业务 URL，不清用户存档。
3. 合成验证继续本地外网阻断。上线仅用获准的自然流量只读观测核验版本、参数、自动字段及 UTM，不向生产制造行为。未验证真实字段前不承诺完整传输隐私或归因。
4. 发生重复观测、交互错误或字段泄漏则停止发布；已发布后使用正常 revert/前一已核实部署。Saved 新字段可选，旧代码忽略；独立 pending 旧代码不读取。不要删除 GA 历史或清用户保存数据。若隐私修复必须保留，单独最小提交，不能为回滚测量恢复自由 query 传输。

下一最高优先级：审候选与剩余传输/归因限制，再决定发布及新维度登记；不是继续扩页或用本地事件计数宣称增长。

### 候选验证补充

- `tests-acceptance.log`：7个原生测试通过；静态扫描确认21个含PDF页面、62个链接、26个预览元素均有已知映射和共享观测。首屏静态依赖图最大65,520字节，上限65,536未改；仅16字节余量，后续改动必须继续跑原预算门禁。
- `check-acceptance.log`：205文件，0 errors / 0 warnings（100条既有 hints）。`demo.log`退出0。`build-candidate.log`退出0，包含完整 prebuild/postbuild。
- `pdf-double-init.log`保留跨模块副本双计失败；`pdf-double-init-green.log`验证修正后，document级Symbol去重、键盘/中键/旧下载范围均通过，外部成功0。
- 写存储失败但旧数据可读时，组件内最新Saved优先于旧存储；出发还要核对真实落盘内容与当前revision/盘面/笔记/用时，失败不生成成功往返证明。已打开的每日页面也记录初始化JST日，跨日不开始/完成虚假往返。
- 覆盖手机/桌面输入排除、无冲突错误答案、A→B→A/刷新/重开、即时h、原局盘面/笔记/时间等值、练习与guide/浏览器Back、返回后输入、旧h=0/1/缺失、最后一格先input后complete、完成恢复、每日重复难度slot与归档、过期/缺失/损坏/revision/其他局/generation失效、跨JST、存储/队列抛错、embed、五档/首页/play、PDF键盘/中键/隐藏及失败预览、全部打印入口和print抛错/afterprint不增报。
- 未单独浏览器强制命中引擎兜底提示分支；未验真机/WebKit、真正由浏览器保留的BFCache（Back通过不等于证明BFCache）、实际打印完成、PDF服务端下载成功、真实gtag自动字段/增强测量/UTM和自然流量接收；不把本地消费者当Google接收。生成器资源加载失败分支未单独模拟。上述限制不能从全绿检查推断为已验收。

最终静态浏览器 `browser-acceptance.log`：47项通过，390/1440宽；context内外部成功请求0、外部阻断94、本地测试替身collect8（逐个检查哨兵/禁止字段）。该8次不是Google请求/接收。四个slice的最终复核为 `input/return/pdf/privacy-green-final.log`，均退出0。没有把开发工具栏的storage异常当作产品通过，也没有为它放宽浏览器门禁。
