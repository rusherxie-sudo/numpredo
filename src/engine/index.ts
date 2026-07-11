// numpredo 数独引擎 —— 框架无关公共入口
// 构建期生成题库、客户端运行、导出 SVG 三处共用同一套核心。
export * from './types.ts';
export * from './board.ts';
export { countSolutions, hasUniqueSolution, solveOne } from './countSolver.ts';
export { logicalSolve, traceFirstElimination, traceKeySteps, TECHNIQUE_NAMES, type TechniqueFn } from './logicalSolver.ts';
export * from './svg.ts';
export { TECH_INFO, renderStepFigures, type StepFigure } from './stepFigures.ts';
export { TECH_WEIGHT, LEVELS, LEVEL_META, levelOf, levelFromHardestWeight } from './difficulty.ts';
export { fullSolution, generatePuzzle, generateByLevel, LEVEL_MIN_CLUES } from './generator.ts';
export {
  type KillerCage, type KillerContext, type KillerPuzzle,
  buildKillerContext, cageFeasibleMasks, makeCageComboTechnique, cagesSatisfied,
  logicalSolveKiller, countSolutionsKiller, generateKillerCages, generateKillerPuzzle,
} from './killer.ts';
