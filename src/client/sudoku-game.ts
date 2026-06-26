// 客户端可玩岛（和モダン）。普通模式：初始题预生成，「別の問題」引擎实时生成（无限）。
// daily 模式：按当天日期确定性选题（全员同日同題），显示日期 + 连续记录(streak)，无「別の問題」。
// 进度自动保存(localStorage，刷新不丢)、撤销、数字剩余计数、メモ自动清除、方向键、提示、胜利演出。
import {
  PEERS, UNITS, MASK_ALL, bit, popcount, digitsOf, colOf, rowOf,
  gridFromString, generateByLevel, solveOne, type DifficultyLevel, type Grid,
} from '../engine/index.ts';
import { track } from './track.ts';

interface PuzzlePair {
  puzzle: string;
  solution?: string; // daily は未配信（瘦身）→ クライアントで solveOne 現算。play は予生成解を同梱。
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
const gridToStr = (g: Grid): string => g.join('');

// —— daily は全て JST（日本標準時）基準：端末のタイムゾーンに依らず全員が同じ日に同じ問題。
// 日界・日付ラベル・ストリークを JST 0 時で揃える（daily.astro の「毎日0時更新」と一致）。
const JST = 9 * 3600 * 1000;
// JST の壁時計日付（dayShift 日ずらし可）を YYYY-MM-DD で返す。+9h した時刻を getUTC* で読む。
const jstDayStr = (dayShift = 0): string => {
  const d = new Date(Date.now() + JST + dayShift * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const jstParts = (): { m: number; d: number } => {
  const d = new Date(Date.now() + JST);
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const jstDayIndex = (): number => Math.floor((Date.now() + JST) / 86400000);

function el(tag: string, cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
// 控制按钮：アイコン + ラベル（モバイルでも1行に収まり、視認性が高い）。
// SVG は stroke=currentColor なので、ボタンの文字色（通常/アクティブ）に追従する。
const CTRL_ICONS: Record<string, string> = {
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.8c.5.5.8 1.1.8 2.2h6c0-1.1.3-1.7.8-2.2A6 6 0 0 0 12 3Z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  shuffle: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  eraser: '<path d="M20 20H8.5l-5.5-5.5a1.8 1.8 0 0 1 0-2.5l8-8a1.8 1.8 0 0 1 2.5 0l6 6a1.8 1.8 0 0 1 0 2.5L13.5 20"/><path d="M8.5 9.5 15 16"/>',
};
function cbtn(icon: string, label: string, on: () => void): HTMLButtonElement {
  const b = el('button', 'sk-cbtn') as HTMLButtonElement;
  b.type = 'button';
  b.innerHTML = `<svg class="sk-ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CTRL_ICONS[icon] ?? ''}</svg><span class="sk-cl">${label}</span>`;
  b.setAttribute('aria-label', label);
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
  let paused = false;
  let highlightDigit = 0; // 点数字键高亮全盘该数字（按数字扫描；0=无）
  let done = false;
  let isRecord = false;
  let finalTime = 0;
  let elapsedBase = 0; // 恢复进度时的已用时基准
  let dailyLevel = ''; // daily 当天题的难度档
  let start = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let checkErrors = localStorage.getItem('numpredo.pref.check') !== '0';

  const elapsed = (): number => (done ? finalTime : paused ? elapsedBase : elapsedBase + (Date.now() - start));

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
  const pauseBtn = el('button', 'sk-pause-btn') as HTMLButtonElement;
  pauseBtn.type = 'button';
  pauseBtn.setAttribute('aria-label', '一時停止');
  pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  pauseBtn.addEventListener('click', () => togglePause());
  const remEl = el('div', 'sk-rem');
  const timeRow = el('div', 'sk-timerow');
  timeRow.append(timerEl, pauseBtn, remEl);
  const badge = el('div', 'sk-badge');
  const pad = el('div', 'sk-pad');
  const hintMsg = el('div', 'sk-hint');
  const ctrl = el('div', 'sk-ctrl');
  const ctrl2 = el('div', 'sk-ctrl2');
  const checkRow = el('label', 'sk-check');
  const result = el('div', 'sk-result');
  // 暂停遮罩：覆盖盘面，停表时隐藏盘面内容（防"停表盯盘"作弊），中央继续按钮
  const pauseOverlay = el('div', 'sk-pause-overlay');
  pauseOverlay.innerHTML = '<button class="sk-resume" type="button" aria-label="再開"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>';
  board.append(pauseOverlay);
  (pauseOverlay.querySelector('.sk-resume') as HTMLElement).addEventListener('click', () => resume());
  if (daily) side.append(dailyEl);
  side.append(timeRow, badge, pad, hintMsg, ctrl, ctrl2, checkRow, result);

  // —— 棋盘格（role=grid + 各セル role=gridcell・動的 aria でスクリーンリーダー対応）——
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', '数独の盤面（9×9）');
  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < 81; i++) {
    const c = el('button', 'sk-cell') as HTMLButtonElement;
    c.type = 'button';
    c.setAttribute('role', 'gridcell');
    if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
    if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
    c.addEventListener('click', () => { if (paused) return; selected = i; highlightDigit = 0; clearHint(); render(); });
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
  // 「消す」已移到工具栏（橡皮擦），数字键盘只保留 1-9（移动端单行 9 键）

  // —— 控制按钮 ——（核心4：消す/メモ/元に戻す/ヒント 进工具栏；やり直す/別の問題 放次级行）
  const eraseBtn = cbtn('eraser', '消す', () => clearCell());
  const penBtn = cbtn('pencil', 'メモ', () => {
    pencil = !pencil;
    penBtn.classList.toggle('on', pencil);
    render();
  });
  const undoBtn = cbtn('undo', '元に戻す', () => undo());
  const hintBtn = cbtn('bulb', 'ヒント', () => hint());
  hintBtn.classList.add('sk-hintbtn');
  ctrl.append(eraseBtn, penBtn, undoBtn, hintBtn);
  ctrl2.append(cbtn('refresh', 'やり直す', () => restart()));
  if (!daily) ctrl2.append(cbtn('shuffle', '別の問題', () => newPuzzle()));

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
    if (paused) { if (e.key === 'Escape' || e.key === ' ') { resume(); e.preventDefault(); } return; }
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
    if (done || paused) return;
    // 無選択 or 固定マス（given）を選択中 → 数字キーは「全盤ハイライト（数字スキャン）」として働く
    if (selected < 0 || given[selected]) {
      highlightDigit = highlightDigit === d ? 0 : d;
      render();
      return;
    }
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
      highlightDigit = wasToggleOff ? 0 : d; // 填入后顺带高亮该数字全盘，帮你看分布
    }
    checkDone();
    if (!done) checkAreaComplete(selected); // 填满一行/列/宫 → 即时反馈
    save();
    render();
  }
  function clearCell(): void {
    if (done || paused || selected < 0 || given[selected]) return;
    if (cur[selected] === 0 && notes[selected] === 0) return;
    clearHint();
    pushHistory();
    cur[selected] = 0;
    notes[selected] = 0;
    save();
    render();
  }
  function undo(): void {
    if (done || paused || !history.length) return;
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

  // —— 暂停（停表 + 遮盖盘面，防"停表盯盘"作弊）——
  function pause(): void {
    if (done || paused) return;
    paused = true;
    elapsedBase += Date.now() - start; // 当前段时长累积进 base → elapsed 即冻结
    if (timer) { clearInterval(timer); timer = null; }
    left.classList.add('sk-paused');
    save();
    render();
  }
  function resume(): void {
    if (!paused) return;
    paused = false;
    start = Date.now();
    if (!done) timer = setInterval(tick, 1000);
    left.classList.remove('sk-paused');
    render();
  }
  function togglePause(): void { paused ? resume() : pause(); }

  // —— 区域完成即时反馈（填满一行/列/宫且全部正确 → 该 9 格脉冲一下）——
  function checkAreaComplete(cell: number): void {
    if (cell < 0) return;
    for (const u of UNITS) {
      if (!u.includes(cell)) continue;
      if (u.every((i) => cur[i] !== 0 && cur[i] === solution[i])) flashArea(u);
    }
  }
  function flashArea(idxs: number[]): void {
    for (const i of idxs) cells[i].classList.add('sk-area-done');
    setTimeout(() => { for (const i of idxs) cells[i].classList.remove('sk-area-done'); }, 720);
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
    paused = false;
    highlightDigit = 0;
    left.classList.remove('sk-paused');
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
    if (!done) timer = setInterval(tick, 1000);
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
    if (daily) data.day = jstDayStr();
    try { localStorage.setItem(progKey(), JSON.stringify(data)); } catch { /* 容量超限忽略 */ }
  }
  function load(): Saved | null {
    try {
      const raw = localStorage.getItem(progKey());
      if (!raw) return null;
      const o = JSON.parse(raw) as Saved;
      if (daily && o.day !== jstDayStr()) return null; // 跨日失效（JST 基準）
      if (!o.p || !o.s || !o.c || o.c.length !== 81) return null;
      return o;
    } catch { return null; }
  }

  // —— daily：日期 + 连续记录 ——
  function bumpStreak(): void {
    const today = jstDayStr();
    const last = localStorage.getItem('numpredo.daily.last');
    if (last === today) return;
    const streak = last === jstDayStr(-1) ? Number(localStorage.getItem('numpredo.daily.streak') || '0') + 1 : 1;
    localStorage.setItem('numpredo.daily.last', today);
    localStorage.setItem('numpredo.daily.streak', String(streak));
  }
  function fillDaily(): void {
    const { m, d } = jstParts();
    const streak = Number(localStorage.getItem('numpredo.daily.streak') || '0');
    const doneToday = localStorage.getItem('numpredo.daily.last') === jstDayStr();
    const lvJa = LV_JA[dailyLevel] ?? '';
    dailyEl.innerHTML =
      `<div class="sk-d-date">${m}月${d}日の問題</div>` +
      (lvJa ? `<div class="sk-d-level">本日の難易度: <b>${lvJa}</b></div>` : '') +
      `<div class="sk-d-streak">${streak > 0 ? streak + '日連続' : '記録に挑戦'}${doneToday ? ' ✓' : ''}</div>`;
  }

  // —— 胜利演出 ——
  function showResult(prevBest: number): void {
    track('game_complete', { level: levelJa, daily, record: isRecord });
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
    track('share_click', { from: daily ? 'daily' : 'game', level: levelJa });
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
  // 计时器每秒只更新时间文本（轻量），不触发整盘重渲染——render 仅在状态变化时调用。
  function tick(): void {
    timerEl.textContent = fmt(elapsed());
  }
  function render(): void {
    const selVal = selected >= 0 ? cur[selected] : 0;
    const hlVal = highlightDigit > 0 ? highlightDigit : selVal; // 高亮：数字键扫描优先，否则随选中格值
    const peerSet = selected >= 0 ? new Set(PEERS[selected]) : new Set<number>();
    board.classList.toggle('sk-pencil-on', pencil); // 笔记模式 → 盘面状态反馈
    let rem = 0;
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      const keep = c.className.match(/sk-(hint-cell|wrong-cell|area-done)/g) || [];
      c.className = ['sk-cell', ...keep].join(' ');
      if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
      if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
      if (given[i]) c.classList.add('sk-given');
      if (i === selected) c.classList.add('sk-sel');
      else if (peerSet.has(i)) c.classList.add('sk-peer');
      if (hlVal && cur[i] === hlVal) c.classList.add('sk-same');
      if (checkErrors && cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) c.classList.add('sk-err');
      // 规则冲突：与同行/列/宫的相同数字重复 → 即时粉红高亮（客观、不剧透答案，与 checkErrors 开关无关）
      if (cur[i] !== 0) {
        for (const p of PEERS[i]) if (cur[p] === cur[i]) { c.classList.add('sk-conflict'); break; }
      }

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
      // スクリーンリーダー向け：位置＋内容＋状態を aria に反映
      const pos = `${rowOf(i) + 1}行${colOf(i) + 1}列`;
      const bad = checkErrors && cur[i] !== 0 && !given[i] && cur[i] !== solution[i];
      c.setAttribute('aria-label',
        cur[i] !== 0 ? `${pos} ${cur[i]}${given[i] ? '（固定）' : ''}${bad ? '（誤り）' : ''}`
          : notes[i] ? `${pos} メモ ${digitsOf(notes[i]).join(' ')}`
            : `${pos} 空き`);
      c.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      if (bad) c.setAttribute('aria-invalid', 'true');
      else c.removeAttribute('aria-invalid');
    }
    // 数字键计数 + 填满置灰 + 选中数字高亮
    for (let d = 1; d <= 9; d++) {
      const k = keys[d - 1];
      const left = 9 - counts[d];
      (k.querySelector('.sk-kc') as HTMLElement).textContent = left > 0 ? String(left) : '';
      k.classList.toggle('sk-kdone', left <= 0);
      k.classList.toggle('sk-ksel', (selVal === d && selVal !== 0) || highlightDigit === d);
      k.setAttribute('aria-label', left > 0 ? `${d}（あと${left}）` : `${d}（完了）`);
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
  const dailyIdx = daily ? jstDayIndex() % set.length : 0;
  if (daily) dailyLevel = set[dailyIdx].level ?? '';
  const saved = load();
  if (saved && saved.d !== 1) {
    apply(gridFromString(saved.p), gridFromString(saved.s), saved);
  } else {
    const first = set[dailyIdx];
    const fpz = gridFromString(first.puzzle);
    // daily は solution 未配信 → solveOne で現算（play は予生成 solution をそのまま使う）
    const fsol = first.solution ? gridFromString(first.solution) : solveOne(fpz);
    if (fsol) apply(fpz, fsol);
  }
  if (daily) fillDaily();
}

document.querySelectorAll<HTMLElement>('[data-sudoku]').forEach(setup);
