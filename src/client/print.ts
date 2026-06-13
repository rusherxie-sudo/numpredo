// 打印客户端：选难度+题数 → 引擎实时生成题目 → 渲染题面+答案 → window.print()。
import {
  generateByLevel,
  renderBoardSvg,
  computeCandidates,
  LIGHT_THEME,
  type DifficultyLevel,
  type Grid,
} from '../engine/index.ts';

const LEVEL_JA: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  hard: '難問',
  extreme: '超難問',
};

function setup(): void {
  const root = document.getElementById('print-tool');
  if (!root) return;

  let level = 'advanced';
  let count = 6;
  let cand = false;

  const status = document.getElementById('print-status')!;
  const mount = document.getElementById('print-mount')!;

  root.querySelectorAll<HTMLElement>('[data-lv]').forEach((c) =>
    c.addEventListener('click', () => {
      level = c.dataset.lv!;
      root.querySelectorAll('[data-lv]').forEach((x) => x.classList.toggle('on', x === c));
    }),
  );
  root.querySelectorAll<HTMLElement>('[data-ct]').forEach((c) =>
    c.addEventListener('click', () => {
      count = Number(c.dataset.ct);
      root.querySelectorAll('[data-ct]').forEach((x) => x.classList.toggle('on', x === c));
    }),
  );
  const candBox = document.getElementById('print-cand') as HTMLInputElement;
  candBox.addEventListener('change', () => (cand = candBox.checked));

  document.getElementById('print-go')!.addEventListener('click', () => {
    status.textContent = `${LEVEL_JA[level]}を ${count} 問生成中…`;
    mount.innerHTML = '';
    setTimeout(() => {
      const t0 = Date.now();
      // hard/extreme は命中が稀 → 試行を抑え最接近を採用（生成時間を抑制）
      const attempts = level === 'hard' || level === 'extreme' ? 25 : 40;
      const items: Array<{ puzzle: Grid; solution: Grid }> = [];
      for (let i = 0; i < count; i++) {
        const p = generateByLevel(level as DifficultyLevel, attempts).puzzle;
        items.push({ puzzle: p.puzzle, solution: p.solution });
      }

      const probs = items
        .map((it, i) => {
          const given = it.puzzle.map((v) => v !== 0);
          const svg = renderBoardSvg(it.puzzle, {
            given,
            candidates: cand ? computeCandidates(it.puzzle) : undefined,
            theme: LIGHT_THEME,
            cell: 38,
          });
          return `<figure class="pz"><figcaption>第 ${i + 1} 問（${LEVEL_JA[level]}）</figcaption>${svg}</figure>`;
        })
        .join('');

      const ans = items
        .map((it, i) => {
          const svg = renderBoardSvg(it.solution, { given: new Array(81).fill(true), theme: LIGHT_THEME, cell: 22 });
          return `<figure class="az"><figcaption>第 ${i + 1} 問</figcaption>${svg}</figure>`;
        })
        .join('');

      mount.innerHTML =
        `<div class="print-head"><span class="ph-logo">numpre<b>do</b></span><span>${LEVEL_JA[level]}の数独・ナンプレ問題集（${count}問）</span></div>` +
        `<div class="pz-grid">${probs}</div>` +
        `<div class="answer-page"><h3>解答</h3><div class="az-grid">${ans}</div></div>`;

      status.textContent = `生成完了（${((Date.now() - t0) / 1000).toFixed(1)}秒）。印刷ダイアログを開きます…`;
      setTimeout(() => window.print(), 300);
    }, 30);
  });
}

setup();
