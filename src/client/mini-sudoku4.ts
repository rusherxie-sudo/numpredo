import { MINI4_PUZZLES } from '../data/mini4.ts';
import { track } from './track.ts';

const root = document.querySelector<HTMLElement>('[data-mini4]');
if (root) setup(root);

function setup(root: HTMLElement): void {
  const cells = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mini4-cell]'));
  const label = root.querySelector<HTMLElement>('[data-mini4-label]');
  const status = root.querySelector<HTMLElement>('[data-mini4-status]');
  const prev = root.querySelector<HTMLButtonElement>('[data-mini4-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-mini4-next]');
  const keys = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mini4-key]'));
  let index = 0;
  let selected = -1;
  let values = Array(16).fill(0) as number[];
  let started = false;
  let completed = false;

  const storageKey = (): string => `numpredo.mini4.${MINI4_PUZZLES[index].id}`;

  const persisted = (): number[] | null => {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw || !/^[0-4]{16}$/.test(raw)) return null;
      return [...raw].map(Number);
    } catch {
      return null;
    }
  };

  const save = (): void => {
    try {
      localStorage.setItem(storageKey(), values.join(''));
    } catch {
      // 保存失败不影响游戏。
    }
  };

  const conflicts = (): Set<number> => {
    const out = new Set<number>();
    const groups: number[][] = [];
    for (let i = 0; i < 4; i++) {
      groups.push([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]);
      groups.push([i, i + 4, i + 8, i + 12]);
    }
    groups.push([0, 1, 4, 5], [2, 3, 6, 7], [8, 9, 12, 13], [10, 11, 14, 15]);
    for (const group of groups) {
      for (const digit of [1, 2, 3, 4]) {
        const matches = group.filter((cell) => values[cell] === digit);
        if (matches.length > 1) matches.forEach((cell) => out.add(cell));
      }
    }
    return out;
  };

  const render = (): void => {
    const puzzle = MINI4_PUZZLES[index];
    const bad = conflicts();
    const solved = values.join('') === puzzle.solution;
    cells.forEach((cell, cellIndex) => {
      const given = puzzle.puzzle[cellIndex] !== '.';
      cell.textContent = values[cellIndex] ? String(values[cellIndex]) : '';
      cell.classList.toggle('given', given);
      cell.classList.toggle('selected', cellIndex === selected);
      cell.classList.toggle('conflict', bad.has(cellIndex));
      cell.disabled = given;
      cell.setAttribute('aria-label', `${Math.floor(cellIndex / 4) + 1}行${(cellIndex % 4) + 1}列${values[cellIndex] ? ` ${values[cellIndex]}` : ' 空き'}`);
    });
    if (label) label.textContent = `${puzzle.level} No.${puzzle.id}（${index + 1} / ${MINI4_PUZZLES.length}）`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === MINI4_PUZZLES.length - 1;
    if (solved) {
      if (status) {
        status.textContent = '正解です。4×4ナンプレをクリアしました。';
        status.className = 'mini4-status success';
      }
      if (!completed) {
        completed = true;
        track('mini4_complete', { level: puzzle.level, puzzle_id: puzzle.id });
      }
    }
  };

  const load = (nextIndex: number): void => {
    index = Math.max(0, Math.min(MINI4_PUZZLES.length - 1, nextIndex));
    started = false;
    const puzzle = MINI4_PUZZLES[index];
    values = persisted() ?? [...puzzle.puzzle].map((value) => (value === '.' ? 0 : Number(value)));
    completed = values.join('') === puzzle.solution;
    selected = values.findIndex((value, cellIndex) => value === 0 && puzzle.puzzle[cellIndex] === '.');
    if (status) {
      status.textContent = '空いているマスを選び、1〜4を入れてください。';
      status.className = 'mini4-status';
    }
    render();
  };

  const input = (digit: number): void => {
    const puzzle = MINI4_PUZZLES[index];
    if (selected < 0 || puzzle.puzzle[selected] !== '.') return;
    if (!started) {
      started = true;
      track('mini4_start', { puzzle_id: puzzle.id });
    }
    values[selected] = digit;
    save();
    if (status) {
      status.textContent = conflicts().size ? '同じ行・列・2×2ブロックに重複があります。' : '入力を保存しました。';
      status.className = conflicts().size ? 'mini4-status error' : 'mini4-status';
    }
    render();
  };

  cells.forEach((cell, cellIndex) => cell.addEventListener('click', () => {
    selected = cellIndex;
    render();
  }));
  keys.forEach((key) => key.addEventListener('click', () => input(Number(key.dataset.mini4Key ?? 0))));
  prev?.addEventListener('click', () => load(index - 1));
  next?.addEventListener('click', () => load(index + 1));

  root.querySelector('[data-mini4-reset]')?.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey()); } catch {}
    load(index);
  });
  root.querySelector('[data-mini4-check]')?.addEventListener('click', () => {
    const puzzle = MINI4_PUZZLES[index];
    const wrong = values.filter((value, cellIndex) => value !== 0 && value !== Number(puzzle.solution[cellIndex])).length;
    const empty = values.filter((value) => value === 0).length;
    if (!status) return;
    status.textContent = wrong ? `${wrong}マス違います。入力を見直してください。` : empty ? `ここまで正解です。残り${empty}マスです。` : '正解です。';
    status.className = wrong ? 'mini4-status error' : 'mini4-status success';
  });
  root.querySelector('[data-mini4-hint]')?.addEventListener('click', () => {
    const puzzle = MINI4_PUZZLES[index];
    const target = selected >= 0 && values[selected] === 0 ? selected : values.findIndex((value) => value === 0);
    if (target < 0 || puzzle.puzzle[target] !== '.') return;
    selected = target;
    values[target] = Number(puzzle.solution[target]);
    save();
    if (status) {
      status.textContent = `${Math.floor(target / 4) + 1}行${(target % 4) + 1}列に${values[target]}を入れました。`;
      status.className = 'mini4-status';
    }
    track('mini4_hint', { puzzle_id: puzzle.id });
    render();
  });
  root.querySelector('[data-mini4-print]')?.addEventListener('click', () => {
    track('mini4_print');
    window.print();
  });
  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
    if (event.key >= '1' && event.key <= '4') input(Number(event.key));
    if (['Backspace', 'Delete', '0'].includes(event.key)) input(0);
  });

  load(0);
}
