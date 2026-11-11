import { PEERS, boxOf, colOf, digitsOf, popcount, rowOf, TECH_INFO } from '../engine/index.ts';
import { createCandidateProgress, replayCandidateProgress, editCandidateProgress, candidateRemoval, describeCandidateStep } from './candidate-progress.ts';
import { addReturnLink, carriedParam, toolLink } from './learning-transfer.ts';
import { track } from './track.ts';

const root = document.querySelector<HTMLElement>('[data-candidate-checker]');
if (root) setup(root);

function setup(root: HTMLElement): void {
  const SAMPLE = '..42.....3......6.5..3...71..5.72.43..39.65..21.53.6..15...3..4.8......5.....17..';
  const urlGrid = carriedParam('grid') ?? '';
  let grid = /^[0-9.]{81}$/.test(urlGrid) ? parse(urlGrid) : new Array<number>(81).fill(0);
  let selected = 0;
  let progress = createCandidateProgress(grid);
  let candidates = progress.candidates;
  let useTracked = false;

  const trackUse = (source: 'manual' | 'paste' | 'sample'): void => {
    if (useTracked) return;
    useTracked = true;
    track('candidate_check', { input_method: source });
  };

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('a[href^="/tools/solver/"]')) return;
    track('candidate_to_solver', {
      filled: grid.filter((value) => value !== 0).length,
      has_conflict: conflictCells(grid).size > 0,
    });
  });

  const board = document.createElement('div');
  board.className = 'cc-board';
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', '候補を調べる数独盤面');
  const cells: HTMLButtonElement[] = [];
  for (let row = 0; row < 9; row++) {
    const rowElement = document.createElement('div');
    rowElement.className = 'cc-row';
    rowElement.setAttribute('role', 'row');
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cc-cell';
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', () => { selected = index; render(); });
      cells.push(cell);
      rowElement.append(cell);
    }
    board.append(rowElement);
  }

  const pad = document.createElement('div');
  pad.className = 'cc-pad';
  for (let digit = 1; digit <= 9; digit++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(digit);
    button.addEventListener('click', () => input(digit));
    pad.append(button);
  }
  const erase = document.createElement('button');
  erase.type = 'button';
  erase.textContent = '消す';
  erase.addEventListener('click', () => input(0));
  pad.append(erase);

  const controls = document.createElement('div');
  controls.className = 'cc-controls';
  controls.append(action('サンプルを入力', () => { trackUse('sample'); grid = parse(SAMPLE); selected = grid.findIndex((v) => v === 0); analyze(); }), action('全部消す', () => { grid.fill(0); selected = 0; analyze(); }));

  const stepsControls = document.createElement('div');
  stepsControls.className = 'cc-controls cc-steps';
  const apply = action('この一手を適用', () => navigate(progress.applied + 1));
  const undo = action('一手戻る', () => navigate(progress.applied - 1));
  const reset = action('手順リセット', () => navigate(0));
  stepsControls.append(apply, undo, reset);
  const progressText = document.createElement('p');
  progressText.className = 'cc-progress';
  progressText.setAttribute('aria-live', 'polite');

  const result = document.createElement('div');
  result.className = 'cc-result';
  result.setAttribute('aria-live', 'polite');
  const layout = document.createElement('div');
  layout.className = 'cc-layout';
  const left = document.createElement('div');
  left.append(board);
  const right = document.createElement('div');
  right.append(pad, controls, progressText, stepsControls, result);
  addReturnLink(right);
  layout.append(left, right);
  root.replaceChildren(layout);
  render();

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
    if (event.key >= '1' && event.key <= '9') { input(Number(event.key)); event.preventDefault(); }
    else if (['0', 'Backspace', 'Delete'].includes(event.key)) { input(0); event.preventDefault(); }
    else {
      const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (move[event.key]) { selected = Math.max(0, Math.min(80, selected + move[event.key])); render(); cells[selected].focus(); event.preventDefault(); }
    }
  });
  document.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text').replace(/[^0-9.]/g, '') ?? '';
    if (text.length !== 81) return;
    trackUse('paste');
    grid = parse(text);
    selected = Math.max(0, grid.findIndex((value) => value === 0));
    analyze();
    event.preventDefault();
  });

  function action(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function input(value: number): void {
    if (value) trackUse('manual');
    progress = editCandidateProgress(progress, selected, value);
    grid = progress.grid;
    if (value && selected < 80) selected++;
    candidates = progress.candidates;
    render();
  }

  function analyze(): void {
    progress = createCandidateProgress(grid);
    grid = progress.grid;
    candidates = progress.candidates;
    render();
  }

  function navigate(applied: number): void {
    progress = replayCandidateProgress(progress, applied);
    grid = progress.grid;
    candidates = progress.candidates;
    render();
  }

  function render(): void {
    const conflicts = conflictCells(grid);
    const noCandidates = grid.some((value, cell) => value === 0 && candidates[cell] === 0);
    apply.disabled = !progress.next || conflicts.size > 0 || noCandidates;
    undo.disabled = reset.disabled = progress.applied === 0;
    progressText.textContent = `適用済み：${progress.applied}手。盤面を入力・変更すると手順を最初から調べ直します。`;
    const selectedPeers = new Set(PEERS[selected]);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.className = 'cc-cell';
      if (i % 9 === 2 || i % 9 === 5) cell.classList.add('cc-br');
      if (rowOf(i) === 2 || rowOf(i) === 5) cell.classList.add('cc-bb');
      if (selectedPeers.has(i)) cell.classList.add('cc-peer');
      if (i === selected) cell.classList.add('cc-selected');
      if (conflicts.has(i)) cell.classList.add('cc-error');
      const candidateText = digitsOf(candidates[i]).join('');
      cell.textContent = grid[i] ? String(grid[i]) : candidateText;
      cell.classList.toggle('cc-given', grid[i] !== 0);
      cell.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      cell.setAttribute('aria-label', `${rowOf(i) + 1}行${colOf(i) + 1}列 ${grid[i] ? grid[i] : `候補 ${candidateText || 'なし'}`}`);
      cell.tabIndex = i === selected ? 0 : -1;
    }
    result.innerHTML = resultHtml(conflicts);
  }

  function resultHtml(conflicts: Set<number>): string {
    const pos = `${rowOf(selected) + 1}行${colOf(selected) + 1}列`;
    if (conflicts.size) return `<p class="cc-alert"><strong>重複があります。</strong>赤いマスの数字が、同じ行・列・3×3ブロックで重なっています。</p>`;
    if (grid.some((value, cell) => value === 0 && candidates[cell] === 0)) return '<p class="cc-alert"><strong>候補がない空きマスがあります。</strong>入力を確認するか、一手戻る・手順リセットで戻してください。</p>';
    const empty = grid.filter((value) => value === 0).length;
    if (!empty) return '<p class="cc-ok"><strong>全マスが埋まりました。</strong>重複はありません。完全な正解かはソルバーで確認できます。</p>';
    const mask = candidates[selected];
    const allowed = grid[selected] ? [] : digitsOf(mask);
    const singles = candidates.filter((value) => popcount(value) === 1).length;
    const first = progress.next;
    const lessonSlug = first && TECH_INFO[first.technique]?.slug;
    const lesson = lessonSlug ? `<p><a href="/guide/techniques/${lessonSlug}/#${['hidden-single','pointing','naked-pair'].includes(lessonSlug) ? 'practice' : 'worked-example'}" target="_blank" rel="noopener">この手筋の理由と練習を別タブで見る</a>（この盤面はそのまま残ります）</p>` : '';
    const next = first
      ? describeCandidateStep(first)
      : '現在の盤面から、対応している手筋による次の一手は見つかりませんでした。入力を確認するか、ソルバーで解の有無を確認してください。';
    const reasons = grid[selected]
      ? `<p>${pos}にはすでに<strong>${grid[selected]}</strong>が入っています。空きマスを選ぶと候補の理由を表示します。</p>`
      : `<p><strong>${pos}の候補：${allowed.length ? allowed.join('・') : 'なし'}</strong></p>${[1,2,3,4,5,6,7,8,9].map((digit) => `<span class="cc-reason ${allowed.includes(digit) ? 'ok' : 'ng'}">${digit}：${allowed.includes(digit) ? '行・列・ブロックに同じ数字なし' : blockedReason(selected, digit)}</span>`).join('')}`;
    const last = progress.history.at(-1);
    const applied = last ? `<p class="cc-summary"><strong>適用した第${progress.applied}手</strong><br>${describeCandidateStep(last)}</p>` : '';
    return `${applied}${reasons}<p class="cc-summary">空き${empty}マス ／ 候補が1つのマス${singles}個</p><p><strong>現在の次の一手</strong><br>${next}</p>${lesson}<p><a href="${toolLink('/tools/solver/', grid)}">この盤面の唯一解と全手順をソルバーで確認</a></p>`;
  }

  function blockedReason(cell: number, digit: number): string {
    const blocker = PEERS[cell].find((peer) => grid[peer] === digit);
    if (blocker === undefined) {
      const removed = candidateRemoval(progress, cell, digit);
      return removed ? `適用済みの第${removed.number}手「${TECH_INFO[removed.step.technique]?.ja ?? removed.step.technique}」で候補削除` : '現在の候補から除外されています';
    }
    const places: string[] = [];
    if (rowOf(blocker) === rowOf(cell)) places.push('同じ行');
    if (colOf(blocker) === colOf(cell)) places.push('同じ列');
    if (boxOf(blocker) === boxOf(cell)) places.push('同じブロック');
    return `${places.join('・')}の${rowOf(blocker) + 1}行${colOf(blocker) + 1}列にある`;
  }
}

function parse(value: string): number[] {
  return [...value].map((char) => char === '.' || char === '0' ? 0 : Number(char));
}

function conflictCells(grid: number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const peer of PEERS[i]) if (grid[peer] === grid[i]) { out.add(i); out.add(peer); }
  }
  return out;
}
