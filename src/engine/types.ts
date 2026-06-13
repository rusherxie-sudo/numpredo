// 数独引擎核心类型（框架无关）

/** 单格值：0 = 空，1..9 = 已填数字 */
export type Cell = number;

/** 9×9 棋盘，长度 81，行优先（index = row*9 + col） */
export type Grid = Cell[];

/** 难度等级，对应站点 URL：初級/中級/上級/難問/超難問 */
export type DifficultyLevel =
  | 'beginner' // 初級
  | 'intermediate' // 中級
  | 'advanced' // 上級
  | 'hard' // 難問
  | 'extreme'; // 超難問

/** 求解过程中的单步（用于难度评级、提示、攻略图解演示） */
export interface SolveStep {
  /** 技巧标识，如 nakedSingle / hiddenSingle / xWing */
  technique: string;
  /** 落子格（若该步为确定填入） */
  cell?: number;
  /** 落子数字 */
  digit?: number;
  /** 被消除的候选 [cell, digit][]（若该步为候选消除） */
  eliminations?: Array<[number, number]>;
}

/** 逻辑求解结果 */
export interface SolveResult {
  /** 是否仅靠已实现的人类技巧（不猜测）解出 */
  solved: boolean;
  /** 解出/卡住时的盘面 */
  grid: Grid;
  /** 逐步记录 */
  steps: SolveStep[];
  /** 各技巧使用次数 */
  techniqueCounts: Record<string, number>;
  /** 用到的最难技巧标识（null = 空盘/无步骤） */
  hardest: string | null;
  /** 加权难度分（用于同档内排序与校准） */
  score: number;
}

/** 一道成品题（入库前必须通过品质断言：唯一解 + 逻辑可解） */
export interface Puzzle {
  /** 题面（含空格 0） */
  puzzle: Grid;
  /** 唯一解 */
  solution: Grid;
  /** 难度等级 */
  level: DifficultyLevel;
  /** 提示数（已填格数） */
  clues: number;
  /** 加权难度分 */
  score: number;
  /** 最难技巧 */
  hardest: string;
  /** 技巧使用次数分布 */
  techniqueCounts: Record<string, number>;
}
