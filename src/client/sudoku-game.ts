// 客户端可玩岛（和モダン）。普通模式：初始题预生成，「別の問題」引擎实时生成（无限）。
// daily 模式：按当天日期确定性选题（全员同日同題），显示日期 + 连续记录(streak)，无「別の問題」。
// 最佳成绩 / streak 用 localStorage（无登录）。
import { PEERS, bit, colOf, rowOf, gridFromString, generateByLevel, type DifficultyLevel, type Grid } from '../engine/index.ts';

interface PuzzlePair {
  puzzle: string;
  solution: string;
}

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;
const fmt = (ms: number): string => `${pad2((ms / 60000) | 0)}:${pad2(((ms / 1000) | 0) % 60)}`;
const dstr = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function el(tag: string, cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function btn(label: string, on: () => void): HTMLButtonElement {
  const b = el('button', 'sk-cbtn') as HTMLButtonElement;
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', on);
  return b;
}

function setup(root: HTMLElement): void {
  const set: PuzzlePair[] = JSON.parse(root.dataset.set ?? '[]');
  const level = (root.dataset.level ?? 'advanced') as DifficultyLevel;
  const daily = root.dataset.daily === '1';
  if (!set.length) return;

  let puzzleGrid: Grid = [];
  let solution: Grid = [];
  let given: boolean[] = [];
  let cur: number[] = [];
  let notes: number[] = [];
  let selected = -1;
  let pencil = false;
  let start = Date.now();
  let done = false;
  let isRecord = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  root.innerHTML = '';
  const layout = el('div', 'sk-layout');
  const left = el('div', 'sk-left');
  const side = el('div', 'sk-side');
  layout.append(left, side);
  root.append(layout);

  const board = el('div', 'sk-board');
  left.append(board);
  const dailyEl = el('div', 'sk-daily');
  const timerEl = el('div', 'sk-timer');
  const remEl = el('div', 'sk-rem');
  const badge = el('div', 'sk-badge');
  const pad = el('div', 'sk-pad');
  const ctrl = el('div', 'sk-ctrl');
  if (daily) side.append(dailyEl);
  side.append(timerEl, remEl, badge, pad, ctrl);

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < 81; i++) {
    const c = el('button', 'sk-cell') as HTMLButtonElement;
    c.type = 'button';
    if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
    if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
    c.addEventListener('click', () => {
      selected = i;
      render();
    });
    cells.push(c);
    board.append(c);
  }

  for (let d = 1; d <= 9; d++) {
    const b = el('button', 'sk-key') as HTMLButtonElement;
    b.type = 'button';
    b.textContent = String(d);
    b.addEventListener('click', () => input(d));
    pad.append(b);
  }
  const del = el('button', 'sk-key sk-del') as HTMLButtonElement;
  del.type = 'button';
  del.textContent = '消す';
  del.addEventListener('click', () => clearCell());
  pad.append(del);

  const penBtn = btn('メモ', () => {
    pencil = !pencil;
    penBtn.classList.toggle('on', pencil);
  });
  ctrl.append(penBtn, btn('やり直す', () => restart()));
  if (!daily) ctrl.append(btn('別の問題', () => newPuzzle()));

  document.addEventListener('keydown', (e) => {
    if (selected < 0) return;
    if (e.key >= '1' && e.key <= '9') input(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') clearCell();
  });

  function input(d: number): void {
    if (done || selected < 0 || given[selected]) return;
    if (pencil) {
      if (cur[selected] === 0) notes[selected] ^= bit(d);
    } else {
      cur[selected] = cur[selected] === d ? 0 : d;
      notes[selected] = 0;
    }
    checkDone();
    render();
  }
  function clearCell(): void {
    if (done || selected < 0 || given[selected]) return;
    cur[selected] = 0;
    notes[selected] = 0;
    render();
  }
  function checkDone(): void {
    if (!cur.every((v, i) => v === solution[i])) return;
    done = true;
    if (timer) clearInterval(timer);
    const t = Date.now() - start;
    const key = `numpredo.best.${daily ? 'daily' : level}`;
    const prev = Number(localStorage.getItem(key) || '0');
    isRecord = prev === 0 || t < prev;
    if (isRecord) localStorage.setItem(key, String(t));
    if (daily) {
      bumpStreak();
      fillDaily();
    }
  }

  function apply(pz: Grid, sol: Grid): void {
    puzzleGrid = pz;
    solution = sol;
    given = pz.map((v) => v !== 0);
    cur = pz.slice();
    notes = new Array(81).fill(0);
    selected = -1;
    done = false;
    isRecord = false;
    start = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(render, 1000);
    render();
  }
  function restart(): void {
    apply(puzzleGrid.slice(), solution.slice());
  }
  function newPuzzle(): void {
    if (timer) clearInterval(timer);
    remEl.textContent = '新しい問題を生成中…';
    setTimeout(() => {
      const attempts = level === 'hard' || level === 'extreme' ? 25 : 40;
      const p = generateByLevel(level, attempts).puzzle;
      apply(p.puzzle, p.solution);
    }, 20);
  }

  // —— daily：日期 + 连续记录 ——
  function bumpStreak(): void {
    const today = dstr(new Date());
    const last = localStorage.getItem('numpredo.daily.last');
    if (last === today) return; // 当日已记录
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const streak = last === dstr(y) ? Number(localStorage.getItem('numpredo.daily.streak') || '0') + 1 : 1;
    localStorage.setItem('numpredo.daily.last', today);
    localStorage.setItem('numpredo.daily.streak', String(streak));
  }
  function fillDaily(): void {
    const dt = new Date();
    const streak = Number(localStorage.getItem('numpredo.daily.streak') || '0');
    const doneToday = localStorage.getItem('numpredo.daily.last') === dstr(dt);
    dailyEl.innerHTML =
      `<div class="sk-d-date">${dt.getMonth() + 1}月${dt.getDate()}日の問題</div>` +
      `<div class="sk-d-streak">${streak > 0 ? streak + '日連続' : '記録に挑戦'}${doneToday ? ' ✓' : ''}</div>`;
  }

  function render(): void {
    const selVal = selected >= 0 ? cur[selected] : 0;
    const peerSet = selected >= 0 ? new Set(PEERS[selected]) : new Set<number>();
    let rem = 0;
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      c.className = 'sk-cell';
      if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
      if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
      if (given[i]) c.classList.add('sk-given');
      if (i === selected) c.classList.add('sk-sel');
      else if (peerSet.has(i)) c.classList.add('sk-peer');
      if (selVal && cur[i] === selVal) c.classList.add('sk-same');
      if (cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) c.classList.add('sk-err');

      if (cur[i] !== 0) {
        c.textContent = String(cur[i]);
      } else if (notes[i]) {
        c.textContent = '';
        const n = el('span', 'sk-notes');
        for (let d = 1; d <= 9; d++) {
          const s = el('i');
          s.textContent = notes[i] & bit(d) ? String(d) : '';
          n.append(s);
        }
        c.append(n);
        rem++;
      } else {
        c.textContent = '';
        rem++;
      }
    }
    timerEl.textContent = fmt(Date.now() - start);
    if (done) {
      remEl.textContent = 'クリア！';
      remEl.classList.add('sk-clear');
      badge.textContent = isRecord ? '✦ 自己ベスト更新' : '✦ クリア';
      badge.style.display = 'inline-block';
    } else {
      remEl.textContent = `残り ${rem} マス`;
      remEl.classList.remove('sk-clear');
      badge.style.display = 'none';
    }
  }

  // 初始题：daily=当天日期选题；普通=预生成第一题
  const initIdx = daily ? Math.floor(Date.now() / 86400000) % set.length : 0;
  const first = set[initIdx];
  apply(gridFromString(first.puzzle), gridFromString(first.solution));
  if (daily) fillDaily();
}

document.querySelectorAll<HTMLElement>('[data-sudoku]').forEach(setup);
