// numpredo 数独引擎 —— 框架无关公共入口
// 构建期生成题库、客户端运行、导出 SVG 三处共用同一套核心。
export * from './types.ts';
export * from './board.ts';
export { countSolutions, hasUniqueSolution, solveOne } from './countSolver.ts';
export { logicalSolve, traceFirstElimination } from './logicalSolver.ts';
export * from './svg.ts';
export { TECH_WEIGHT, LEVELS, LEVEL_META, levelOf, levelFromHardestWeight } from './difficulty.ts';
export { fullSolution, generatePuzzle, generateByLevel, LEVEL_MIN_CLUES } from './generator.ts';
