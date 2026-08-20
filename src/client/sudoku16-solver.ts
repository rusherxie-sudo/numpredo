const SIZE = 16;
const CELL_COUNT = SIZE * SIZE;
const FULL_MASK = (1 << SIZE) - 1;
const SYMBOLS = '123456789ABCDEFG';
const SEARCH_LIMIT = 1_200_000;

type SolveOutcome = {
  count: number;
  solution?: Uint8Array;
  aborted: boolean;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function boxIndex(row: number, col: number): number {
  return Math.floor(row / 4) * 4 + Math.floor(col / 4);
}

function bitToValue(bit: number): number {
  return 32 - Math.clz32(bit);
}

function bitCount(value: number): number {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function solve16(input: Uint8Array, limit = 2): SolveOutcome {
  const board = input.slice();
  const rowMask = new Uint32Array(SIZE);
  const colMask = new Uint32Array(SIZE);
  const boxMask = new Uint32Array(SIZE);
  let count = 0;
  let first: Uint8Array | undefined;
  let nodes = 0;
  let aborted = false;

  for (let index = 0; index < CELL_COUNT; index++) {
    const value = board[index];
    if (!value) continue;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const box = boxIndex(row, col);
    const bit = 1 << (value - 1);
    if ((rowMask[row] | colMask[col] | boxMask[box]) & bit) return { count: 0, aborted: false };
    rowMask[row] |= bit;
    colMask[col] |= bit;
    boxMask[box] |= bit;
  }

  const search = (): void => {
    if (count >= limit || aborted) return;
    if (++nodes > SEARCH_LIMIT) {
      aborted = true;
      return;
    }

    let target = -1;
    let candidates = 0;
    let bestCount = SIZE + 1;
    for (let index = 0; index < CELL_COUNT; index++) {
      if (board[index]) continue;
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const box = boxIndex(row, col);
      const mask = FULL_MASK & ~(rowMask[row] | colMask[col] | boxMask[box]);
      const candidateCount = bitCount(mask);
      if (candidateCount === 0) return;
      if (candidateCount < bestCount) {
        target = index;
        candidates = mask;
        bestCount = candidateCount;
        if (candidateCount === 1) break;
      }
    }

    if (target === -1) {
      count++;
      if (!first) first = board.slice();
      return;
    }

    const row = Math.floor(target / SIZE);
    const col = target % SIZE;
    const box = boxIndex(row, col);
    while (candidates && count < limit && !aborted) {
      const bit = candidates & -candidates;
      candidates ^= bit;
      board[target] = bitToValue(bit);
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[box] |= bit;
      search();
      rowMask[row] ^= bit;
      colMask[col] ^= bit;
      boxMask[box] ^= bit;
      board[target] = 0;
    }
  };

  search();
  return { count, solution: first, aborted };
}

function examplePuzzle(): Uint8Array {
  const values = new Uint8Array(CELL_COUNT);
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = ((row * 4 + Math.floor(row / 4) + col) % SIZE) + 1;
      // 每行保留 12 个提示。删格位置按行错开，既便于演示，也避免整列同时变空。
      if ((col + row * 3) % 4 !== 0) values[row * SIZE + col] = value;
    }
  }
  return values;
}

