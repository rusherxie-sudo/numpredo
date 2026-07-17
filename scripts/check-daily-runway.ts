// 日替わり5問の題庫余量を CI で検証する。
// daily.astro は未来 60 日分を HTML に埋め込むため、枯渇直前ではなく余裕を持って止める。
import { readFileSync } from 'node:fs';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];
const EPOCH = Math.floor(Date.UTC(2026, 5, 14) / 86400000);
const JST = 9 * 3600 * 1000;
const SETS_SKIP = 55;
const REQUIRED_DAYS = 90; // 60 日の配信窓 + 30 日の再生成・デプロイ猶予

const elapsedDays = Math.floor((Date.now() + JST) / 86400000) - EPOCH;
const remaining = LEVELS.map((level) => {
  const raw = JSON.parse(readFileSync(`src/data/puzzles/${level}.json`, 'utf-8')) as { puzzles?: unknown[] };
  return { level, days: (raw.puzzles?.length ?? 0) - SETS_SKIP - elapsedDays };
});
const bottleneck = remaining.reduce((a, b) => (a.days <= b.days ? a : b));

console.log(`日替わり5問の余量: ${remaining.map((x) => `${x.level}=${x.days}日`).join(' / ')}`);
if (bottleneck.days < REQUIRED_DAYS) {
  throw new Error(`日替わり題庫の余量不足（${bottleneck.level}: ${bottleneck.days}日、必要: ${REQUIRED_DAYS}日）。CFG を拡張して npm run gen:pool を実行・コミットしてください。`);
}
