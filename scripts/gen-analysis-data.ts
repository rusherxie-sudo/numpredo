// 公开逐题分析数据。数值全部从 git 题库和生产逻辑求解器重新计算，
// 不复制题面或答案；方便读者复核汇总，同时避免把完整题库当下载包分发。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gridFromString, logicalSolve } from '../src/engine/index.ts';

const techniques = [
  'nakedSingle',
  'hiddenSingle',
  'lockedCandidates',
  'nakedPair',
  'hiddenPair',
  'nakedTriple',
  'skyscraper',
  'xWing',
  'swordfish',
] as const;

const rows: string[] = [
  ['level', 'puzzle_id', 'clues', 'logical_steps', 'hardest_technique', ...techniques].join(','),
];

for (const level of ['beginner', 'intermediate', 'advanced', 'hard', 'extreme']) {
  const pack = JSON.parse(readFileSync(`src/data/puzzles/${level}.json`, 'utf8')) as {
    puzzles: Array<{ puzzle: string }>;
  };
  pack.puzzles.forEach((puzzle, index) => {
    const grid = gridFromString(puzzle.puzzle);
    const result = logicalSolve(grid);
    if (!result.solved) throw new Error(`${level} No.${index + 1} 无法由逻辑求解器完答`);
    rows.push([
      level,
      index + 1,
      grid.filter(Boolean).length,
      result.steps.length,
      result.hardest ?? 'nakedSingle',
      ...techniques.map((technique) => result.techniqueCounts[technique] ?? 0),
    ].join(','));
  });
}

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/numpredo-puzzle-analysis.csv', `${rows.join('\n')}\n`);
console.log(`✓ 逐题分析 CSV：${rows.length - 1} 题 → public/data/numpredo-puzzle-analysis.csv`);
