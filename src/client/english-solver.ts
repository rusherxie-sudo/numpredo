import { peersFor } from '../engine/variant-grid.ts';
import { track } from './track.ts';
import type { SolverResult } from './english-solver-worker.ts';

const techniques: Record<string, [string, string]> = {
  nakedSingle: ['Naked single', 'Only one candidate remains in this square.'],
  hiddenSingle: ['Hidden single', 'This is the only place for the digit in a row, column, or box.'],
  lockedCandidates: ['Locked candidates', 'The digit is confined to the overlap between a line and a box.'],
  nakedPair: ['Naked pair', 'Two squares in a unit use the same two candidates, reserving those digits.'],
  hiddenPair: ['Hidden pair', 'Two digits each occur in just the same two squares in a unit.'],
  nakedTriple: ['Naked triple', 'Three squares in a unit share a pool of only three candidates.'],
  xWing: ['X-Wing', 'The only positions for a digit in two parallel lines align in two crossing lines.'],
  swordfish: ['Swordfish', 'The positions for a digit across three parallel lines lie in just three crossing lines.'],
  skyscraper: ['Skyscraper', 'Two candidate pairs share an aligned end. At least one of their other ends must contain the digit.'],
};

document.querySelectorAll<HTMLElement>('[data-english-solver]').forEach(root => {
  const size = Number(root.dataset.size);
  const block = Math.sqrt(size);
  const peers = peersFor(size, block, block);
  const symbols = '123456789ABCDEFG'.slice(0, size);
  const fields = Array.from(root.querySelectorAll<HTMLInputElement>('input'));
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const result = root.querySelector<HTMLElement>('[data-result]')!;
  const solveButton = root.querySelector<HTMLButtonElement>('[data-solve]')!;
  const stepsPanel = root.querySelector<HTMLDetailsElement>('[data-steps]');
  let worker: Worker | undefined;
  let timeout: number | undefined;

  function stop() {
    worker?.terminate();
    worker = undefined;
    window.clearTimeout(timeout);
    solveButton.disabled = false;
  }

  function resetResult(message = '') {
    stop();
    status.textContent = message;
    result.hidden = true;
    if (stepsPanel) stepsPanel.open = false;
    fields.forEach(field => field.removeAttribute('aria-invalid'));
  }

  function loadPuzzle(raw: string) {
    const compact = raw.toUpperCase().replace(/[\s,|+\-]/g, '');
    if (compact.length !== size * size || !new RegExp(`^[${symbols}.0*]+$`).test(compact)) {
      status.textContent = `Enter exactly ${size * size} cells using ${size === 9 ? '1–9' : '1–9 and A–G'}, with a dot or zero for every blank.`;
      return;
    }
    resetResult('Puzzle loaded. Select Solve when ready.');
    fields.forEach((field, index) => { field.value = symbols.includes(compact[index]) ? compact[index] : ''; });
  }

  const coordinate = (cell: number) => `row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}`;
  function showResult(answer: SolverResult) {
    if (!answer.solution) {
      return answer.limited ? 'The search reached its limit. Check the givens and try again.' : 'No solution fits these givens. Check the puzzle for a missing or mistyped symbol.';
    }
    const rows = Array.from({ length: size }, (_, row) => answer.solution!.slice(row * size, (row + 1) * size)
      .map((digit, col) => `${col > 0 && col % block === 0 ? ' ' : ''}${symbols[digit - 1]}`).join(' '));
    root.querySelector('[data-grid]')!.textContent = rows.join('\n');
    if (stepsPanel) {
      const steps = answer.logical?.steps ?? [];
      stepsPanel.hidden = !steps.length;
      stepsPanel.querySelector('[data-steps-note]')!.textContent = answer.logical?.solved
        ? 'These deductions complete the puzzle in the order shown.'
        : 'These deductions cover the opening. The solver used search to finish the grid.';
      const items = steps.map(step => {
        const item = document.createElement('li');
        const [name, explanation] = techniques[step.technique] ?? ['Deduction', ''];
        const change = step.cell !== undefined
          ? `Place ${step.digit} in ${coordinate(step.cell)}.`
          : `Remove ${step.eliminations?.map(([cell, digit]) => `${digit} from ${coordinate(cell)}`).join('; ')}.`;
        item.textContent = `${name}. ${change} ${explanation}`;
        return item;
      });
      stepsPanel.querySelector('ol')!.replaceChildren(...items);
      stepsPanel.querySelector('summary')!.textContent = `Show ${steps.length} logical steps`;
    }
    result.hidden = false;
    if (answer.count > 1) return 'Multiple solutions fit these givens. One valid completion is shown.';
    if (answer.limited) return 'One valid completion is shown. The search reached its limit before confirming uniqueness.';
    if (size === 9 && !answer.logical?.steps.length && !answer.logical?.solved) {
      return 'Unique solution found using search. No logical steps were found using the supported techniques.';
    }
    return 'Unique solution found.';
  }

  let activeField = fields[0];
  fields.forEach((field, cell) => {
    field.addEventListener('focus', () => {
      activeField.tabIndex = -1;
      activeField = field;
      field.tabIndex = 0;
      field.select();
    });
    field.addEventListener('input', () => {
      const symbol = field.value.toUpperCase();
      const valid = symbol === '' || symbols.includes(symbol);
      resetResult(valid ? '' : `Use ${size === 9 ? 'digits 1–9' : 'symbols 1–9 and A–G'}.`);
      field.value = valid ? symbol : '';
    });
    field.addEventListener('keydown', event => {
      const offsets: Record<string, number> = { ArrowUp: -size, ArrowDown: size, ArrowLeft: -1, ArrowRight: 1 };
      if (!Object.hasOwn(offsets, event.key)) return;
      const next = fields[cell + offsets[event.key]];
      if (next) { event.preventDefault(); next.focus(); }
    });
  });
  root.querySelector('[data-import]')!.addEventListener('click', () => loadPuzzle(textarea.value));
  root.querySelector('[data-example]')!.addEventListener('click', () => loadPuzzle(root.dataset.sample!));
  root.querySelector('[data-clear]')!.addEventListener('click', () => {
    resetResult('Input cleared.');
    textarea.value = '';
    fields.forEach(field => { field.value = ''; });
  });
  solveButton.addEventListener('click', () => {
    resetResult();
    const grid = fields.map(field => symbols.indexOf(field.value || ' ') + 1);
    const conflicts = grid.map((digit, cell) => Boolean(digit) && peers[cell].some(peer => grid[peer] === digit));
    if (conflicts.some(Boolean)) {
      conflicts.forEach((conflict, cell) => { if (conflict) fields[cell].setAttribute('aria-invalid', 'true'); });
      status.textContent = 'The highlighted symbols repeat in a row, column, or box. Fix the duplicates before solving.';
      return;
    }
    const givens = grid.filter(Boolean).length;
    if (givens < (size === 16 ? 32 : 1)) {
      status.textContent = size === 16 ? 'Enter at least 32 given symbols before solving.' : 'Enter at least one given digit, or load the example.';
      return;
    }
    solveButton.disabled = true;
    status.textContent = 'Solving…';
    const fail = (message: string) => { stop(); status.textContent = message; };
    try {
      worker = new Worker(new URL('./english-solver-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }: MessageEvent<SolverResult>) => {
        stop();
        status.textContent = showResult(data);
        track('english_sudoku_solve', { board_size: size, outcome: data.count > 1 ? 'multiple' : data.limited ? 'limit' : data.solution ? 'unique' : 'no_solution' });
      };
      worker.onerror = () => fail('The solver could not load. Refresh the page and try again.');
      timeout = window.setTimeout(() => fail('The search took too long. Check the givens and try again.'), 8000);
      worker.postMessage({ size, grid });
    } catch {
      fail('The solver could not start. Refresh the page and try again.');
    }
  });
});
