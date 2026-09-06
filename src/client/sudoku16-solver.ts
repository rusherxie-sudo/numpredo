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

type SamplePuzzle = {
  id: string;
  label: string;
  clueLabel: string;
  puzzle: string;
  solution: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const SAMPLE_PUZZLES: SamplePuzzle[] = [
  {
    id: 's16-a',
    label: '例題 A｜232 手がかり',
    clueLabel: 'いちばんやさしい',
    puzzle: '..BC2ED1763F5A84D12EBCG948...367A4856F379BGCED21376F8...12DECGB99BCAE3126F7GD458...3CA9B854DG7F676FG5D482E1...CB485DFG76BC9A31E22E37A4..5D8196GF6FG9D185E3274BACB..4372EFG6918D585D1G96FCAB4..3EE37648CAD152BF9GFG9B125..7E68C4A5D129BFGA4C86E73CA..76E3G9FB251D',
    solution: 'G9BC2ED1763F5A84D12EBCG948A5F367A4856F379BGCED21376F85A412DECGB99BCAE3126F7GD45812E3CA9B854DG7F676FG5D482E13A9CB485DFG76BC9A31E22E37A4BC5D8196GF6FG9D185E3274BACBCA4372EFG6918D585D1G96FCAB4723EE37648CAD152BF9GFG9B125D37E68C4A5D129BFGA4C86E73CA4876E3G9FB251D',
  },
  {
    id: 's16-b',
    label: '例題 B｜228 手がかり',
    clueLabel: '軽い練習',
    puzzle: '.9BC2ED1763F5A84D12EBCG94...F367A4856F379BGCED21376F...412DECGB99BCAE3126F7GD4...2E3CA9B854DG7F676FG5D482...A9CB485DFG76BC9A31E22E37...C5D8196GF6FG9D185E3274BA...A4372EFG6918D585D1G96FCA...23EE37648CAD152BF9GFG9B1...37E68C4A5D129BFGA4C86E73...876E3G9FB251D',
    solution: 'G9BC2ED1763F5A84D12EBCG948A5F367A4856F379BGCED21376F85A412DECGB99BCAE3126F7GD45812E3CA9B854DG7F676FG5D482E13A9CB485DFG76BC9A31E22E37A4BC5D8196GF6FG9D185E3274BACBCA4372EFG6918D585D1G96FCAB4723EE37648CAD152BF9GFG9B125D37E68C4A5D129BFGA4C86E73CA4876E3G9FB251D',
  },
  {
    id: 's16-c',
    label: '例題 C｜224 手がかり',
    clueLabel: '標準試験',
    puzzle: 'G9BC2ED1763F5A84D12EBCG....5F367A4856F379BGCED2137....A412DECGB99BCAE3126F7GD....2E3CA9B854DG7F676FG5D48....A9CB485DFG76BC9A31E22E3....C5D8196GF6FG9D185E3274B...CA4372EFG6918D585D1G96FC...723EE37648CAD152BF9GFG9B...D37E68C4A5D129BFGA4C86E7...4876E3G9FB251D',
    solution: 'G9BC2ED1763F5A84D12EBCG948A5F367A4856F379BGCED21376F85A412DECGB99BCAE3126F7GD45812E3CA9B854DG7F676FG5D482E13A9CB485DFG76BC9A31E22E37A4BC5D8196GF6FG9D185E3274BACBCA4372EFG6918D585D1G96FCAB4723EE37648CAD152BF9GFG9B125D37E68C4A5D129BFGA4C86E73CA4876E3G9FB251D',
  },
  {
    id: 's16-d',
    label: '例題 D｜220 手がかり',
    clueLabel: 'やや少なめ',
    puzzle: 'G9BC2ED1763F5A84D12EBC....A5F367A4856F379BGCED213....5A412DECGB99BCAE3126F7G....12E3CA9B854DG7F676FG5D4....3A9CB485DFG76BC9A31E22....4BC5D8196GF6FG9D185E327....BCA4372EFG6918D585D1G96....4723EE37648CAD152BF9GFG....5D37E68C4A5D129BFGA4C86....A4876E3G9FB251D',
    solution: 'G9BC2ED1763F5A84D12EBCG948A5F367A4856F379BGCED21376F85A412DECGB99BCAE3126F7GD45812E3CA9B854DG7F676FG5D482E13A9CB485DFG76BC9A31E22E37A4BC5D8196GF6FG9D185E3274BACBCA4372EFG6918D585D1G96FCAB4723EE37648CAD152BF9GFG9B125D37E68C4A5D129BFGA4C86E73CA4876E3G9FB251D',
  },
  {
    id: 's16-e',
    label: '例題 E｜216 手がかり',
    clueLabel: 'いちばん難しい',
    puzzle: 'G9BC2ED1763F5A84D12E.....8A5F367A4856F379BGCED2.....85A412DECGB99BCAE3126F.....812E3CA9B854DG7F676FG5.....13A9CB485DFG76BC9A31E2....A4BC5D8196GF6FG9D185E32....CBCA4372EFG6918D585D1G9....B4723EE37648CAD152BF9GF....25D37E68C4A5D129BFGA4C8....CA4876E3G9FB251D',
    solution: 'G9BC2ED1763F5A84D12EBCG948A5F367A4856F379BGCED21376F85A412DECGB99BCAE3126F7GD45812E3CA9B854DG7F676FG5D482E13A9CB485DFG76BC9A31E22E37A4BC5D8196GF6FG9D185E3274BACBCA4372EFG6918D585D1G96FCAB4723EE37648CAD152BF9GFG9B125D37E68C4A5D129BFGA4C86E73CA4876E3G9FB251D',
  },
];

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

function parseGrid(text: string): Uint8Array<ArrayBuffer> {
  const symbols = text.toUpperCase().match(/[1-9A-G.0*]/g) ?? [];
  const values = new Uint8Array(symbols.length);
  for (let i = 0; i < symbols.length; i++) {
    const index = SYMBOLS.indexOf(symbols[i]);
    values[i] = index >= 0 ? index + 1 : 0;
  }
  return values;
}

function renderBoard(el: HTMLElement, grid: Uint8Array): void {
  el.innerHTML = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    const cell = document.createElement('div');
    cell.className = ['s16-print-cell', col === 3 || col === 7 || col === 11 ? 'br' : '', row === 3 || row === 7 || row === 11 ? 'bb' : ''].filter(Boolean).join(' ');
    cell.textContent = grid[i] ? SYMBOLS[grid[i] - 1] : '·';
    el.appendChild(cell);
  }
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
      if ((col + row * 3) % 4 !== 0) values[row * SIZE + col] = value;
    }
  }
  return values;
}

