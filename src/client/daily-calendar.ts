// デイリーカレンダー（月历打卡）：daily.log（日付→クリアタイム）を月grid で可視化。
// /daily/ と /daily/archive/ の両方に挂载——過去の未クリア日は ?d= 付きでアーカイブへ誘導。
// 全て JST 基準（ゲーム側と同一の日界）。
import { readDailyLog } from './achievements.ts';

const JST = 9 * 3600 * 1000;
const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;
const fmt = (ms: number): string => `${pad2((ms / 60000) | 0)}:${pad2(((ms / 1000) | 0) % 60)}`;
const todayIdx = (): number => Math.floor((Date.now() + JST) / 86400000);
const idxToYmd = (idx: number): { y: number; m: number; d: number; str: string } => {
  const dt = new Date(idx * 86400000);
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  return { y, m, d, str: `${y}-${pad2(m)}-${pad2(d)}` };
};
const ymdToIdx = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

function setup(root: HTMLElement): void {
  const epoch = Number(root.dataset.epoch ?? NaN); // 上线日の日序号（これより前は出題なし）
  // アーカイブに埋め込み済みの最終日（構築日の前日）。ビルド停滞時、これ以降の過去日はリンクにしない
  const maxDay = Number(root.dataset.maxday ?? NaN);
  if (!Number.isFinite(epoch)) return;
  const log = readDailyLog();
  const tIdx = todayIdx();
  const today = idxToYmd(tIdx);
  const epochYmd = idxToYmd(epoch);
  const selected = new URLSearchParams(location.search).get('d') ?? '';

  // 表示月（YYYY, M）。範囲は [上线月, 今月]
  let vy = today.y, vm = today.m;
  const monthKey = (y: number, m: number): number => y * 12 + m;
  const minKey = monthKey(epochYmd.y, epochYmd.m);
  const maxKey = monthKey(today.y, today.m);

  function render(): void {
    const first = ymdToIdx(vy, vm, 1);
    const daysInMonth = ymdToIdx(vm === 12 ? vy + 1 : vy, vm === 12 ? 1 : vm + 1, 1) - first;
    const firstDow = new Date(first * 86400000).getUTCDay(); // 0=日
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<span class="dc-cell dc-void"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const idx = first + d - 1;
      const { str } = idxToYmd(idx);
      const isToday = idx === tIdx;
      const inRange = idx >= epoch && idx <= tIdx;
      const done = !!log[str];
      const cls = ['dc-cell', isToday ? 'dc-today' : '', done ? 'dc-done' : '', str === selected ? 'dc-sel' : ''].filter(Boolean).join(' ');
      const archivable = !Number.isFinite(maxDay) || idx <= maxDay;
      if (!inRange) {
        cells += `<span class="dc-cell dc-out">${d}</span>`;
      } else if (done) {
        cells += `<span class="${cls}" title="クリア ${fmt(log[str])}">${d}<i>✓</i></span>`;
      } else if (isToday) {
        cells += `<a class="${cls}" href="/daily/" title="今日の一問へ">${d}</a>`;
      } else if (archivable) {
        cells += `<a class="${cls}" href="/daily/archive/?d=${str}" title="この日の問題を解く">${d}</a>`;
      } else {
        cells += `<span class="dc-cell dc-out">${d}</span>`; // 未ビルドぶんの過去日（デプロイ後に解けるようになる）
      }
    }
    const key = monthKey(vy, vm);
    root.innerHTML =
      `<div class="dc-head">` +
      `<button type="button" class="dc-nav" data-go="-1" ${key <= minKey ? 'disabled' : ''} aria-label="前の月">‹</button>` +
      `<span class="dc-title">${vy}年${vm}月</span>` +
      `<button type="button" class="dc-nav" data-go="1" ${key >= maxKey ? 'disabled' : ''} aria-label="次の月">›</button>` +
      `</div>` +
      `<div class="dc-grid">${['日', '月', '火', '水', '木', '金', '土'].map((w) => `<span class="dc-w">${w}</span>`).join('')}${cells}</div>`;
    root.querySelectorAll<HTMLButtonElement>('.dc-nav').forEach((b) =>
      b.addEventListener('click', () => {
        const go = Number(b.dataset.go);
        vm += go;
        if (vm < 1) { vm = 12; vy--; }
        if (vm > 12) { vm = 1; vy++; }
        render();
      }),
    );
  }
  render();
}

document.querySelectorAll<HTMLElement>('[data-daily-cal]').forEach(setup);
