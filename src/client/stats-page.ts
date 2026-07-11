// /stats/ ページの島：ローカル統計（stats.v1 / daily.log / streak / best）を読んで
// 集計・実績一覧を描画する。データは端末内のみ（登録不要・サーバー送信なし）。
import { ACHIEVEMENTS, computeUnlocked, readStats, readDailyLog, readStreak, readSeen } from './achievements.ts';

const LV_ORDER = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];
const LV_JA: Record<string, string> = {
  beginner: '初級', intermediate: '中級', advanced: '上級', hard: '難問', extreme: '超難問',
  daily: 'デイリー', diagonal: '対角線',
};
const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;
const fmt = (ms: number): string => `${pad2((ms / 60000) | 0)}:${pad2(((ms / 1000) | 0) % 60)}`;
const fmtLong = (ms: number): string => {
  const h = (ms / 3600000) | 0;
  const m = ((ms % 3600000) / 60000) | 0;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
};

function setup(root: HTMLElement): void {
  const stats = readStats();
  const dailyLog = readDailyLog();
  const streak = readStreak();
  // 表示は unlocked ∪ seen：一度獲得した実績は streak 断签等で「回锁」せず保持
  const unlocked = new Set([...computeUnlocked(stats, dailyLog, streak), ...readSeen()]);

  const total = stats.length;
  const totalMs = stats.reduce((s, e) => s + (e.ms || 0), 0);
  const dailyDays = Object.keys(dailyLog).length;
  // 現役ストリークのみ表示（bumpStreak と同じ「今日/昨日に完了していれば有効」判定は
  // last キーで行う——log は遡及記入を含むため streak 判定には使わない）
  const last = ((): string | null => { try { return localStorage.getItem('numpredo.daily.last'); } catch { return null; } })();
  const JST = 9 * 3600 * 1000;
  const dayStr = (shift: number): string => {
    const d = new Date(Date.now() + JST + shift * 86400000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };
  const activeStreak = last === dayStr(0) || last === dayStr(-1) ? streak : 0;

  const tiles = [
    ['総クリア数', total ? `${total}問` : '—'],
    ['総プレイ時間', totalMs ? fmtLong(totalMs) : '—'],
    ['デイリー達成', dailyDays ? `${dailyDays}日` : '—'],
    ['連続記録', activeStreak > 0 ? `${activeStreak}日連続` : '—'],
  ];

  // 難易度別：クリア数 / 最速 / 平均
  const rows = LV_ORDER.map((lv) => {
    const es = stats.filter((e) => e.lv === lv && e.ms > 0);
    if (!es.length) return `<tr><td>${LV_JA[lv]}</td><td>0</td><td>—</td><td>—</td></tr>`;
    const best = Math.min(...es.map((e) => e.ms));
    const avg = es.reduce((s, e) => s + e.ms, 0) / es.length;
    return `<tr><td>${LV_JA[lv]}</td><td>${es.length}</td><td>${fmt(best)}</td><td>${fmt(avg)}</td></tr>`;
  }).join('');

  const achv = ACHIEVEMENTS.map((a) => {
    const on = unlocked.has(a.id);
    return `<div class="st-a ${on ? 'on' : ''}" title="${a.desc}"><span class="st-a-ic">${on ? a.icon : '🔒'}</span><b>${a.name}</b><span class="st-a-d">${a.desc}</span></div>`;
  }).join('');

  root.innerHTML = `
    <div class="st-tiles">${tiles.map(([h, v]) => `<div class="st-tile"><div class="st-tile-v">${v}</div><div class="st-tile-h">${h}</div></div>`).join('')}</div>
    <h2>難易度別の記録</h2>
    <div class="st-twrap"><table class="st-table">
      <thead><tr><th>難易度</th><th>クリア数</th><th>最速</th><th>平均</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h2>実績（${unlocked.size} / ${ACHIEVEMENTS.length}）</h2>
    <div class="st-achv">${achv}</div>
    ${total === 0 ? '<p class="st-empty">まだ記録がありません。<a href="/play/beginner/">初級から</a>遊んでみましょう——クリアするとここに記録と実績がたまります。</p>' : ''}
  `;
}

const mount = document.getElementById('stats-mount');
if (mount) setup(mount);
