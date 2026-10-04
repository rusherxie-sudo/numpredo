import { PUZZLE_TECHNIQUES, type LibraryPuzzle } from '../data/puzzle-techniques.ts';
import { readLibraryProgress } from './puzzle-progress.ts';
import { track } from './track.ts';
for (const root of Array.from(document.querySelectorAll<HTMLElement>('[data-library]'))) {
  const level = root.dataset.library!;
  const rows: LibraryPuzzle[] = JSON.parse(root.dataset.rows!);
  const tech = root.querySelector<HTMLSelectElement>('[data-library-tech]')!;
  const status = root.querySelector<HTMLSelectElement>('[data-library-status]')!;
  const list = root.querySelector<HTMLUListElement>('[data-library-list]')!;
  const summary = root.querySelector<HTMLElement>('[data-library-summary]')!;
  const prev = root.querySelector<HTMLButtonElement>('[data-library-prev]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-library-more]')!;
  let page = 0;
  const preset = new URLSearchParams(location.search).get('tech');
  if (Array.from(tech.options).some(o => o.value === preset)) tech.value = preset!;
  function filtered(): LibraryPuzzle[] {
    const progress = readLibraryProgress(level);
    return rows.filter(r => (!tech.value || r.techniques.includes(tech.value)) && (!status.value || (status.value === 'new' ? !progress[r.n] : progress[r.n] === status.value)));
  }
  function render(): void {
    const progress = readLibraryProgress(level), result = filtered();
    page = Math.min(page, Math.max(0, Math.ceil(result.length / 12) - 1));
    const first = page * 12;
    summary.textContent = `${rows.filter(r => progress[r.n] === 'done').length} / ${rows.length}問クリア。条件に合う問題：${result.length}問${result.length ? `（${first + 1}〜${Math.min(first + 12, result.length)}問目）` : '。手筋や進み具合を変えてください。'}`;
    list.replaceChildren();
    for (const row of result.slice(first, first + 12)) {
      const li = document.createElement('li'), a = document.createElement('a'), detail = document.createElement('span');
      a.href = `?n=${row.n}#level-game`; a.dataset.puzzleNumber = String(row.n);
      a.textContent = `No.${row.n}${progress[row.n] === 'done' ? ' ✓ クリア' : progress[row.n] === 'started' ? ' · 途中' : ''}`;
      detail.textContent = `ヒント${row.clues}個・解説${row.steps}手 · ${PUZZLE_TECHNIQUES.find(t => t.key === row.hardest)?.name ?? ''}`;
      li.append(a, detail); list.append(li);
    }
    prev.disabled = page === 0; more.disabled = first + 12 >= result.length;
  }
  function choose(n: number): void {
    if (!Number.isInteger(n) || n < 1 || n > rows.length) return;
    const game = document.querySelector<HTMLElement>('[data-sudoku][data-collection="1"]');
    if (!game) { location.href = `?n=${n}#level-game`; return; }
    game.dispatchEvent(new CustomEvent('puzzle-select', { detail: n }));
    document.querySelector('#level-game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('library_select', { level, puzzle_number: n, technique: tech.value || 'all' });
  }
  list.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-puzzle-number]');
    if (!a || !(e instanceof MouseEvent) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault(); choose(Number(a.dataset.puzzleNumber));
  });
  root.querySelector<HTMLFormElement>('[data-library-jump]')!.addEventListener('submit', e => { e.preventDefault(); choose(Number(new FormData(e.currentTarget as HTMLFormElement).get('n'))); });
  for (const select of [tech, status]) select.addEventListener('change', () => { page = 0; render(); track('library_filter', { level, technique: tech.value || 'all', progress: status.value || 'all' }); });
  prev.addEventListener('click', () => { page--; render(); });
  more.addEventListener('click', () => { page++; render(); });
  root.querySelector('[data-library-next]')!.addEventListener('click', () => {
    const progress = readLibraryProgress(level), next = filtered().find(r => progress[r.n] !== 'done');
    if (next) choose(next.n); else summary.textContent = 'この条件では未クリアの問題がありません。絞り込み条件を変えてください。';
  });
  window.addEventListener('library-progress', render);
  window.addEventListener('storage', render);
  render();
}
