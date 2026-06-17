// 客户端可玩岛（和モダン）。普通模式：初始题预生成，「別の問題」引擎实时生成（无限）。
// daily 模式：按当天日期确定性选题（全员同日同題），显示日期 + 连续记录(streak)，无「別の問題」。
// 进度自动保存(localStorage，刷新不丢)、撤销、数字剩余计数、メモ自动清除、方向键、提示、胜利演出。
import {
  PEERS, UNITS, MASK_ALL, bit, popcount, digitsOf, colOf, rowOf,
  gridFromString, generateByLevel, type DifficultyLevel, type Grid,
} from '../engine/index.ts';

interface PuzzlePair {
  puzzle: string;
  solution: string;
  level?: string;
}

// 难度等级 → 日语标签（daily 显示当天难度）
const LV_JA: Record<string, string> = {
  beginner: '初級', intermediate: '中級', advanced: '上級', hard: '難問', extreme: '超難問',
};
interface Saved {
  p: string; // 题面
  s: string; // 解
  c: string; // 当前盘(81字符)
  n: string; // 笔记(逗号分隔的 bitmask)
  e: number; // 已用毫秒
  d: number; // 是否完成
  day?: string; // daily 模式的日期校验
}

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;
const fmt = (ms: number): string => `${pad2((ms / 60000) | 0)}:${pad2(((ms / 1000) | 0) % 60)}`;
const dstr = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const gridToStr = (g: Grid): string => g.join('');

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

// 技巧名 → 日语 + 解法页链接（用于提示的教学引导）
const TECH_JA: Record<string, { ja: string; href: string }> = {
  nakedSingle: { ja: '裸の単数', href: '/guide/beginner/' },
  hiddenSingle: { ja: '隠れた単数', href: '/guide/beginner/' },
};