document.querySelectorAll<HTMLElement>('[data-s16]').forEach((root) => {
  const cells = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cell]'));
  const message = root.querySelector<HTMLElement>('[data-message]');
  const bulk = root.querySelector<HTMLTextAreaElement>('[data-bulk]');
  let values = new Uint8Array(CELL_COUNT);
  let original = new Uint8Array(CELL_COUNT);
  let selected = 0;
  let showingSolution = false;

  const track = (name: string, params: Record<string, unknown> = {}) => window.gtag?.('event', name, params);
  const setMessage = (text: string, state: '' | 'ok' | 'error' = '') => {
    if (!message) return;
    message.textContent = text;
    message.dataset.state = state;
  };
  const render = () => {
    cells.forEach((cell, index) => {
      const value = values[index];
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const selectedRow = Math.floor(selected / SIZE);
      const selectedCol = selected % SIZE;
      const peer = row === selectedRow || col === selectedCol || boxIndex(row, col) === boxIndex(selectedRow, selectedCol);
      cell.textContent = value ? SYMBOLS[value - 1] : '';
      cell.classList.toggle('s16-selected', index === selected);
      cell.classList.toggle('s16-peer', peer && index !== selected);
      cell.classList.toggle('s16-solved', showingSolution && !original[index] && Boolean(value));
      cell.classList.remove('s16-error');
      cell.setAttribute('aria-label', `${row + 1}行${col + 1}列、${value ? SYMBOLS[value - 1] : '空欄'}`);
    });
  };
  const setSelectedValue = (value: number) => {
    values[selected] = value;
    original[selected] = value;
    showingSolution = false;
    render();
  };

  cells.forEach((cell, index) => cell.addEventListener('click', () => {
    selected = index;
    render();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-symbol]').forEach((button) => button.addEventListener('click', () => {
    const value = SYMBOLS.indexOf(button.dataset.symbol ?? '') + 1;
    if (value > 0) setSelectedValue(value);
  }));
  root.querySelector('[data-delete]')?.addEventListener('click', () => setSelectedValue(0));

  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    values = new Uint8Array(CELL_COUNT);
    original = new Uint8Array(CELL_COUNT);
    showingSolution = false;
    setMessage('盤面を消去しました。');
    render();
  });

  root.querySelector('[data-example]')?.addEventListener('click', () => {
    values = new Uint8Array(examplePuzzle());
    original = values.slice();
    showingSolution = false;
    setMessage('例題を入力しました。「自動解答」で答えを確認できます。', 'ok');
    track('solver16_example');
    render();
  });

  root.querySelector('[data-import]')?.addEventListener('click', () => {
    const parsed = (bulk?.value.toUpperCase() ?? '').match(/[1-9A-G.0*]/g) ?? [];
    if (parsed.length !== CELL_COUNT) {
      setMessage(`読み取れた記号は${parsed.length}個です。空きマスを含めて256個にしてください。`, 'error');
      return;
    }
    values = Uint8Array.from(parsed, (symbol) => {
      const index = SYMBOLS.indexOf(symbol);
      return index >= 0 ? index + 1 : 0;
    });
    original = values.slice();
    showingSolution = false;
    setMessage('一括入力を盤面へ反映しました。', 'ok');
    track('solver16_import');
    render();
  });

  root.querySelector('[data-solve]')?.addEventListener('click', () => {
    const givens = values.reduce((sum, value) => sum + Number(Boolean(value)), 0);
    if (givens < 32) {
      setMessage(`現在の入力は${givens}マスです。計算が極端に長くならないよう、少なくとも32マス入力してください。`, 'error');
      return;
    }
    setMessage('答えを計算しています…');
    window.setTimeout(() => {
      const result = solve16(values, 2);
      if (!result.solution) {
        setMessage(result.aborted ? '探索量が上限を超えました。入力漏れや誤りがないか確認してください。' : 'この盤面には答えがありません。行・列・4×4ブロックの重複を確認してください。', 'error');
        track('solver16_solve', { result: result.aborted ? 'aborted' : 'none', givens });
        return;
      }
      values = new Uint8Array(result.solution);
      showingSolution = true;
      const status = result.aborted ? '答えの一例を表示しました（探索上限のため唯一解判定は未完了です）。' : result.count > 1 ? '答えの一例を表示しました。この問題には複数の答えがあります。' : '自動解答が完了しました。答えは一つです。';
      setMessage(status, result.count === 1 && !result.aborted ? 'ok' : '');
      track('solver16_solve', { result: result.aborted ? 'aborted' : result.count > 1 ? 'multiple' : 'unique', givens });
      render();
    }, 20);
  });

  root.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    const key = event.key.toUpperCase();
    const value = SYMBOLS.indexOf(key) + 1;
    if (value > 0) {
      event.preventDefault();
      setSelectedValue(value);
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      setSelectedValue(0);
      return;
    }
    const row = Math.floor(selected / SIZE);
    const col = selected % SIZE;
    if (event.key === 'ArrowUp' && row > 0) selected -= SIZE;
    else if (event.key === 'ArrowDown' && row < SIZE - 1) selected += SIZE;
    else if (event.key === 'ArrowLeft' && col > 0) selected--;
    else if (event.key === 'ArrowRight' && col < SIZE - 1) selected++;
    else return;
    event.preventDefault();
    cells[selected]?.focus();
    render();
  });

  const queryGrid = new URLSearchParams(location.search).get('grid');
  if (queryGrid && queryGrid.length === CELL_COUNT) {
    const parsed = queryGrid.toUpperCase().match(/[1-9A-G.0*]/g) ?? [];
    if (parsed.length === CELL_COUNT) {
      values = Uint8Array.from(parsed, (symbol) => Math.max(0, SYMBOLS.indexOf(symbol) + 1));
      original = values.slice();
    }
  }
  render();
});

export { solve16 };
