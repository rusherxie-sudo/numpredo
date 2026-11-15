// 只读取已公开的原题；答案主动加载，撤回凭证不进入分享链接。
import { track } from './track.ts';
const app = document.getElementById('public-puzzles');
if (app) void start(app);
async function start(root: HTMLElement): Promise<void> {
  const id = new URLSearchParams(location.search).get('id');
  try {
    if (id) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid id');
      const response = await fetch('/api/public-puzzles/' + encodeURIComponent(id));
      if (!response.ok) throw new Error('unavailable');
      const item = await response.json();
      if (item.status !== 'public' || typeof item.grid !== 'string' || !/^[0-9]{81}$/.test(item.grid)) throw new Error('invalid puzzle');
      const puzzle = [...item.grid].map(Number);
      if (!puzzle.some(v => v === 0) || !puzzle.some(v => v !== 0)) throw new Error('invalid puzzle');
      root.replaceChildren();
      const intro = document.createElement('p'); intro.textContent = '投稿問題に挑戦しましょう。最初の数字は変更できません。'; root.append(intro);
      if (Array.isArray(item.sources)) {
        const sources = document.createElement('ul');
        const names: Record<string, string> = { yomiuri: '読売新聞', asahi: '朝日新聞', mainichi: '毎日新聞', nikkei: '日本経済新聞', chunichi: '中日新聞', other: 'その他' };
        for (const source of item.sources) {
          const line = document.createElement('li');
          const text = [names[source.newspaper] ?? '出典未記入', source.publicationDate, source.edition, source.issue].filter(value => typeof value === 'string' && value).join(' / ');
          const doubles = Array.isArray(source.doubleCells) ? source.doubleCells.filter((n: number) => Number.isInteger(n) && n >= 0 && n < 81).map((n: number) => String(Math.floor(n / 9) + 1) + '行' + String(n % 9 + 1) + '列').join('・') : '';
          line.textContent = text + (doubles ? ' / 二重枠: ' + doubles : '') + '（投稿者申告・' + (source.verification === 'verified' ? '確認済み' : source.verification === 'disputed' ? '要確認' : '未確認') + '）';
          const cells = source.doubleCells;
          if (Array.isArray(cells) && cells.length === 2 && cells.every((n: number) => Number.isInteger(n) && n >= 0 && n < 81) && cells[0] !== cells[1]) {
            const show = document.createElement('button'); show.type = 'button'; show.textContent = '二重枠の数字と合計を見る';
            const result = document.createElement('span'); result.setAttribute('role', 'status');
            show.addEventListener('click', async () => {
              show.disabled = true;
              try {
                const { countSolutions, solveOne } = await import('../engine/countSolver.ts');
                if (countSolutions(puzzle, 2) !== 1) throw new Error('not unique');
                const answer = solveOne(puzzle); if (!answer) throw new Error('unsolved');
                revealed = true; result.textContent = ' ' + answer[cells[0]] + ' + ' + answer[cells[1]] + ' = ' + (answer[cells[0]] + answer[cells[1]]) + '（座標は投稿者の申告、数値は当サイトの計算であり公式発表ではありません）';
              } catch { result.textContent = ' 二重枠の数字を計算できませんでした。'; }
              finally { show.disabled = false; }
            }); line.append(' ', show, result);
          }
          sources.append(line);
        } root.append(sources);
      }
      const board = document.createElement('div'); board.className = 'public-board'; board.setAttribute('aria-label', '数独の問題');
      let started = false, completed = false, revealed = false;
      const inputs = puzzle.map((value, i) => {
        const input = document.createElement('input'); input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 1;
        input.setAttribute('aria-label', String(Math.floor(i / 9) + 1) + '行' + String(i % 9 + 1) + '列');
        input.value = value ? String(value) : ''; input.disabled = !!value;
        input.addEventListener('input', () => { input.value = input.value.replace(/[^1-9]/g, ''); if (input.value && !started) { started = true; track('public_challenge_start'); } }); board.append(input); return input;
      }); root.append(board);
      const controls = document.createElement('div'); controls.className = 'public-controls';
      const check = document.createElement('button'); check.textContent = '答えを確認';
      const share = document.createElement('button'); share.textContent = 'この問題のリンクをコピー';
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      check.addEventListener('click', () => {
        const values = inputs.map(input => Number(input.value));
        const valid = (indexes: number[]) => new Set(indexes.map(i => values[i])).size === 9 && indexes.every(i => values[i] >= 1 && values[i] <= 9);
        const groups = Array.from({ length: 9 }, (_, n) => [Array.from({ length: 9 }, (_, i) => n * 9 + i), Array.from({ length: 9 }, (_, i) => i * 9 + n), Array.from({ length: 9 }, (_, i) => (Math.floor(n / 3) * 3 + Math.floor(i / 3)) * 9 + n % 3 * 3 + i % 3)]).flat();
        const correct = groups.every(valid);
        status.textContent = correct ? '正解です！' : 'まだ完成していないか、異なる数字があります。';
        if (correct && started && !revealed && !completed) { completed = true; track('public_challenge_complete'); }
      });
      share.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname + '?id=' + encodeURIComponent(id)); track('public_share'); status.textContent = 'リンクをコピーしました。'; } catch { status.textContent = 'コピーできませんでした。アドレス欄のURLを共有してください。'; } });
      const reveal = document.createElement('button'); reveal.textContent = '答えを表示する';
      const solution = document.createElement('p'); solution.hidden = true; solution.setAttribute('aria-label', '解答');
      reveal.addEventListener('click', async () => {
        reveal.disabled = true;
        try { const { solveOne } = await import('../engine/countSolver.ts'); const answer = solveOne(puzzle); if (!answer) throw new Error('invalid puzzle'); solution.textContent = Array.from({ length: 9 }, (_, r) => answer.slice(r * 9, r * 9 + 9).join(' ')).join(' / '); solution.hidden = !solution.hidden; if (!solution.hidden) revealed = true; reveal.textContent = solution.hidden ? '答えを表示する' : '答えを隠す'; }
        catch { status.textContent = '解答を読み込めませんでした。'; } finally { reveal.disabled = false; }
      }); controls.append(check, reveal, share); root.append(controls, status, solution);
      const steps = document.createElement('p');
      const solveLink = document.createElement('a'); solveLink.href = '/tools/solver/#' + new URLSearchParams({ grid: item.grid }).toString(); solveLink.textContent = 'この問題をソルバーで解き、手順を見る →';
      solveLink.addEventListener('click', () => { revealed = true; });
      const guide = document.createElement('a'); guide.href = '/guide/how-to-solve/'; guide.textContent = '数独の解き方・テクニック一覧 →';
      steps.append(solveLink, ' ／ ', guide); root.append(steps);
      const back = document.createElement('a'); back.href = '/public-puzzles/'; back.textContent = '投稿問題一覧へ'; root.append(back);
    } else {
      root.replaceChildren(); const list = document.createElement('ul'); root.append(list);
      const more = document.createElement('button'); more.textContent = 'もっと見る'; more.hidden = true; root.append(more);
      let cursor: string | null = null;
      const load = async (): Promise<void> => {
        more.disabled = true;
        const query = cursor ? '?' + new URLSearchParams({ cursor }).toString() : '';
        const response = await fetch('/api/public-puzzles' + query); if (!response.ok) throw new Error('unavailable');
        const data = await response.json(); if (!Array.isArray(data.items)) throw new Error('invalid response');
        for (const item of data.items) {
          if (item.status !== 'public' || typeof item.id !== 'string' || !/^[a-f0-9]{64}$/.test(item.id)) continue;
          const li = document.createElement('li'); const a = document.createElement('a'); a.href = '/public-puzzles/?id=' + encodeURIComponent(item.id);
          a.textContent = '投稿問題 ' + (typeof item.createdAt === 'string' ? item.createdAt.slice(0, 10) + ' · ' : '') + item.id.slice(0, 8); li.append(a); list.append(li);
        }
        cursor = typeof data.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null;
        more.hidden = !cursor; more.disabled = false;
        if (!list.children.length) { const empty = document.createElement('p'); empty.textContent = '公開中の問題はまだありません。'; root.prepend(empty); }
      };
      more.addEventListener('click', () => { void load().catch(() => { more.disabled = false; more.textContent = '読み込めませんでした。再試行'; }); }); await load();
    }
  } catch { root.textContent = '問題を読み込めませんでした。時間をおいて再度お試しください。'; }
}
