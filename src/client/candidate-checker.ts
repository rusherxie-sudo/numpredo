import { PEERS, boxOf, colOf, computeCandidates, digitsOf, logicalSolve, popcount, rowOf, TECH_INFO } from '../engine/index.ts';
import { track } from './track.ts';

const root = document.querySelector<HTMLElement>('[data-candidate-checker]');
if (root) setup(root);

function setup(root: HTMLElement): void {
  const SAMPLE = '..42.....3......6.5..3...71..5.72.43..39.65..21.53.6..15...3..4.8......5.....17..';
  let grid = new Array<number>(81).fill(0);
  let selected = 0;
  let candidates = computeCandidates(grid);
  let useTracked = false;

  const trackUse = (source: 'manual' | 'paste' | 'sample'): void => {
    if (useTracked) return;
    useTracked = true;
    track('candidate_check', { source });
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

  const result = document.createElement('div');
  result.className = 'cc-result';
  result.setAttribute('aria-live', 'polite');
  const layout = document.createElement('div');
  layout.className = 'cc-layout';
  const left = document.createElement('div');
  left.append(board);
  const right = document.createElement('div');
  right.append(pad, controls, result);
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
    grid[selected] = value;
    if (value && selected < 80) selected++;
    analyze();
  }

  function analyze(): void {
    candidates = computeCandidates(grid);
    render();
  }

  function render(): void {
    const conflicts = conflictCells(grid);
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
    const empty = grid.filter((value) => value === 0).length;
    if (!empty) return '<p class="cc-ok"><strong>全マスが埋まりました。</strong>重複はありません。完全な正解かはソルバーで確認できます。</p>';
    const mask = candidates[selected];
    const allowed = grid[selected] ? [] : digitsOf(mask);
    const singles = candidates.filter((value) => popcount(value) === 1).length;
    const logic = logicalSolve(grid);
    const first = logic.steps[0];
    const next = first
      ? `${TECH_INFO[first.technique]?.ja ?? first.technique}：${TECH_INFO[first.technique]?.desc(first) ?? '論理手順が見つかりました。'}`
      : '現在の盤面から、対応している手筋による次の一手は見つかりませんでした。入力を確認するか、ソルバーで解の有無を確認してください。';
    const reasons = grid[selected]
      ? `<p>${pos}にはすでに<strong>${grid[selected]}</strong>が入っています。空きマスを選ぶと候補の理由を表示します。</p>`
      : `<p><strong>${pos}の候補：${allowed.length ? allowed.join('・') : 'なし'}</strong></p>${[1,2,3,4,5,6,7,8,9].map((digit) => `<span class="cc-reason ${allowed.includes(digit) ? 'ok' : 'ng'}">${digit}：${allowed.includes(digit) ? '行・列・ブロックに同じ数字なし' : blockedReason(selected, digit)}</span>`).join('')}`;
    return `${reasons}<p class="cc-summary">空き${empty}マス ／ 候補が1つのマス${singles}個</p><p><strong>現在の次の一手</strong><br>${next}</p><p><a href="/tools/solver/?grid=${grid.map((v) => v || '.').join('')}">この盤面の唯一解と全手順をソルバーで確認</a></p>`;
  }

  function blockedReason(cell: number, digit: number): string {
    const blocker = PEERS[cell].find((peer) => grid[peer] === digit);
    if (blocker === undefined) return '候補に残せます';
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
