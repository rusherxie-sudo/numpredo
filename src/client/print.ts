// 打印客户端：选难度+题数 → 从预生成题库随机抽样（难度保真・零等待）→ 渲染题面+答案 → window.print()。
// 不再客户端实时生成：generateByLevel 难度命中率低（hard 实测 0/5，会把中级题标成難問印在纸上）、
// 且 12 问要冻结主线程数秒。题库按档位动态 import（点击时才加载对应 JSON，不进首包）。
import {
  gridFromString,
  renderBoardSvg,
  computeCandidates,
  LIGHT_THEME,
  type Grid,
} from '../engine/index.ts';
import { track } from './track.ts';

const LEVEL_JA: Record<string, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  hard: '難問',
  extreme: '超難問',
};

interface PoolJson {
  puzzles: Array<{ puzzle: string; solution: string }>;
}
// Vite 会把每个 JSON 拆成独立 chunk，仅在选中该档位并点击时加载
const POOLS: Record<string, () => Promise<{ default: PoolJson }>> = {
  beginner: () => import('../data/puzzles/beginner.json'),
  intermediate: () => import('../data/puzzles/intermediate.json'),
  advanced: () => import('../data/puzzles/advanced.json'),
  hard: () => import('../data/puzzles/hard.json'),
  extreme: () => import('../data/puzzles/extreme.json'),
};

function setup(): void {
  const root = document.getElementById('print-tool');
  if (!root) return;

  let level = 'advanced';
  let count = 6;
  let cand = false;

  // 難易度別ページ（/print/[level]/）はサーバー側で data-lv-default に初期難易度を埋める。
  // hasOwn で自有キーのみ許可（原型链キー穿透対策、?lv= と同じ守り）
  const defLv = root.dataset.lvDefault ?? '';
  if (defLv && Object.prototype.hasOwnProperty.call(LEVEL_JA, defLv)) level = defLv;

  const status = document.getElementById('print-status')!;
  const mount = document.getElementById('print-mount')!;

  root.querySelectorAll<HTMLElement>('[data-lv]').forEach((c) =>
    c.addEventListener('click', () => {
      level = c.dataset.lv!;
      root.querySelectorAll('[data-lv]').forEach((x) => x.classList.toggle('on', x === c));
    }),
  );
  // ?lv= 深链：難易度別セクション/難易度ページから難易度を預選して直達（例 /print/?lv=extreme）。
  // hasOwn で自有キーのみ許可（?lv=constructor 等の原型链キー穿透で level が汚染されるのを防ぐ）
  const urlLv = new URLSearchParams(location.search).get('lv') ?? '';
  if (urlLv && Object.prototype.hasOwnProperty.call(LEVEL_JA, urlLv)) {
    level = urlLv;
    root.querySelectorAll<HTMLElement>('[data-lv]').forEach((x) => x.classList.toggle('on', x.dataset.lv === urlLv));
  }
  root.querySelectorAll<HTMLElement>('[data-ct]').forEach((c) =>
    c.addEventListener('click', () => {
      count = Number(c.dataset.ct);
      root.querySelectorAll('[data-ct]').forEach((x) => x.classList.toggle('on', x === c));
    }),
  );
  const candBox = document.getElementById('print-cand') as HTMLInputElement;
  candBox.addEventListener('change', () => (cand = candBox.checked));

  document.getElementById('print-go')!.addEventListener('click', () => void go());

  async function go(): Promise<void> {
    status.textContent = `${LEVEL_JA[level]}の問題集を作成中…`;
    mount.innerHTML = '';
    let pool: PoolJson['puzzles'];
    try {
      const mod = await POOLS[level]();
      pool = (mod.default ?? mod).puzzles;
    } catch {
      status.textContent = '問題の読み込みに失敗しました。通信環境を確認して、もう一度お試しください。';
      return;
    }
    // 不放回随机抽 count 道（每次点击都是新的随机组合）
    const idxs = Array.from(pool.keys());
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const items: Array<{ puzzle: Grid; solution: Grid }> = idxs.slice(0, count).map((i) => ({
      puzzle: gridFromString(pool[i].puzzle),
      solution: gridFromString(pool[i].solution),
    }));

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

    status.textContent = '作成完了。印刷ダイアログを開きます…';
    track('print_pdf', { level, count, candidates: cand });
    setTimeout(() => window.print(), 300);
  }
}

setup();
