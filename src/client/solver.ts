// 求解器客户端：输入题目 → 引擎 solveOne + 唯一解校验 → 渲染解盘（和风 SVG）。
import { gridFromString, solveOne, countSolutions, renderBoardSvg, LIGHT_THEME, DARK_THEME } from '../engine/index.ts';

function setup(): void {
  const input = document.getElementById('solver-input') as HTMLTextAreaElement | null;
  const btn = document.getElementById('solver-btn');
  const out = document.getElementById('solver-out');
  if (!input || !btn || !out) return;

  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = dark ? DARK_THEME : LIGHT_THEME;

  btn.addEventListener('click', () => {
    out.innerHTML = '';
    let grid;
    try {
      grid = gridFromString(input.value);
    } catch {
      out.innerHTML = '<p class="solver-msg err">81マス（1〜9、空欄は . または 0）で入力してください。</p>';
      return;
    }
    try {
      const given = grid.map((v) => v !== 0);
      const n = countSolutions(grid, 2);
      if (n === 0) {
        out.innerHTML = '<p class="solver-msg err">この問題には解がありません（入力を確認してください）。</p>';
        return;
      }
      const sol = solveOne(grid);
      if (!sol) {
        out.innerHTML = '<p class="solver-msg err">解けませんでした。</p>';
        return;
      }
      const note = n > 1 ? '<p class="solver-msg">※ この問題は解が複数あります。一例を表示しています。</p>' : '';
      out.innerHTML =
        note +
        renderBoardSvg(sol, { given, theme, cell: 44, title: '数独の解答', desc: 'numpredo ソルバーによる解答' });
    } catch {
      out.innerHTML = '<p class="solver-msg err">解答中にエラーが発生しました。入力を確認してもう一度お試しください。</p>';
    }
  });
}

setup();
