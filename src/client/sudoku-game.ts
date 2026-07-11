// 客户端可玩岛（和モダン）。普通模式：题目全部来自预生成题库（页面嵌入 set；「別の問題」
// 池内循环消费，?n= 直达指定题号）——不做客户端实时生成：难度命中率低（hard 实测 0/5 且可能
// 掉到初级）、还会冻结主线程数百 ms，与「检验后入库」的品质承诺相悖。
// daily 模式：按 JST 日序号顺序选题（data-daystart 窗口偏移，全员同日同題），显示日期 + 连续记录(streak)。
// 进度自动保存(localStorage，刷新不丢)、撤销、数字剩余计数、メモ自动清除、方向键、提示、胜利演出。
import {
  DIAGONAL_UNITS, STANDARD_CONTEXT, buildContext, MASK_ALL, bit, popcount, digitsOf, colOf, rowOf, boxOf,
  gridFromString, solveOne, traceFirstElimination, logicalSolve, computeCandidates, type Grid,
} from '../engine/index.ts';
import { track } from './track.ts';
import { ACHIEVEMENTS, computeUnlocked, readStats, readDailyLog, readDailyLog5, readStreak } from './achievements.ts';

interface PuzzlePair {
  puzzle: string;
  solution?: string; // daily は未配信（瘦身）→ クライアントで solveOne 現算。play は予生成解を同梱。
  level?: string;
}

// 难度等级 → 日语标签（daily 显示当天难度）
const LV_JA: Record<string, string> = {
  beginner: '初級', intermediate: '中級', advanced: '上級', hard: '難問', extreme: '超難問',
};
// 毎日5問モードの難易度順（set の 1 日ぶん 5 エントリはこの順で並ぶ——daily.astro/archive.astro と同期）
const LV_ORDER5 = ['beginner', 'intermediate', 'advanced', 'hard', 'extreme'];
interface Saved {
  p: string; // 题面
  s: string; // 解
  c: string; // 当前盘(81字符)
  n: string; // 笔记(逗号分隔的 bitmask)
  e: number; // 已用毫秒
  d: number; // 是否完成
  day?: string; // daily 模式的日期校验
  h?: number; // 本局是否用过提示（1=用过。刷新恢复后ノーヒント実績判定が失真しないように保存）
}

// localStorage 在部分环境（Safari「すべてのCookieをブロック」/ 一部 WebView）下**访问即抛异常**——
// 统一走 safe 包装：存取失败静默降级（游戏照玩，只是不保存/不恢复），避免 setup 同步流程整体崩溃。
const store = {
  get: (k: string): string | null => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k: string, v: string): void => {
    try { localStorage.setItem(k, v); } catch { /* 降级：不保存 */ }
  },
  remove: (k: string): void => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  },
};

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
  redo: '<path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>',
  wand: '<path d="m21.6 3.6-1.2-1.2a1.2 1.2 0 0 0-1.7 0L2.4 18.6a1.2 1.2 0 0 0 0 1.7l1.2 1.2a1.2 1.2 0 0 0 1.7 0L21.6 5.4a1.2 1.2 0 0 0 0-1.7Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
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

// 技巧名 → 日语 + 解法页链接（用于提示的教学引导）。键与引擎技巧链一致，止于 xWing（对齐五档）。
const TECH_JA: Record<string, { ja: string; href: string }> = {
  nakedSingle: { ja: '裸の単数', href: '/guide/beginner/' },
  hiddenSingle: { ja: '隠れた単数', href: '/guide/beginner/' },
  lockedCandidates: { ja: '区画の絞り込み（ポインティング）', href: '/guide/techniques/pointing/' },
  nakedPair: { ja: 'ネイキッドペア（二国同盟）', href: '/guide/techniques/naked-pair/' },
  hiddenPair: { ja: '隠れたペア（ヒドゥンペア）', href: '/guide/techniques/hidden-pair/' },
  nakedTriple: { ja: '三国同盟（ネイキッドトリプル）', href: '/guide/techniques/naked-triple/' },
  xWing: { ja: 'X-Wing（エックスウイング）', href: '/guide/techniques/x-wing/' },
  swordfish: { ja: 'スワードフィッシュ', href: '/guide/techniques/swordfish/' },
  skyscraper: { ja: 'スカイスクレイパー', href: '/guide/techniques/skyscraper/' },
};
// ブロックの日本語ラベル（ナッジ段階の位置指示）
const BOX_JA = ['左上', '中央上', '右上', '左中', '中央', '右中', '左下', '中央下', '右下'];
// 认知难度递增序（成绩卡「使ったテクニック」按此排序展示）
const TECH_ORDER = ['nakedSingle', 'hiddenSingle', 'lockedCandidates', 'nakedPair', 'hiddenPair', 'nakedTriple', 'xWing'];

