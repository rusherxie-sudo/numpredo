# numpredo 数独引擎（v0.1 原型）

框架无关的纯 TypeScript 包。**一套核心三处复用**：构建期生成题库、客户端运行游戏、导出 SVG 图解。

## 运行

```bash
npm run demo   # node v24 原生跑 .ts，无需编译/依赖
```

## 模块

| 文件 | 职责 |
|------|------|
| `types.ts` | 核心类型（Grid / SolveResult / Puzzle / DifficultyLevel） |
| `board.ts` | 位掩码候选、units/peers 预计算、序列化 |
| `countSolver.ts` | 唯一解校验（MRV 回溯，数到 2 即停）+ solveOne |
| `logicalSolver.ts` | 人类技巧链 + 难度评分（提示/攻略演示共用核心） |
| `difficulty.ts` | 技巧权重 → 难度等级（初級/中級/上級/難問/超難問） |
| `generator.ts` | 完整解 → 对称挖空（每步保证唯一解 + 逻辑可解） |

## 技巧链（难度递增）

`nakedSingle → hiddenSingle → lockedCandidates → nakedPair → hiddenPair → nakedTriple → xWing`

难度 = 求解所用「最难技巧」（主）+ 加权步数（次）—— **按认知难度，不是挖空数**。

## 品质保障（demo.ts 自动断言，可接 CI）

每道入库题必须通过三条断言：

1. **唯一解**：`hasUniqueSolution(puzzle) === true`
2. **纯逻辑可解（no-guessing）**：`logicalSolve(puzzle).solved === true`
3. **逻辑解 = 生成解**：求解结果与唯一解一致

### v0.1 验证结果

- 16 题全部通过三断言，~7ms/题
- 定向生成：**初級 / 中級 / 上級 ✓ 命中**（覆盖 SEO 主力难度词）
- 難問 / 超難問命中率低 —— 随机题中高级技巧需求稀有（数独客观规律），非品质问题

## 待办（提升难档 + 集成）

- [ ] 扩充高级技巧：XY-Wing / Swordfish / 唯一矩形 → 难题更易正确归类
- [ ] 离线批量生成 + 按难度筛选入库（存 R2），运行时直取
- [ ] SVG 渲染组件（盘面/候选/高亮）—— 交互盘面与攻略图解共用
- [ ] Astro 集成：难度页可玩岛 + 构建期题库生成
