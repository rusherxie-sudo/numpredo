// 実績（アチーブメント）定義と判定。**純関数設計**：解放状態は保存せず、毎回
// 統計データ（stats.v1 / daily.log / streak）から計算する——データが真実源なので
// 判定ロジックを後から直しても既存ユーザーの実績が正しく再計算される。
// 保存するのは「トースト表示済み id」（numpredo.achv.seen）だけ。
export interface StatEntry {
  t: number; // 完成時刻(ms)
  lv: string; // 難易度 slug（daily は当日の档、変体は変体キー）
  ms: number; // クリアタイム
  d: number; // 1=デイリー
  day: string; // JST 日付 YYYY-MM-DD
  h?: number; // 1=ヒント使用
  r?: number; // 1=自己ベスト更新
}

export interface Achievement {
  id: string;
  name: string; // 和風の称号
  desc: string;
  icon: string; // 絵文字（和の意匠）
}

const LEVELS5 = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-clear', name: 'はじめての一勝', desc: 'はじめて問題をクリアする', icon: '🌸' },
  { id: 'clear-beginner', name: '初級皆伝', desc: '初級をクリアする', icon: '🎋' },
  { id: 'clear-intermediate', name: '中級皆伝', desc: '中級をクリアする', icon: '🎐' },
  { id: 'clear-advanced', name: '上級皆伝', desc: '上級をクリアする', icon: '⛩️' },
  { id: 'clear-hard', name: '難問突破', desc: '難問をクリアする', icon: '🗻' },
  { id: 'clear-extreme', name: '超難問制覇', desc: '超難問をクリアする', icon: '🏯' },
  { id: 'all-levels', name: '五段位全冠', desc: '全難易度をクリアする', icon: '👑' },
  { id: 'streak-3', name: '三日坊主卒業', desc: 'デイリーを3日連続でクリアする', icon: '🍡' },
  { id: 'streak-7', name: '七日の習慣', desc: 'デイリーを7日連続でクリアする', icon: '🎏' },
  { id: 'streak-30', name: '一ヶ月の道', desc: 'デイリーを30日連続でクリアする', icon: '🎌' },
  { id: 'total-10', name: '十番勝負', desc: '合計10問クリアする', icon: '🀄' },
  { id: 'total-50', name: '五十番勝負', desc: '合計50問クリアする', icon: '🎴' },
  { id: 'total-100', name: '百戦錬磨', desc: '合計100問クリアする', icon: '🏮' },
  { id: 'no-hint', name: '自力の一勝', desc: 'ヒントを使わずにクリアする', icon: '🦉' },
  { id: 'no-hint-10', name: '不惑の十勝', desc: 'ヒントなしで10問クリアする', icon: '🐉' },
  { id: 'speedy', name: '韋駄天', desc: '中級以上を5分以内にクリアする', icon: '⚡' },
  { id: 'record-5', name: '記録破り', desc: '自己ベストを5回更新する', icon: '📜' },
  { id: 'daily-first', name: '今日の一問デビュー', desc: 'デイリー問題をはじめてクリアする', icon: '🗓️' },
  { id: 'daily-10', name: '通いの常連', desc: 'デイリー問題を合計10日クリアする', icon: '🍵' },
];

/** 統計データから解放済み実績 id を計算（純関数） */
export function computeUnlocked(stats: StatEntry[], dailyLog: Record<string, number>, streak: number): Set<string> {
  const un = new Set<string>();
  const total = stats.length;
  if (total >= 1) un.add('first-clear');
  if (total >= 10) un.add('total-10');
  if (total >= 50) un.add('total-50');
  if (total >= 100) un.add('total-100');
  const lvCleared = new Set(stats.map((s) => s.lv));
  for (const lv of LEVELS5) if (lvCleared.has(lv)) un.add(`clear-${lv}`);
  if (LEVELS5.every((lv) => lvCleared.has(lv))) un.add('all-levels');
  if (streak >= 3) un.add('streak-3');
  if (streak >= 7) un.add('streak-7');
  if (streak >= 30) un.add('streak-30');
  // h === 0 のみ「ノーヒント」と認める（h 未記録の旧データを無条件でノーヒント扱いしない）
  if (stats.some((s) => s.h === 0)) un.add('no-hint');
  if (stats.filter((s) => s.h === 0).length >= 10) un.add('no-hint-10');
  // 「中級以上」は五档の白名单で判定（変体 'diagonal' や兜底 'daily' を誤って計上しない）
  const SPEEDY_LV = ['intermediate', 'advanced', 'hard', 'extreme'];
  if (stats.some((s) => s.ms > 0 && s.ms <= 300000 && SPEEDY_LV.includes(s.lv))) un.add('speedy');
  if (stats.filter((s) => s.r === 1).length >= 5) un.add('record-5');
  const dailyDays = Object.keys(dailyLog).length;
  if (dailyDays >= 1) un.add('daily-first');
  if (dailyDays >= 10) un.add('daily-10');
  return un;
}

// —— 共有データ読取（stats ページとゲーム島の両方から使う。損壊は型検証で空に落とす）——
const sGet = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
export function readStats(): StatEntry[] {
  try {
    const p = JSON.parse(sGet('numpredo.stats.v1') ?? '[]');
    return Array.isArray(p) ? (p as StatEntry[]) : [];
  } catch { return []; }
}
export function readDailyLog(): Record<string, number> {
  try {
    const p = JSON.parse(sGet('numpredo.daily.log') ?? '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, number>) : {};
  } catch { return {}; }
}
export function readStreak(): number {
  return Number(sGet('numpredo.daily.streak') ?? '0') || 0;
}
/** トースト表示済み実績 id（achv.seen）。streak 断签等で computeUnlocked が「回锁」しても
 *  一度獲得した実績は表示上保持する——表示側は unlocked ∪ seen を使うこと */
export function readSeen(): string[] {
  try {
    const p = JSON.parse(sGet('numpredo.achv.seen') ?? '[]');
    return Array.isArray(p) ? (p as string[]) : [];
  } catch { return []; }
}