function setup(root: HTMLElement): void {
  const set: PuzzlePair[] = JSON.parse(root.dataset.set ?? '[]');
  const level = (root.dataset.level ?? 'advanced') as DifficultyLevel;
  const levelJa = root.dataset.levelja ?? '数独';
  const daily = root.dataset.daily === '1';
  const shareUrl = root.dataset.url ?? 'https://numpredo.com/';
  if (!set.length) return;

  let puzzleGrid: Grid = [];
  let solution: Grid = [];
  let given: boolean[] = [];
  let cur: number[] = [];
  let notes: number[] = [];
  let history: Array<{ c: number[]; n: number[] }> = [];
  let selected = -1;
  let pencil = false;
  let done = false;
  let isRecord = false;
  let finalTime = 0;
  let elapsedBase = 0; // 恢复进度时的已用时基准
  let dailyLevel = ''; // daily 当天题的难度档
  let start = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let checkErrors = localStorage.getItem('numpredo.pref.check') !== '0';

  const elapsed = (): number => (done ? finalTime : elapsedBase + (Date.now() - start));

  root.innerHTML = '';
  const layout = el('div', 'sk-layout');
  const left = el('div', 'sk-left');
  const side = el('div', 'sk-side');
  layout.append(left, side);
  root.append(layout);

  const board = el('div', 'sk-board');
  const confetti = el('div', 'sk-confetti');
  left.append(board, confetti);

  const dailyEl = el('div', 'sk-daily');
  const timerEl = el('div', 'sk-timer');
  const remEl = el('div', 'sk-rem');
  const badge = el('div', 'sk-badge');
  const pad = el('div', 'sk-pad');
  const hintMsg = el('div', 'sk-hint');
  const ctrl = el('div', 'sk-ctrl');
  const checkRow = el('label', 'sk-check');
  const result = el('div', 'sk-result');
  if (daily) side.append(dailyEl);
  side.append(timerEl, remEl, badge, pad, hintMsg, ctrl, checkRow, result);

  // —— 棋盘格 ——
  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < 81; i++) {
    const c = el('button', 'sk-cell') as HTMLButtonElement;
    c.type = 'button';
    if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
    if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
    c.addEventListener('click', () => { selected = i; clearHint(); render(); });
    cells.push(c);
    board.append(c);
  }

  // —— 数字键盘（带剩余计数）——
  const keys: HTMLButtonElement[] = [];
  for (let d = 1; d <= 9; d++) {
    const b = el('button', 'sk-key') as HTMLButtonElement;
    b.type = 'button';
    b.innerHTML = `<span class="sk-kd">${d}</span><i class="sk-kc"></i>`;
    b.addEventListener('click', () => input(d));
    keys.push(b);
    pad.append(b);
  }
  const del = el('button', 'sk-key sk-del') as HTMLButtonElement;
  del.type = 'button';
  del.textContent = '消す';
  del.addEventListener('click', () => clearCell());
  pad.append(del);

  // —— 控制按钮 ——
  const penBtn = btn('メモ', () => {
    pencil = !pencil;
    penBtn.classList.toggle('on', pencil);
  });
  const undoBtn = btn('元に戻す', () => undo());
  const hintBtn = btn('ヒント', () => hint());
  hintBtn.classList.add('sk-hintbtn');
  ctrl.append(penBtn, undoBtn, hintBtn, btn('やり直す', () => restart()));
  if (!daily) ctrl.append(btn('別の問題', () => newPuzzle()));

  // —— 间違いチェック开关 ——
  const checkBox = el('input') as HTMLInputElement;
  checkBox.type = 'checkbox';
  checkBox.checked = checkErrors;
  checkBox.addEventListener('change', () => {
    checkErrors = checkBox.checked;
    localStorage.setItem('numpredo.pref.check', checkErrors ? '1' : '0');
    render();
  });
  checkRow.append(checkBox, document.createTextNode(' 間違いを赤く表示'));

  // —— 键盘操作 ——
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if (e.key.startsWith('Arrow')) {
      let r = selected < 0 ? 0 : rowOf(selected);
      let c = selected < 0 ? 0 : colOf(selected);
      if (selected >= 0) {
        if (e.key === 'ArrowUp') r = (r + 8) % 9;
        else if (e.key === 'ArrowDown') r = (r + 1) % 9;
        else if (e.key === 'ArrowLeft') c = (c + 8) % 9;
        else if (e.key === 'ArrowRight') c = (c + 1) % 9;
      }
      selected = r * 9 + c;
      e.preventDefault();
      clearHint();
      render();
      return;
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
      return;
    }
    if (selected < 0) return;
    if (e.key >= '1' && e.key <= '9') input(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') clearCell();
  });

  // —— 输入 ——
  function pushHistory(): void {
    history.push({ c: cur.slice(), n: notes.slice() });
    if (history.length > 200) history.shift();
  }
  function input(d: number): void {
    if (done || selected < 0 || given[selected]) return;
    clearHint();
    pushHistory();
    if (pencil) {
      if (cur[selected] === 0) notes[selected] ^= bit(d);
    } else {
      const wasToggleOff = cur[selected] === d;
      cur[selected] = wasToggleOff ? 0 : d;
      notes[selected] = 0;
      // メモ自动清除：填入数字时，从同行・列・宫的候选笔记里移除该数字
      if (!wasToggleOff) {
        for (const p of PEERS[selected]) notes[p] &= ~bit(d);
      }
    }
    checkDone();
    save();
    render();
  }
  function clearCell(): void {
    if (done || selected < 0 || given[selected]) return;
    if (cur[selected] === 0 && notes[selected] === 0) return;
    clearHint();
    pushHistory();
    cur[selected] = 0;
    notes[selected] = 0;
    save();
    render();
  }
  function undo(): void {
    if (done || !history.length) return;
    const prev = history.pop()!;
    cur = prev.c;
    notes = prev.n;
    clearHint();
    save();
    render();
  }
  function checkDone(): void {
    if (!cur.every((v, i) => v === solution[i])) return;
    done = true;
    finalTime = elapsedBase + (Date.now() - start);
    if (timer) clearInterval(timer);
    const key = `numpredo.best.${daily ? 'daily' : level}`;
    const prev = Number(localStorage.getItem(key) || '0');
    isRecord = prev === 0 || finalTime < prev;
    if (isRecord) localStorage.setItem(key, String(finalTime));
    if (daily) { bumpStreak(); fillDaily(); }
    showResult(prev);
    burst();
  }

  // —— 提示（先查错误 → 逻辑找单数指路 → 高级技巧回退揭示）——
  function clearHint(): void {
    hintMsg.textContent = '';
    hintMsg.classList.remove('on');
    for (const c of cells) c.classList.remove('sk-hint-cell', 'sk-wrong-cell');
  }
  function hint(): void {
    if (done) return;
    clearHint();
    // ① 有填错的格 → 先提示纠错（不揭示答案）
    const wrong: number[] = [];
    for (let i = 0; i < 81; i++) if (cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) wrong.push(i);
    if (wrong.length) {
      for (const i of wrong) cells[i].classList.add('sk-wrong-cell');
      hintMsg.innerHTML = `<b>${wrong.length}マス</b>が間違っています。まず直してみましょう。`;
      hintMsg.classList.add('on');
      return;
    }
    // ② 逻辑找一个可确定的单数（基于已正确填入的盘面）
    const found = findSingle();
    if (found) {
      selected = found.cell;
      cells[found.cell].classList.add('sk-hint-cell');
      const t = TECH_JA[found.tech];
      hintMsg.innerHTML = `このマスは<b>${t.ja}</b>で <b>${found.digit}</b> に決まります（<a href="${t.href}">解き方</a>）。`;
      hintMsg.classList.add('on');
      render();
      return;
    }
    // ③ 单数推不动 → 需要更高级技巧，揭示一个空格并引导
    let empty = -1;
    for (let i = 0; i < 81; i++) if (cur[i] === 0) { empty = i; break; }
    if (empty < 0) return;
    selected = empty;
    cells[empty].classList.add('sk-hint-cell');
    hintMsg.innerHTML = `ここから先は<a href="/guide/how-to-solve/">ペアやX-Wing</a>が必要です。このマスは <b>${solution[empty]}</b> です。`;
    hintMsg.classList.add('on');
    render();
  }
  function findSingle(): { cell: number; digit: number; tech: string } | null {
    // 用 given + 正确填入构造盘面（忽略错误填入与笔记）
    const g = cur.map((v, i) => (given[i] || v === solution[i] ? v : 0));
    const cand = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      let m = MASK_ALL;
      for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
      cand[i] = m;
    }
    // 裸单数：候选只剩一个
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0 && popcount(cand[i]) === 1) {
        return { cell: i, digit: digitsOf(cand[i])[0], tech: 'nakedSingle' };
      }
    }
    // 隐单数：某数字在单元内只剩一处
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let spot = -1, n = 0;
        for (const c of u) if (g[c] === 0 && cand[c] & bit(d)) { n++; spot = c; }
        if (n === 1) return { cell: spot, digit: d, tech: 'hiddenSingle' };
      }
    }
    return null;
  }

  // —— 题面切换 ——
  function apply(pz: Grid, sol: Grid, restore?: Saved): void {
    puzzleGrid = pz;
    solution = sol;
    given = pz.map((v) => v !== 0);
    history = [];
    selected = -1;
    isRecord = false;
    clearHint();
    if (restore) {
      cur = restore.c.split('').map(Number);
      notes = restore.n ? restore.n.split(',').map(Number) : new Array(81).fill(0);
      elapsedBase = restore.e || 0;
      done = restore.d === 1;
      finalTime = done ? elapsedBase : 0;
    } else {
      cur = pz.slice();
      notes = new Array(81).fill(0);
      elapsedBase = 0;
      done = false;
      finalTime = 0;
    }
    start = Date.now();
    if (timer) clearInterval(timer);
    if (!done) timer = setInterval(render, 1000);
    result.classList.remove('on');
    render();
  }
  function restart(): void {
    localStorage.removeItem(progKey());
    apply(puzzleGrid.slice(), solution.slice());
  }
  function newPuzzle(): void {
    if (timer) clearInterval(timer);
    localStorage.removeItem(progKey());
    remEl.textContent = '新しい問題を生成中…';
    setTimeout(() => {
      const attempts = level === 'hard' || level === 'extreme' ? 25 : 40;
      const p = generateByLevel(level, attempts).puzzle;
      apply(p.puzzle, p.solution);
    }, 20);
  }

  // —— 进度持久化 ——
  function progKey(): string {
    return `numpredo.prog.${daily ? 'daily' : level}`;
  }
  function save(): void {
    const data: Saved = {
      p: gridToStr(puzzleGrid),
      s: gridToStr(solution),
      c: cur.join(''),
      n: notes.join(','),
      e: elapsed(),
      d: done ? 1 : 0,
    };
    if (daily) data.day = dstr(new Date());
    try { localStorage.setItem(progKey(), JSON.stringify(data)); } catch { /* 容量超限忽略 */ }
  }
  function load(): Saved | null {
    try {
      const raw = localStorage.getItem(progKey());
      if (!raw) return null;
      const o = JSON.parse(raw) as Saved;
      if (daily && o.day !== dstr(new Date())) return null; // 跨日失效
      if (!o.p || !o.s || !o.c || o.c.length !== 81) return null;
      return o;
    } catch { return null; }
  }

  // —— daily：日期 + 连续记录 ——
  function bumpStreak(): void {
    const today = dstr(new Date());
    const last = localStorage.getItem('numpredo.daily.last');
    if (last === today) return;
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
    const lvJa = LV_JA[dailyLevel] ?? '';
    dailyEl.innerHTML =
      `<div class="sk-d-date">${dt.getMonth() + 1}月${dt.getDate()}日の問題</div>` +
      (lvJa ? `<div class="sk-d-level">本日の難易度: <b>${lvJa}</b></div>` : '') +
      `<div class="sk-d-streak">${streak > 0 ? streak + '日連続' : '記録に挑戦'}${doneToday ? ' ✓' : ''}</div>`;
  }

  // —— 胜利演出 ——
  function showResult(prevBest: number): void {
    const lines = [`<div class="sk-r-title">クリア！</div>`];
    lines.push(`<div class="sk-r-time">${fmt(finalTime)}</div>`);
    if (isRecord) lines.push(`<div class="sk-r-rec">✦ 自己ベスト更新！</div>`);
    else if (prevBest) lines.push(`<div class="sk-r-best">自己ベスト ${fmt(prevBest)}</div>`);
    result.innerHTML = lines.join('');
    const sb = el('button', 'sk-share') as HTMLButtonElement;
    sb.type = 'button';
    sb.textContent = '結果をシェア';
    sb.addEventListener('click', share);
    result.append(sb);
    result.classList.add('on');
  }
  function share(): void {
    const text = `numpredoで【${levelJa}】を ${fmt(finalTime)} でクリア！`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      nav.share({ text, url: shareUrl }).catch(() => {});
    } else {
      const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' #数独 #ナンプレ')}&url=${encodeURIComponent(shareUrl)}`;
      window.open(x, '_blank', 'noopener,width=600,height=480');
    }
  }
  function burst(): void {
    const colors = ['#c8463c', '#2b5b7a', '#e0a44c', '#5a8a5a', '#b5302a'];
    for (let i = 0; i < 36; i++) {
      const p = el('i', 'sk-confetti-bit');
      p.style.left = Math.round((i / 36) * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (i % 9) * 0.06 + 's';
      confetti.append(p);
    }
    setTimeout(() => { confetti.innerHTML = ''; }, 2600);
  }

  // —— 渲染 ——
  function render(): void {
    const selVal = selected >= 0 ? cur[selected] : 0;
    const peerSet = selected >= 0 ? new Set(PEERS[selected]) : new Set<number>();
    let rem = 0;
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      const keep = c.className.match(/sk-(hint-cell|wrong-cell)/g) || [];
      c.className = ['sk-cell', ...keep].join(' ');
      if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
      if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
      if (given[i]) c.classList.add('sk-given');
      if (i === selected) c.classList.add('sk-sel');
      else if (peerSet.has(i)) c.classList.add('sk-peer');
      if (selVal && cur[i] === selVal) c.classList.add('sk-same');
      if (checkErrors && cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) c.classList.add('sk-err');

      if (cur[i] !== 0) {
        c.textContent = String(cur[i]);
        counts[cur[i]]++;
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
    // 数字键计数 + 填满置灰 + 选中数字高亮
    for (let d = 1; d <= 9; d++) {
      const k = keys[d - 1];
      const left = 9 - counts[d];
      (k.querySelector('.sk-kc') as HTMLElement).textContent = left > 0 ? String(left) : '';
      k.classList.toggle('sk-kdone', left <= 0);
      k.classList.toggle('sk-ksel', selVal === d && selVal !== 0);
    }
    timerEl.textContent = fmt(elapsed());
    if (done) {
      remEl.textContent = 'クリア！';
      remEl.classList.add('sk-clear');
      badge.style.display = 'none';
    } else {
      remEl.textContent = `残り ${rem} マス`;
      remEl.classList.remove('sk-clear');
      badge.style.display = 'none';
    }
  }

  // —— 初始化：优先恢复未完成的存档 ——
  const dailyIdx = daily ? Math.floor(Date.now() / 86400000) % set.length : 0;
  if (daily) dailyLevel = set[dailyIdx].level ?? '';
  const saved = load();
  if (saved && saved.d !== 1) {
    apply(gridFromString(saved.p), gridFromString(saved.s), saved);
  } else {
    const first = set[dailyIdx];
    apply(gridFromString(first.puzzle), gridFromString(first.solution));
  }
  if (daily) fillDaily();
}

document.querySelectorAll<HTMLElement>('[data-sudoku]').forEach(setup);
