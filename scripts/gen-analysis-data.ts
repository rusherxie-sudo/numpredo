// 公开逐题分析数据。数值全部从 git 题库和生产逻辑求解器重新计算，
// 不复制题面或答案；方便读者复核汇总，同时避免把完整题库当下载包分发。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
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
const levelLabels: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  hard: '難問',
  extreme: '超難問',
};
const levelColors: Record<string, string> = {
  beginner: '#2f7d5b',
  intermediate: '#28798a',
  advanced: '#5667a8',
  hard: '#a46b26',
  extreme: '#ad4242',
};
const levelStats: Array<{ level: string; count: number; clueAvg: number; stepAvg: number }> = [];

for (const level of ['beginner', 'intermediate', 'advanced', 'hard', 'extreme']) {
  const pack = JSON.parse(readFileSync(`src/data/puzzles/${level}.json`, 'utf8')) as {
    puzzles: Array<{ puzzle: string }>;
  };
  let clueTotal = 0;
  let stepTotal = 0;
  pack.puzzles.forEach((puzzle, index) => {
    const grid = gridFromString(puzzle.puzzle);
    const result = logicalSolve(grid);
    if (!result.solved) throw new Error(`${level} No.${index + 1} 无法由逻辑求解器完答`);
    const clues = grid.filter(Boolean).length;
    clueTotal += clues;
    stepTotal += result.steps.length;
    rows.push([
      level,
      index + 1,
      clues,
      result.steps.length,
      result.hardest ?? 'nakedSingle',
      ...techniques.map((technique) => result.techniqueCounts[technique] ?? 0),
    ].join(','));
  });
  levelStats.push({
    level,
    count: pack.puzzles.length,
    clueAvg: clueTotal / pack.puzzles.length,
    stepAvg: stepTotal / pack.puzzles.length,
  });
}

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/numpredo-puzzle-analysis.csv', `${rows.join('\n')}\n`);
console.log(`✓ 逐题分析 CSV：${rows.length - 1} 题 → public/data/numpredo-puzzle-analysis.csv`);

const totalPuzzles = levelStats.reduce((sum, item) => sum + item.count, 0);
const maxStepAvg = Math.max(...levelStats.map((item) => item.stepAvg));
const chartRows = levelStats.map((item, index) => {
  const y = 260 + index * 58;
  const width = Math.round((item.stepAvg / maxStepAvg) * 390);
  return `
    <text x="78" y="${y + 21}" font-size="22" font-weight="700" fill="#14201b">${levelLabels[item.level]}</text>
    <rect x="188" y="${y}" width="390" height="27" rx="5" fill="#e8edeb"/>
    <rect x="188" y="${y}" width="${width}" height="27" rx="5" fill="${levelColors[item.level]}"/>
    <text x="606" y="${y + 20}" font-size="18" fill="#3f4a45">${item.count.toLocaleString('ja-JP')}問</text>
    <text x="732" y="${y + 20}" font-size="18" fill="#3f4a45">ヒント平均 ${item.clueAvg.toFixed(1)}</text>
    <text x="970" y="${y + 20}" font-size="18" fill="#3f4a45">論理手数 ${item.stepAvg.toFixed(1)}</text>`;
}).join('');

const chartSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f4f6f5"/>
  <rect x="34" y="34" width="1132" height="562" rx="18" fill="#ffffff" stroke="#d9e1de"/>
  <text x="70" y="82" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#1f7a5c">NUMPREDO RESEARCH</text>
  <text x="70" y="151" font-family="Arial, sans-serif" font-size="49" font-weight="700" fill="#14201b">${totalPuzzles.toLocaleString('ja-JP')}問の数独を全件分析</text>
  <text x="70" y="199" font-family="Arial, sans-serif" font-size="25" fill="#3f4a45">ヒント数だけでは難易度は決まらない</text>
  <text x="188" y="235" font-family="Arial, sans-serif" font-size="15" fill="#66716b">平均論理手数（バー）</text>
  <g font-family="Arial, sans-serif">${chartRows}</g>
  <line x1="70" y1="555" x2="1130" y2="555" stroke="#d9e1de"/>
  <text x="70" y="584" font-family="Arial, sans-serif" font-size="17" fill="#5c6b66">唯一解・論理完答を100%検証　｜　numpredo.com/research/puzzle-analysis/</text>
</svg>`;

await sharp(Buffer.from(chartSvg))
  .png({ compressionLevel: 9 })
  .toFile('public/data/numpredo-puzzle-analysis.png');
console.log('✓ 研究图表 PNG：1200×630 → public/data/numpredo-puzzle-analysis.png');