document.querySelectorAll<HTMLElement>('[data-s16]').forEach((root) => {
  const cells = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cell]'));
  const message = root.querySelector<HTMLElement>('[data-message]');
  const bulk = root.querySelector<HTMLTextAreaElement>('[data-bulk]');
  const sampleButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-sample-button]'));
  const sampleLabel = root.querySelector<HTMLElement>('[data-sample-label]');
  const printTitle = root.querySelector<HTMLElement>('[data-print-title]');
  const printSubtitle = root.querySelector<HTMLElement>('[data-print-subtitle]');
  const printPuzzle = root.querySelector<HTMLElement>('[data-print-puzzle]');
  const printAnswer = root.querySelector<HTMLElement>('[data-print-answer]');
  let values: Uint8Array<ArrayBufferLike> = new Uint8Array(CELL_COUNT);
  let original: Uint8Array<ArrayBufferLike> = new Uint8Array(CELL_COUNT);
  let selected = 0;
  let showingSolution = false;
  let activeSample = 0;
  let currentSolution = parseGrid(SAMPLE_PUZZLES[0].solution);

  const track = (name: string, params: Record<string, unknown> = {}) => {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.('event', name, params);
  };
  const setMessage = (text: string, state: '' | 'ok' | 'error' = '') => {
    if (!message) return;
    message.textContent = text;
    message.dataset.state = state;
  };

  const syncSampleMeta = () => {
    const sample = SAMPLE_PUZZLES[activeSample];
    if (sampleLabel) sampleLabel.textContent = `${sample.label} を表示中`;
    if (printTitle) printTitle.textContent = sample.label;
    if (printSubtitle) printSubtitle.textContent = sample.clueLabel;
    sampleButtons.forEach((button, index) => button.classList.toggle('is-active', index === activeSample));
  };

  const syncPrintSheet = () => {
    if (printPuzzle) renderBoard(printPuzzle, values);
    if (printAnswer) renderBoard(printAnswer, currentSolution);
  };

  const loadSample = (index: number, announce = true) => {
    const sample = SAMPLE_PUZZLES[index];
    activeSample = index;
    values = parseGrid(sample.puzzle);
    original = values.slice();
    currentSolution = parseGrid(sample.solution);
    showingSolution = false;
    if (announce) setMessage(`${sample.label} を読み込みました。必要なら「自動解答」で答えを確認できます。`, 'ok');
    track('solver16_sample', { sample_id: sample.id, clue_label: sample.clueLabel });
    syncSampleMeta();
    syncPrintSheet();
    render();
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
    syncPrintSheet();
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
    syncPrintSheet();
    render();
  });

  root.querySelector('[data-example]')?.addEventListener('click', () => {
    values = new Uint8Array(examplePuzzle());
    original = values.slice();
    showingSolution = false;
    setMessage('例題を入力しました。「自動解答」で答えを確認できます。', 'ok');
    track('solver16_example');
    syncPrintSheet();
    render();
  });

  sampleButtons.forEach((button, index) => button.addEventListener('click', () => loadSample(index)));

  root.querySelector('[data-reset-sample]')?.addEventListener('click', () => loadSample(0));
  root.querySelector('[data-print-sample]')?.addEventListener('click', () => {
    syncPrintSheet();
    track('solver16_print', { sample_id: SAMPLE_PUZZLES[activeSample].id });
    window.print();
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
    syncPrintSheet();
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
      currentSolution = new Uint8Array(result.solution);
      showingSolution = true;
      const status = result.aborted ? '答えの一例を表示しました（探索上限のため唯一解判定は未完了です）。' : result.count > 1 ? '答えの一例を表示しました。この問題には複数の答えがあります。' : '自動解答が完了しました。答えは一つです。';
      setMessage(status, result.count === 1 && !result.aborted ? 'ok' : '');
      track('solver16_solve', { result: result.aborted ? 'aborted' : result.count > 1 ? 'multiple' : 'unique', givens });
      syncPrintSheet();
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
      showingSolution = false;
    }
  }

  syncSampleMeta();
  syncPrintSheet();
  render();
  loadSample(0, false);
});

export { solve16 };
