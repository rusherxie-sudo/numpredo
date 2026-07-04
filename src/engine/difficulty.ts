// 难度评级：难度 = 求解所需「最难技巧」(主) + 加权步数(次)，而非挖空数
import type { DifficultyLevel, SolveResult } from './types.ts';

/** 技巧权重（人类解题认知难度，越大越难） */
export const TECH_WEIGHT: Record<string, number> = {
  nakedSingle: 1, // 裸单：格内仅剩一个候选
  hiddenSingle: 2, // 隐单：某数在单元内仅一格可填
  lockedCandidates: 3, // 区块（指向/声明）
  nakedPair: 4, // 裸对
  hiddenPair: 5, // 隐对
  nakedTriple: 6, // 裸三
  xWing: 9, // X-Wing（鱼）
  swordfish: 10, // Swordfish（三阶鱼，比 X-Wing 更难）——>6 同映射 extreme
  skyscraper: 8, // Skyscraper（单数字链）——>6 同映射 extreme
};

export const LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];

/** 等级 → 日语标签 + URL slug（供站点难度页复用） */
export const LEVEL_META: Record<DifficultyLevel, { ja: string; slug: string }> = {
  beginner: { ja: '初級', slug: 'beginner' },
  intermediate: { ja: '中級', slug: 'intermediate' },
  advanced: { ja: '上級', slug: 'advanced' },
  hard: { ja: '難問', slug: 'hard' },
  extreme: { ja: '超難問', slug: 'extreme' },
};

/** 由「最难技巧权重」映射到难度等级 */
export function levelFromHardestWeight(w: number): DifficultyLevel {
  if (w <= 2) return 'beginner'; // 仅靠裸单/隐单
  if (w <= 3) return 'intermediate'; // + 区块
  if (w <= 5) return 'advanced'; // + 对（裸对/隐对）
  if (w <= 6) return 'hard'; // + 裸三
  return 'extreme'; // 需要 X-Wing 及以上
}

/** 从逻辑求解结果得出难度等级（无步骤视为最易） */
export function levelOf(result: SolveResult): DifficultyLevel {
  const w = result.hardest ? (TECH_WEIGHT[result.hardest] ?? 1) : 1;
  return levelFromHardestWeight(w);
}
