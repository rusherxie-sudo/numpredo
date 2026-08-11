type Level = 'beginner' | 'intermediate' | 'advanced' | 'hard' | 'extreme';
type SeedPuzzle = { puzzle: string; solution: string; clues: number };
type Pools = Record<Level, SeedPuzzle[]>;

const LEVEL_LABEL: Record<Level, string> = {
  beginner: '初級', intermediate: '中級', advanced: '上級', hard: '難問', extreme: '超難問',
};

const dataEl = document.getElementById('pg-data');
if (dataEl) {
  const pools = JSON.parse(dataEl.textContent || '{}') as Pools;
  const board = document.getElementById('pg-board')!;
  const solutionBoard = document.getElementById('pg-solution')!;
  const solutionWrap = document.getElementById('pg-solution-wrap')!;
  const levelLabel = document.getElementById('pg-level-label')!;
  const cluesLabel = document.getElementById('pg-clues')!;
  const status = document.getElementById('pg-status')!;
  const levelButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-pg-level]'));
  const levels = Object.keys(LEVEL_LABEL) as Level[];

  const params = new URLSearchParams(location.search);
  let level: Level = levels.includes(params.get('level') as Level) ? params.get('level') as Level : 'beginner';
  let seed = Number.parseInt(params.get('seed') || '', 10) >>> 0;
  if (!seed) seed = randomSeed();
  let answerVisible = false;

  function randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  }

  function rngFrom(value: number): () => number {
    let a = value >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled<T>(values: T[], rng: () => number): T[] {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function unitOrder(rng: () => number): number[] {
    return shuffled([0, 1, 2], rng).flatMap((band) =>
      shuffled([0, 1, 2], rng).map((inside) => band * 3 + inside),
    );
  }

  function transform(input: string, rng: () => number): string {
    const digits = shuffled(['1', '2', '3', '4', '5', '6', '7', '8', '9'], rng);
    const rows = unitOrder(rng);
    const cols = unitOrder(rng);
    const transpose = rng() < 0.5;
    let output = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const sourceR = transpose ? rows[c] : rows[r];
        const sourceC = transpose ? cols[r] : cols[c];
        const value = input[sourceR * 9 + sourceC];
        output += value === '.' ? '.' : digits[Number(value) - 1];
      }
    }
    return output;
  }

  function draw(target: HTMLElement, grid: string): void {
    target.replaceChildren(...[...grid].map((value, i) => {
      const cell = document.createElement('span');
      const row = Math.floor(i / 9);
      const col = i % 9;
      cell.className = `pg-cell${value === '.' ? ' pg-empty' : ''}${col === 2 || col === 5 ? ' pg-br' : ''}${row === 2 || row === 5 ? ' pg-bb' : ''}`;
      cell.textContent = value === '.' ? '0' : value;
      return cell;
    }));
  }

  function render(): void {
    const rng = rngFrom(seed);
    const pool = pools[level];
    const source = pool[Math.floor(rng() * pool.length)];
    draw(board, transform(source.puzzle, rng));
    // 解答にも問題と同じ変換を適用するため、同じ乱数列で題の選択分を1回進める。
    const solutionRng = rngFrom(seed);
    solutionRng();
    draw(solutionBoard, transform(source.solution, solutionRng));
    levelLabel.textContent = LEVEL_LABEL[level];
    cluesLabel.textContent = String(source.clues);
    solutionWrap.hidden = !answerVisible;
    levelButtons.forEach((button) => {
      const on = button.dataset.pgLevel === level;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
    const url = new URL(location.href);
    url.searchParams.set('level', level);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  }

  levelButtons.forEach((button) => button.addEventListener('click', () => {
    level = button.dataset.pgLevel as Level;
    seed = randomSeed();
    answerVisible = false;
    status.textContent = '';
    render();
  }));
  document.getElementById('pg-new')?.addEventListener('click', () => {
    seed = randomSeed();
    answerVisible = false;
    status.textContent = '新しい問題を作成しました。';
    render();
  });
  document.getElementById('pg-answer-toggle')?.addEventListener('click', (event) => {
    answerVisible = !answerVisible;
    (event.currentTarget as HTMLButtonElement).textContent = answerVisible ? '解答を隠す' : '解答を表示';
    solutionWrap.hidden = !answerVisible;
  });
  document.getElementById('pg-print')?.addEventListener('click', () => window.print());
  document.getElementById('pg-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      status.textContent = 'この問題のURLをコピーしました。';
    } catch {
      status.textContent = 'アドレスバーのURLをコピーしてください。';
    }
  });
  render();
}