function setup(root: HTMLElement): void {
  const set: PuzzlePair[] = JSON.parse(root.dataset.set ?? '[]');
  // level は保存キーの名前空間（numpredo.prog.* / numpredo.best.*）：五档 slug のほか
  // 変体キー（'diagonal' 等）も来る——DifficultyLevel ではなく素の string が正しい型
  const level = root.dataset.level ?? 'advanced';
  const levelJa = root.dataset.levelja ?? '数独';
  const daily = root.dataset.daily === '1';
  // archive：過去のデイリーを解くモード（/daily/archive/）。daily の派生だが
  // ①ストリークは伸びない ②進捗は専用スロット ③月历(daily.log)はその日付に遡及記入
  const archive = root.dataset.archive === '1';
  // multi：毎日5問モード（daily/archive 共通）。set は「1日 = LV_ORDER5 順の5エントリ」の平坦配列
  const multi = root.dataset.multi === '1';
  const shareUrl = root.dataset.url ?? 'https://numpredo.com/';
  // 変体上下文：data-variant="diagonal" で units/peers を対角線入りに差し替え——
  // 衝突チェック・メモ自動消去・ヒント・エリア完成が全部対角線制約込みで動く
  const variant = root.dataset.variant ?? '';
  const ctx = variant === 'diagonal' ? buildContext(DIAGONAL_UNITS) : STANDARD_CONTEXT;
  const diagCells = variant === 'diagonal' ? new Set(DIAGONAL_UNITS.flat()) : new Set<number>();
  if (!set.length) return;

  let puzzleGrid: Grid = [];
  let solution: Grid = [];
  let given: boolean[] = [];
  let cur: number[] = [];
  let notes: number[] = [];
  let history: Array<{ c: number[]; n: number[] }> = [];
  let redoStack: Array<{ c: number[]; n: number[] }> = []; // undo で積み、通常の新規操作で空になる
  let selected = -1;
  let pencil = false;
  let paused = false;
  let highlightDigit = 0; // 点数字键高亮全盘该数字（按数字扫描；0=无）
  let done = false;
  let isRecord = false;
  let finalTime = 0;
  let elapsedBase = 0; // 恢复进度时的已用时基准
  let dailyLevel = ''; // daily 当天题的难度档
  let archiveDay = ''; // archive モードの対象日（YYYY-MM-DD）
  let dayBase = 0; // multi：対象日の先頭エントリ index（+tabIdx が実 index）
  let tabIdx = 1; // multi：難易度タブ（既定は中級。pref で復元）
  let hintUsed = false; // 本局是否用过提示（ノーヒント実績の判定素材）
  let poolIdx = 0; // 当前题在嵌入题库 set 中的下标（「別の問題」循环消费用）
  // —— 提示（三级递进）状态：hintSig 记录上次提示时的盘面签名，变了就重置到第1级，连点同盘则升级 ——
  let hintLevel = 0;
  let hintSig = '';
  const hintRegion = new Set<number>(); // ナッジ：高亮区域（宫）
  const hintFocus = new Set<number>(); // 目标格 / 消除目标格
  const hintWrong = new Set<number>(); // 错填格（纠错提示）
  const hintCand = new Map<number, number>(); // 格 → 临时候选浮层 bitmask（引擎现算，不入 notes）
  const hintX = new Map<number, number>(); // 格 → 该步要消除的候选 bitmask（浮层里标红）
  let start = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let checkErrors = store.get('numpredo.pref.check') !== '0';

  const elapsed = (): number => (done ? finalTime : paused ? elapsedBase : elapsedBase + (Date.now() - start));
  // 题面串统一成 0 表空再比较：存档 p 是 gridToStr（0 表空），题库 JSON 用 . 表空
  const normP = (s: string): string => s.replace(/[^1-9]/g, '0');

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
  const ctrl3 = el('div', 'sk-ctrl2');
  const checkRow = el('label', 'sk-check');
  // 信任标语（②「無需猜測保証」卖点化）：常驻侧栏，声明本站题「論理だけで必ず解ける・唯一解」——
  // 这是 sudoku.com 上级题(含推测局面)结构上给不了的品质承诺，兼一条到解き方ガイドの内链。
  const guarantee = el('div', 'sk-guarantee');
  guarantee.innerHTML = '<b>◆ 当てずっぽう不要</b><span>論理だけで必ず解ける唯一解の問題です。<a href="/guide/how-to-solve/">解き方ガイド</a></span>';
  const result = el('div', 'sk-result');
  // 暂停遮罩：覆盖盘面，停表时隐藏盘面内容（防"停表盯盘"作弊），中央继续按钮。
  // aria-hidden + tabindex=-1：读屏/键盘走 sk-pause-btn（label 随状态切）或 Space/Escape，避免 grid 内非法子节点。
  const pauseOverlay = el('div', 'sk-pause-overlay');
  pauseOverlay.setAttribute('aria-hidden', 'true');
  pauseOverlay.innerHTML = '<button class="sk-resume" type="button" tabindex="-1"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>';
  board.append(pauseOverlay);
  pauseOverlay.addEventListener('click', () => resume()); // 整层可点，触达更大
  if (daily) side.append(dailyEl);
  side.append(timeRow, badge, pad, hintMsg, ctrl, ctrl2, ctrl3, checkRow, guarantee, result);

  // —— 棋盘格（role=grid > role=row > role=gridcell 合规层级；行容器 display:contents 不影响 CSS grid 布局）——
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', variant === 'diagonal' ? '数独の盤面（9×9・対角線ルール）' : '数独の盤面（9×9）');
  const cells: HTMLButtonElement[] = [];
  for (let r = 0; r < 9; r++) {
    const rowEl = el('div', 'sk-rowg');
    rowEl.setAttribute('role', 'row');
    for (let cc = 0; cc < 9; cc++) {
      const i = r * 9 + cc;
      const c = el('button', 'sk-cell') as HTMLButtonElement;
      c.type = 'button';
      c.setAttribute('role', 'gridcell');
      if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
      if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
      c.addEventListener('click', () => { if (paused) return; selected = i; highlightDigit = 0; clearHint(); render(); });
      cells.push(c);
      rowEl.append(c);
    }
    board.append(rowEl);
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

  // —— 控制按钮 ——（核心5：消す/メモ/元に戻す/やり直し/ヒント；次级行：最初から/別の問題；三级行：自動メモ/ソルバー）
  const eraseBtn = cbtn('eraser', '消す', () => clearCell());
  const penBtn = cbtn('pencil', 'メモ', () => {
    pencil = !pencil;
    penBtn.classList.toggle('on', pencil);
    render();
  });
  const undoBtn = cbtn('undo', '元に戻す', () => undo());
  const redoBtn = cbtn('redo', 'やり直し', () => redo()); // redo（Windows 標準の対語）。リスタートは「最初から」に改名し衝突回避
  const hintBtn = cbtn('bulb', 'ヒント', () => hint());
  hintBtn.classList.add('sk-hintbtn');
  ctrl.append(eraseBtn, penBtn, undoBtn, redoBtn, hintBtn);
  ctrl2.append(cbtn('refresh', '最初から', () => restart()));
  if (!daily) ctrl2.append(cbtn('shuffle', '別の問題', () => newPuzzle()));
  // 三级行：自動メモ（全空きマスに候補を一括メモ）+ ソルバー動線（この盤面の解き方手順へ）。
  // ソルバーは標準ルール専用——変体（対角線等）の盤面を持ち込むと「解が複数」と誤報して
  // 「唯一解」の信頼標語を裏切るため、変体ページではボタン自体を出さない。
  ctrl3.append(cbtn('wand', '自動メモ', () => autoNotes()));
  if (!variant) {
    ctrl3.append(
      cbtn('search', 'ソルバーで解説', () => {
        if (paused) return; // 停表盯盘対策：一時停止中は答えを見に行けない
        track('solver_jump', { level: levelJa, daily, archive });
        const href = '/tools/solver/?grid=' + cur.map((v) => v || '.').join('');
        setTimeout(() => { location.href = href; }, 150); // 直遷移だと dataLayer のイベントが載る前に unload しうる
      }),
    );
  }

  // —— 间違いチェック开关 ——
  const checkBox = el('input') as HTMLInputElement;
  checkBox.type = 'checkbox';
  checkBox.checked = checkErrors;
  checkBox.addEventListener('change', () => {
    checkErrors = checkBox.checked;
    store.set('numpredo.pref.check', checkErrors ? '1' : '0');
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
      cells[selected].focus(); // 焦点跟随选中格：读屏能播报新格，Tab 序也保持一致（roving tabindex）
      return;
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) redo(); // Ctrl/Cmd+Shift+Z = やり直し
      else undo();
      return;
    }
    if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      redo(); // Ctrl+Y = やり直し（Windows 標準）
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
    redoStack = []; // 新規の操作が入ったら「やり直し」系譜は無効（標準的な undo/redo 意味論）
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
    if (pencil && cur[selected] !== 0) return; // 已填格无笔记可记：直接返回，不产生"空撤销"记录
    // 数字完成ロック：盤面に既に9個ある数字は誤タップ防止のため入力せず、全盤ハイライトとして扱う
    // （日本App差評「入力済みの数字を誤タップして失敗」対策。間違い含み9個でも、直せば数は減る）
    if (!pencil && cur[selected] !== d) {
      let cnt = 0;
      for (let i = 0; i < 81; i++) if (cur[i] === d) cnt++;
      if (cnt >= 9) {
        highlightDigit = highlightDigit === d ? 0 : d;
        render();
        return;
      }
    }
    pushHistory();
    if (pencil) {
      notes[selected] ^= bit(d);
    } else {
      const wasToggleOff = cur[selected] === d;
      cur[selected] = wasToggleOff ? 0 : d;
      notes[selected] = 0;
      // メモ自动清除：填入数字时，从同 unit（行・列・宫，変体では対角線も）的候选笔记里移除该数字
      if (!wasToggleOff) {
        for (const p of ctx.peers[selected]) notes[p] &= ~bit(d);
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
    redoStack.push({ c: cur.slice(), n: notes.slice() });
    const prev = history.pop()!;
    cur = prev.c;
    notes = prev.n;
    clearHint();
    save();
    render();
  }
  function redo(): void {
    if (done || paused || !redoStack.length) return;
    // pushHistory は使わない（redoStack を消してしまう）——履歴へ直接積む
    history.push({ c: cur.slice(), n: notes.slice() });
    if (history.length > 200) history.shift();
    const nx = redoStack.pop()!;
    cur = nx.c;
    notes = nx.n;
    clearHint();
    save();
    render();
  }
  // 自動メモ：全空きマスへ、現在盤面から機械的に求めた候補を一括記入（メモの手作業を省く定番 QoL）。
  // 候補は「見えている盤面」基準の客観計算（誤記入があればそれ込み——衝突ハイライトと同じ思想、答えは覗かない）
  function autoNotes(): void {
    if (done || paused) return;
    clearHint();
    pushHistory();
    const cand = computeCandidates(cur as Grid, ctx);
    for (let i = 0; i < 81; i++) if (cur[i] === 0) notes[i] = cand[i];
    save();
    render();
  }
  // multi（毎日5問）は難易度別に best/prog を分ける
  const bestKey = (): string =>
    `numpredo.best.${archive ? 'archive' : daily ? 'daily' : level}${multi && dailyLevel ? '.' + dailyLevel : ''}`;
  function checkDone(): void {
    if (!cur.every((v, i) => v === solution[i])) return;
    done = true;
    finalTime = elapsedBase + (Date.now() - start);
    if (timer) clearInterval(timer);
    const prev = Number(store.get(bestKey()) || '0');
    isRecord = prev === 0 || finalTime < prev;
    if (isRecord) store.set(bestKey(), String(finalTime));
    if (daily && !archive) { bumpStreak(); dailyLog(); log5Write(jstDayStr()); fillDaily(); }
    if (archive) { dailyLog(archiveDay); log5Write(archiveDay); fillDaily(); } // 遡及記入のみ、ストリークは実時間限定
    logStat();
    track('game_complete', { level: levelJa, daily, record: isRecord, archive, ...(multi && dailyLevel ? { daily_level: dailyLevel } : {}) });
    renderResult(prev);
    showNewAchievements();
    burst();
  }

  // —— 暂停（停表 + 遮盖盘面，防"停表盯盘"作弊）——
  function pause(): void {
    if (done || paused) return;
    paused = true;
    elapsedBase += Date.now() - start; // 当前段时长累积进 base → elapsed 即冻结
    if (timer) { clearInterval(timer); timer = null; }
    left.classList.add('sk-paused');
    pauseBtn.setAttribute('aria-label', '再開');
    save();
    render();
  }
  function resume(): void {
    if (!paused) return;
    paused = false;
    start = Date.now();
    if (!done) timer = setInterval(tick, 1000);
    left.classList.remove('sk-paused');
    pauseBtn.setAttribute('aria-label', '一時停止');
    render();
  }
  function togglePause(): void { paused ? resume() : pause(); }

  // —— 区域完成即时反馈（填满一行/列/宫且全部正确 → 该 9 格脉冲一下）——
  function checkAreaComplete(cell: number): void {
    if (cell < 0) return;
    for (const u of ctx.units) {
      if (!u.includes(cell)) continue;
      if (u.every((i) => cur[i] !== 0 && cur[i] === solution[i])) flashArea(u);
    }
  }
  function flashArea(idxs: number[]): void {
    for (const i of idxs) cells[i].classList.add('sk-area-done');
    setTimeout(() => { for (const i of idxs) cells[i].classList.remove('sk-area-done'); }, 720);
  }

  // —— 提示（三级递进：ナッジ → テクニック → 結論。纠错优先；高级技巧配候选浮层教学）——
  function clearHint(): void {
    hintMsg.textContent = '';
    hintMsg.classList.remove('on');
    hintRegion.clear();
    hintFocus.clear();
    hintWrong.clear();
    hintCand.clear();
    hintX.clear();
    for (const c of cells) c.classList.remove('sk-hint-cell', 'sk-hint-region', 'sk-wrong-cell');
  }
  // 「正确盘面」= given + 已正确填入（忽略错填与笔记）+ 其候选表——单数判定/浮层/消除型共用
  function correctBoard(): { g: number[]; cand: number[] } {
    const g = cur.map((v, i) => (given[i] || v === solution[i] ? v : 0));
    const cand = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      let m = MASK_ALL;
      for (const p of ctx.peers[i]) if (g[p]) m &= ~bit(g[p]);
      cand[i] = m;
    }
    return { g, cand };
  }
  function hint(): void {
    if (done || paused) return;
    hintUsed = true;
    // 盘面签名变了（落子/撤销/换题）→ 重置到第1级；连点同盘 → 逐级深入（封顶3）
    const sig = cur.join('');
    if (sig !== hintSig) { hintLevel = 1; hintSig = sig; } else hintLevel = Math.min(hintLevel + 1, 3);
    clearHint();

    // ① 错填格优先纠错（不占级别、不算下一步）
    const wrong: number[] = [];
    for (let i = 0; i < 81; i++) if (cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) wrong.push(i);
    if (wrong.length) {
      for (const i of wrong) hintWrong.add(i);
      hintMsg.innerHTML = `<b>${wrong.length}マス</b>が間違っています。まず直してみましょう。`;
      hintMsg.classList.add('on');
      render();
      return;
    }

    const { g, cand } = correctBoard();
    const single = findSingle(g, cand);
    if (single) { showSingle(single); return; }
    const elim = findElimination(g);
    if (elim) { showElimination(elim); return; }

    // ④ 兜底安全网：引擎意外找不到（本站题理论必可解）→ 揭示第一个空格
    let empty = -1;
    for (let i = 0; i < 81; i++) if (cur[i] === 0) { empty = i; break; }
    if (empty < 0) return;
    selected = empty;
    hintFocus.add(empty);
    setHint(`このマスは <b>${solution[empty]}</b> です（<a href="/guide/how-to-solve/">解き方ガイド</a>）。`);
    render();
  }

  // 提示文案 +（未到第3级时）「もう一度で詳しく」尾巴，暗示还能继续深入
  function setHint(html: string, more = false): void {
    hintMsg.innerHTML = html + (more ? '<span class="sk-hint-more">（もう一度ヒントで詳しく）</span>' : '');
    hintMsg.classList.add('on');
  }
  // 宫内 9 格（ナッジ段階の範囲ハイライト用）
  function boxCells(cell: number): number[] {
    const b = boxOf(cell);
    const r0 = 3 * ((b / 3) | 0), c0 = 3 * (b % 3);
    const out: number[] = [];
    for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) out.push(r * 9 + c);
    return out;
  }

  // —— 単数（裸/隠）三级展开 ——
  function showSingle(s: { cell: number; digit: number; tech: string; cand: number; unit?: number[] }): void {
    const t = TECH_JA[s.tech];
    if (hintLevel <= 1) {
      for (const i of boxCells(s.cell)) hintRegion.add(i);
      setHint(`<b>${BOX_JA[boxOf(s.cell)]}</b>のブロックに、次の一手があります。`, true);
    } else if (hintLevel === 2) {
      selected = s.cell;
      hintFocus.add(s.cell);
      hintCand.set(s.cell, s.cand); // 该格真实候选（裸单数=只剩1个；隐单数=多个，配单元高亮说明为何唯一）
      if (s.unit) for (const i of s.unit) if (i !== s.cell) hintRegion.add(i);
      const why = s.tech === 'nakedSingle'
        ? 'このマスに入れる候補が1つだけです。'
        : 'この数字を置けるマスは、光っている範囲でここだけです。';
      setHint(`<b>${t.ja}</b>：${why}（<a href="${t.href}">解き方</a>）`, true);
    } else {
      selected = s.cell;
      hintFocus.add(s.cell);
      setHint(`このマスは<b>${t.ja}</b>で <b>${s.digit}</b> に決まります（<a href="${t.href}">解き方</a>）。`);
    }
    render();
  }

  // —— 高级技巧（消除型）三级展开 ——
  function showElimination(e: { tech: string; cells: number[]; digits: number; cand: number[]; remove: Map<number, number> }): void {
    const t = TECH_JA[e.tech] ?? { ja: e.tech, href: '/guide/how-to-solve/' };
    const primary = e.cells[0];
    if (hintLevel <= 1) {
      for (const i of boxCells(primary)) hintRegion.add(i);
      setHint(`<b>${BOX_JA[boxOf(primary)]}</b>の周辺に、候補を消せる手筋があります。`, true);
    } else if (hintLevel === 2) {
      selected = primary;
      for (const c of e.cells) { hintFocus.add(c); hintCand.set(c, e.cand[c]); }
      setHint(`<b>${t.ja}</b>が使えます。ハイライトしたマスの候補の並びに注目（<a href="${t.href}">解き方</a>）。`, true);
    } else {
      selected = primary;
      for (const c of e.cells) { hintFocus.add(c); hintCand.set(c, e.cand[c]); hintX.set(c, e.remove.get(c) ?? 0); }
      setHint(`<b>${t.ja}</b>で、赤い候補（<b>${digitsOf(e.digits).join('・')}</b>）を消せます（<a href="${t.href}">解き方</a>）。`);
    }
    render();
  }

  function findSingle(g: number[], cand: number[]): { cell: number; digit: number; tech: string; cand: number; unit?: number[] } | null {
    // 裸单数：候选只剩一个
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0 && popcount(cand[i]) === 1) {
        return { cell: i, digit: digitsOf(cand[i])[0], tech: 'nakedSingle', cand: cand[i] };
      }
    }
    // 隐单数：某数字在单元内只剩一处（変体では対角線 unit も対象）
    for (const u of ctx.units) {
      for (let d = 1; d <= 9; d++) {
        let spot = -1, n = 0;
        for (const c of u) if (g[c] === 0 && cand[c] & bit(d)) { n++; spot = c; }
        if (n === 1) return { cell: spot, digit: d, tech: 'hiddenSingle', cand: cand[spot], unit: u };
      }
    }
    return null;
  }

  // 消除型：引擎 traceFirstElimination 取「第一个消候选步」+ 执行前候选快照（传 ctx → 対角線兼容）
  function findElimination(g: number[]): { tech: string; cells: number[]; digits: number; cand: number[]; remove: Map<number, number> } | null {
    const tr = traceFirstElimination(g as Grid, ctx);
    if (!tr || !tr.step.eliminations || !tr.step.eliminations.length) return null;
    const remove = new Map<number, number>();
    let digits = 0;
    for (const [cell, d] of tr.step.eliminations) {
      remove.set(cell, (remove.get(cell) ?? 0) | bit(d));
      digits |= bit(d);
    }
    return { tech: tr.step.technique, cells: [...remove.keys()], digits, cand: tr.candidates, remove };
  }

  // —— 题面切换 ——
  function apply(pz: Grid, sol: Grid, restore?: Saved): void {
    puzzleGrid = pz;
    solution = sol;
    given = pz.map((v) => v !== 0);
    history = [];
    redoStack = [];
    hintUsed = false;
    selected = -1;
    paused = false;
    highlightDigit = 0;
    left.classList.remove('sk-paused');
    pauseBtn.setAttribute('aria-label', '一時停止'); // 暫停中に restart/タブ切替した場合の label 残留を防ぐ
    isRecord = false;
    clearHint();
    if (restore) {
      cur = restore.c.split('').map(Number);
      notes = restore.n ? restore.n.split(',').map(Number) : new Array(81).fill(0);
      elapsedBase = restore.e || 0;
      done = restore.d === 1;
      finalTime = done ? elapsedBase : 0;
      hintUsed = restore.h === 1; // 提示使用状態も復元（ノーヒント実績の跨刷新一致性）
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
    store.remove(progKey());
    apply(puzzleGrid.slice(), solution.slice());
  }
  // 「別の問題」：预生成池内循环（难度保真、零等待）。set 由 play/[level].astro 嵌入 30 道，
  // 与图解页 No.1〜30 一一对应（?n= 直达同一下标）。
  function newPuzzle(): void {
    if (set.length < 2) return;
    store.remove(progKey());
    poolIdx = (poolIdx + 1) % set.length;
    const nx = set[poolIdx];
    const pz = gridFromString(nx.puzzle);
    const sol = nx.solution ? gridFromString(nx.solution) : solveOne(pz, ctx);
    if (sol) apply(pz, sol);
  }

  // —— 进度持久化 ——
  function progKey(): string {
    return `numpredo.prog.${archive ? 'archive' : daily ? 'daily' : level}${multi && dailyLevel ? '.' + dailyLevel : ''}`;
  }
  function save(): void {
    const data: Saved = {
      p: gridToStr(puzzleGrid),
      s: gridToStr(solution),
      c: cur.join(''),
      n: notes.join(','),
      e: elapsed(),
      d: done ? 1 : 0,
      h: hintUsed ? 1 : 0,
    };
    if (daily) data.day = archive ? archiveDay : jstDayStr();
    store.set(progKey(), JSON.stringify(data)); // store 内部已兜异常（容量超限/不可用 → 静默不保存）
  }
  function load(): Saved | null {
    try {
      const raw = store.get(progKey());
      if (!raw) return null;
      const o = JSON.parse(raw) as Saved;
      if (daily && o.day !== (archive ? archiveDay : jstDayStr())) return null; // 跨日/別日失效（JST 基準）
      // 三个盘面串都必须 81 位——损坏存档若只查 c，p/s 会在 gridFromString 处抛异常砸掉整个岛
      if (o.p?.length !== 81 || o.s?.length !== 81 || o.c?.length !== 81) return null;
      return o;
    } catch { return null; }
  }

  // —— 逐局完成日志（統計ページ/実績/月历の最小データ層。上限1000件で自然轮替）——
  function logStat(): void {
    try {
      // 損壊データは型検証で捨てて上書き自愈（catch 放置だと以後の全記録が永久に空振りする）
      let arr: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(store.get('numpredo.stats.v1') ?? '[]');
        if (Array.isArray(parsed)) arr = parsed;
      } catch { /* 損壊 → 空で作り直し */ }
      arr.push({
        t: Date.now(), lv: daily ? dailyLevel || 'daily' : level, ms: finalTime, d: daily ? 1 : 0,
        day: archive ? archiveDay : jstDayStr(), h: hintUsed ? 1 : 0, r: isRecord ? 1 : 0,
      });
      if (arr.length > 1000) arr.splice(0, arr.length - 1000);
      store.set('numpredo.stats.v1', JSON.stringify(arr));
    } catch { /* 静默：日志失败不影响游戏 */ }
  }
  // daily 月历数据：日付 → クリアタイム(ms)。カレンダー打刻の真实源（archive は対象日へ遡及記入）
  function dailyLog(dateStr = ''): void {
    try {
      let m: Record<string, number> = {};
      try {
        const parsed = JSON.parse(store.get('numpredo.daily.log') ?? '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) m = parsed;
      } catch { /* 損壊 → 空で作り直し */ }
      const key = dateStr || jstDayStr();
      if (!m[key]) { m[key] = finalTime; store.set('numpredo.daily.log', JSON.stringify(m)); }
    } catch { /* 静默 */ }
  }
  // 毎日5問：日付 → クリア済み難易度の記録（タブ✓と「一日五冠」実績の真实源）
  function log5Write(dateKey: string): void {
    if (!multi || !dailyLevel) return;
    try {
      let m: Record<string, string[]> = {};
      try {
        const p = JSON.parse(store.get('numpredo.daily.log5') ?? '{}');
        if (p && typeof p === 'object' && !Array.isArray(p)) m = p;
      } catch { /* 損壊 → 空で作り直し */ }
      const arr = Array.isArray(m[dateKey]) ? m[dateKey] : [];
      if (!arr.includes(dailyLevel)) {
        arr.push(dailyLevel);
        m[dateKey] = arr;
        store.set('numpredo.daily.log5', JSON.stringify(m));
      }
    } catch { /* 静默 */ }
  }
  // —— 実績：完成時に新規解放ぶんをトースト表示（判定は achievements.ts の純関数）——
  function showNewAchievements(): void {
    try {
      const unlocked = computeUnlocked(readStats(), readDailyLog(), readStreak(), readDailyLog5());
      let seen: string[] = [];
      try {
        const p = JSON.parse(store.get('numpredo.achv.seen') ?? '[]');
        if (Array.isArray(p)) seen = p;
      } catch { /* 損壊 → 全部「新規」として再表示されるだけ（無害） */ }
      const fresh = [...unlocked].filter((id) => !seen.includes(id));
      if (!fresh.length) return;
      // 并集で保存（整表覆盖だと streak 断签等で「回锁」した実績が seen から消え、再達成時に二度目のトーストが出る）
      store.set('numpredo.achv.seen', JSON.stringify([...new Set([...seen, ...unlocked])]));
      const defs = fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter((a) => !!a);
      if (!defs.length) return;
      const box = el('div', 'sk-achv');
      box.innerHTML =
        `<div class="sk-achv-h">実績解除！</div>` +
        defs.map((a) => `<div class="sk-achv-i"><span class="sk-achv-ic">${a!.icon}</span><b>${a!.name}</b><span class="sk-achv-d">${a!.desc}</span></div>`).join('') +
        `<a class="sk-achv-more" href="/stats/">実績・統計を見る →</a>`;
      result.prepend(box);
    } catch { /* 実績表示の失敗は無視 */ }
  }

  // —— daily：日期 + 连续记录 ——
  function bumpStreak(): void {
    const today = jstDayStr();
    const last = store.get('numpredo.daily.last');
    if (last === today) return;
    const streak = last === jstDayStr(-1) ? Number(store.get('numpredo.daily.streak') || '0') + 1 : 1;
    store.set('numpredo.daily.last', today);
    store.set('numpredo.daily.streak', String(streak));
  }
  // multi：難易度タブ HTML（クリア済みに ✓）+ 切替リスナー
  function tabsHtml(dateKey: string): string {
    if (!multi) return '';
    const clearedLvs = readDailyLog5()[dateKey] ?? [];
    return `<div class="sk-dtabs">${LV_ORDER5.map((lv, i) =>
      `<button type="button" class="sk-dtab${i === tabIdx ? ' on' : ''}" data-tab="${i}">${LV_JA[lv]}${clearedLvs.includes(lv) ? '<i>✓</i>' : ''}</button>`,
    ).join('')}</div>`;
  }
  function bindTabs(): void {
    dailyEl.querySelectorAll<HTMLButtonElement>('.sk-dtab').forEach((b) =>
      b.addEventListener('click', () => switchTab(Number(b.dataset.tab))),
    );
  }
  function switchTab(i: number): void {
    if (!multi || i === tabIdx || i < 0 || i > 4 || !set[dayBase + i]) return;
    if (!done) save(); // 進行中タブの盤面・タイムを保存してから切替
    tabIdx = i;
    store.set('numpredo.pref.dailytab', String(i));
    const t = set[dayBase + i];
    dailyLevel = t.level ?? LV_ORDER5[i];
    const sv = load();
    if (sv && normP(sv.p) === normP(t.puzzle)) {
      apply(gridFromString(sv.p), gridFromString(sv.s), sv);
      if (done) renderResult(Number(store.get(bestKey()) || '0'));
    } else {
      const pz = gridFromString(t.puzzle);
      const sol = t.solution ? gridFromString(t.solution) : solveOne(pz, ctx);
      if (sol) apply(pz, sol);
    }
    fillDaily();
  }
  function fillDaily(): void {
    if (archive) {
      // アーカイブ表示：対象日 + 完了状況のみ（ストリークは実時間デイリー専用なので出さない）
      const [, am, ad] = archiveDay.split('-').map(Number);
      const clearedA = (readDailyLog5()[archiveDay] ?? []).length;
      dailyEl.innerHTML =
        `<div class="sk-d-date">${am}月${ad}日の問題<span class="sk-d-arch">アーカイブ</span></div>` +
        tabsHtml(archiveDay) +
        `<div class="sk-d-streak">${clearedA >= 5 ? '五冠達成 🎇' : clearedA > 0 ? `${clearedA} / 5 クリア` : '過去の問題に挑戦'}</div>`;
      bindTabs();
      return;
    }
    const { m, d } = jstParts();
    // 断签即视为归零：last 不是今天/昨天时，旧 streak 只是历史值，显示会误导（bumpStreak 下次完成会重置）
    const last = store.get('numpredo.daily.last');
    const active = last === jstDayStr() || last === jstDayStr(-1);
    const streak = active ? Number(store.get('numpredo.daily.streak') || '0') : 0;
    const doneToday = last === jstDayStr();
    const clearedN = multi ? (readDailyLog5()[jstDayStr()] ?? []).length : 0;
    dailyEl.innerHTML =
      `<div class="sk-d-date">${m}月${d}日の問題</div>` +
      tabsHtml(jstDayStr()) +
      (multi && clearedN > 0 ? `<div class="sk-d-level">${clearedN >= 5 ? '本日五冠達成 🎇' : `本日 ${clearedN} / 5 クリア`}</div>` : '') +
      `<div class="sk-d-streak">${streak > 0 ? streak + '日連続' : '記録に挑戦'}${doneToday ? ' ✓' : ''}</div>`;
    bindTabs();
  }

  // —— 成绩卡（纯渲染，无演出/统计副作用：完局存档恢复时也复用，不会重复上报/撒彩屑）——
  function renderResult(prevBest: number): void {
    const lines = [`<div class="sk-r-title">クリア！</div>`];
    lines.push(`<div class="sk-r-time">${fmt(finalTime)}</div>`);
    if (isRecord) lines.push(`<div class="sk-r-rec">✦ 自己ベスト更新！</div>`);
    else if (prevBest) lines.push(`<div class="sk-r-best">自己ベスト ${fmt(prevBest)}</div>`);
    // ③ 学习导线：解完这题时，用引擎解析本题**真实用到的技巧**，做成 chip 链到攻略页。
    // 通关成就感最高的时刻 → 把玩家导向技巧学习页（教学闭环 + SEO 内链）。TECH_JA 未覆盖的技巧跳过。
    const techCounts = logicalSolve(puzzleGrid, ctx).techniqueCounts;
    const usedTechs = TECH_ORDER.filter((t) => techCounts[t] && TECH_JA[t]);
    if (usedTechs.length) {
      const chips = usedTechs.map((t) => `<a class="sk-r-tech" href="${TECH_JA[t].href}">${TECH_JA[t].ja}</a>`).join('');
      lines.push(`<div class="sk-r-learn"><div class="sk-r-learn-h">この問題で使ったテクニック</div><div class="sk-r-techs">${chips}</div></div>`);
    }
    result.innerHTML = lines.join('');
    const hasNext = !daily && set.length > 1;
    if (hasNext) {
      const nb = el('button', 'sk-share') as HTMLButtonElement;
      nb.type = 'button';
      nb.textContent = '次の問題へ';
      nb.addEventListener('click', () => newPuzzle());
      result.append(nb);
    }
    const sb = el('button', hasNext ? 'sk-share sk-ghost' : 'sk-share') as HTMLButtonElement;
    sb.type = 'button';
    sb.textContent = '結果をシェア';
    sb.addEventListener('click', share);
    result.append(sb);
    result.classList.add('on');
  }
  function share(): void {
    track('share_click', { from: archive ? 'archive' : daily ? 'daily' : 'game', level: levelJa });
    const lvSuffix = multi && dailyLevel && LV_JA[dailyLevel] ? `・${LV_JA[dailyLevel]}` : '';
    const text = `numpredoで【${levelJa}${lvSuffix}】を ${fmt(finalTime)} でクリア！`;
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
    const peerSet = selected >= 0 ? new Set(ctx.peers[selected]) : new Set<number>();
    board.classList.toggle('sk-pencil-on', pencil); // 笔记模式 → 盘面状态反馈
    let rem = 0;
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      // area-done は render 外（flashArea の setTimeout）で付くため毎フレーム保持。hint 系は下の Set が唯一の真実源。
      const keep = c.className.match(/sk-area-done/g) || [];
      c.className = ['sk-cell', ...keep].join(' ');
      if (colOf(i) % 3 === 2 && colOf(i) !== 8) c.classList.add('sk-br');
      if (rowOf(i) % 3 === 2 && rowOf(i) !== 8) c.classList.add('sk-bb');
      if (diagCells.has(i)) c.classList.add('sk-diag'); // 対角線変体：対角線マスの色分け（毎フレーム再付与）
      if (given[i]) c.classList.add('sk-given');
      if (hintRegion.has(i)) c.classList.add('sk-hint-region'); // 提示第1级：范围提示
      if (i === selected) c.classList.add('sk-sel');
      else if (peerSet.has(i)) c.classList.add('sk-peer');
      if (hlVal && cur[i] === hlVal) c.classList.add('sk-same');
      if (hintFocus.has(i)) c.classList.add('sk-hint-cell'); // 提示目标格 / 消除格
      if (hintWrong.has(i)) c.classList.add('sk-wrong-cell'); // 提示纠错：错填格
      if (checkErrors && cur[i] !== 0 && !given[i] && cur[i] !== solution[i]) c.classList.add('sk-err');
      // 规则冲突：与同 unit（行/列/宫，変体では対角線も）的相同数字重复 → 即时粉红高亮（客观、不剧透答案）
      if (cur[i] !== 0) {
        for (const p of ctx.peers[i]) if (cur[p] === cur[i]) { c.classList.add('sk-conflict'); break; }
      }

      if (cur[i] !== 0) {
        c.textContent = String(cur[i]);
        counts[cur[i]]++;
      } else if (hintCand.has(i)) {
        // 提示候选浮层：引擎现算候选，与玩家笔记视觉区分（sk-hint-notes）；被消候选标红（sk-hx）
        c.textContent = '';
        const mask = hintCand.get(i)!;
        const xmask = hintX.get(i) ?? 0;
        const n = el('span', 'sk-notes sk-hint-notes');
        for (let d = 1; d <= 9; d++) {
          const s = el('i');
          if (mask & bit(d)) { s.textContent = String(d); if (xmask & bit(d)) s.className = 'sk-hx'; }
          else s.textContent = '';
          n.append(s);
        }
        c.append(n);
        rem++;
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
      // roving tabindex：Tab 只进入一个格（选中格，未选中时左上角），81 个 tab 停靠点 → 1 个
      c.tabIndex = i === selected || (selected < 0 && i === 0) ? 0 : -1;
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

  // —— 页面切后台自动暂停（计时公平：挂后台不再累计），离开页面前兜底保存 ——
  document.addEventListener('visibilitychange', () => { if (document.hidden && !done && !paused) pause(); });
  window.addEventListener('pagehide', () => { if (!done && !paused) save(); });

  // —— 初始化：定位起始题 → 恢复存档（含完成局）或开新局 ——
  let initIdx = 0;
  if (archive) {
    // アーカイブ：?d=YYYY-MM-DD の過去日（EPOCH〜昨日）。set は EPOCH 起点で全過去日を埋め込み、
    // data-daystart = EPOCH の日序号。既定は昨日。窓外(未ビルド分)は最後の埋め込み日へクランプ。
    const epochIdx = Number(root.dataset.daystart ?? NaN);
    const todayIdx = jstDayIndex();
    let idx = todayIdx - 1;
    const q = new URLSearchParams(location.search).get('d') ?? '';
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q);
    if (dm) {
      const di = Math.floor(Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) / 86400000);
      if (di >= epochIdx && di < todayIdx) idx = di;
    }
    const days = multi ? (set.length / 5) | 0 : set.length; // multi は 1 日 5 エントリ
    if (!Number.isFinite(epochIdx) || days < 1) { root.innerHTML = '<p class="sk-arch-empty">アーカイブを読み込めませんでした。<a href="/daily/">今日の問題へ</a></p>'; return; }
    idx = Math.min(idx, epochIdx + days - 1); // ビルド停滞ぶんのクランプ
    // 上线首日/时钟异常时无「过去」可解——死壳盘面(undefined 格子)を残さず案内文に差し替え
    if (idx < epochIdx) { root.innerHTML = '<p class="sk-arch-empty">アーカイブはまだありません。<a href="/daily/">今日の問題へ</a></p>'; return; }
    if (multi) {
      dayBase = (idx - epochIdx) * 5;
      const prefTab = Math.trunc(Number(store.get('numpredo.pref.dailytab') ?? '1'));
      tabIdx = Number.isInteger(prefTab) ? Math.min(4, Math.max(0, prefTab)) : 1; // '0'(初級)も有効。非整数/NaN は中級へ
      initIdx = dayBase + tabIdx;
    } else {
      initIdx = idx - epochIdx;
    }
    const ad = new Date(idx * 86400000);
    archiveDay = `${ad.getUTCFullYear()}-${pad2(ad.getUTCMonth() + 1)}-${pad2(ad.getUTCDate())}`;
    dailyLevel = set[initIdx].level ?? (multi ? LV_ORDER5[tabIdx] : '');
  } else if (daily) {
    // JST 日序号 → 嵌入窗口偏移（data-daystart 为窗口首日，见 daily.astro）。
    // 窗口外（构建停滞超过窗口天数）取模兜底——仍是全员一致的确定性选题。
    const dayStart = Number(root.dataset.daystart ?? NaN);
    const off = jstDayIndex() - dayStart;
    if (multi) {
      const days = Math.max(1, (set.length / 5) | 0);
      const dayOff = Number.isFinite(dayStart) ? ((off % days) + days) % days : 0;
      dayBase = dayOff * 5;
      const prefTab = Math.trunc(Number(store.get('numpredo.pref.dailytab') ?? '1'));
      tabIdx = Number.isInteger(prefTab) ? Math.min(4, Math.max(0, prefTab)) : 1; // '0'(初級)も有効。非整数/NaN は中級へ
      initIdx = dayBase + tabIdx;
    } else {
      initIdx = Number.isFinite(dayStart) ? ((off % set.length) + set.length) % set.length : 0;
    }
    dailyLevel = set[initIdx].level ?? (multi ? LV_ORDER5[tabIdx] : '');
  } else {
    // ?n= 直达题库第 n 题（图解页 /play/{level}/{n}/ 的「この問題をプレイ」入口）
    const urlN = Number(new URLSearchParams(location.search).get('n') ?? '0');
    if (urlN >= 1 && urlN <= set.length) initIdx = urlN - 1;
  }
  poolIdx = initIdx;
  const target = set[initIdx];
  const saved = load();
  // ?n= 明示指定且与存档不是同一题时，以指定题开新局（首次落子会覆盖旧存档——用户主动选择）
  const savedUsable = saved && (initIdx === 0 || daily || normP(saved.p) === normP(target.puzzle));
  if (saved && savedUsable) {
    const i = set.findIndex((s) => normP(s.puzzle) === normP(saved.p));
    if (i >= 0) poolIdx = i; // 存档题在池内 → 「別の問題」从它继续往后循环
    apply(gridFromString(saved.p), gridFromString(saved.s), saved);
    // 完成局照样恢复：盘面保持完成态 + 成绩卡（无彩屑/不重复上报），并给「次の問題へ」入口
    if (done) renderResult(Number(store.get(bestKey()) || '0'));
  } else {
    const fpz = gridFromString(target.puzzle);
    // daily は solution 未配信 → solveOne で現算（play は予生成 solution をそのまま使う）
    const fsol = target.solution ? gridFromString(target.solution) : solveOne(fpz, ctx);
    if (fsol) apply(fpz, fsol);
  }
  if (daily) fillDaily();
}

document.querySelectorAll<HTMLElement>('[data-sudoku]').forEach(setup);
