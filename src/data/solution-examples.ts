import { countSolutions, gridFromString, computeCandidates, PEERS, UNITS } from '../engine/index.ts';

// 本站初級No.1の自作題庫から作った診断用の例。市販・新聞の盤面は使用しない。
export const ORIGINAL_PUZZLE = '200700800170258430060943700050000080600302009090000010001627050085419062006005007';
export const ORIGINAL_SOLUTION = '243761895179258436568943721357196284614382579892574613431627958785419362926835147';
export const MULTIPLE_PUZZLE = '240761805170258406568943721357196284614382579892574613431627958785419362926835147';
export const ALTERNATE_SOLUTION = '249761835173258496568943721357196284614382579892574613431627958785419362926835147';
export const UNIQUE_PUZZLE = '243761805170258406568943721357196284614382579892574613431627958785419362926835147';
export const CHANGED_CELLS = [2, 7, 11, 16] as const;

export const INPUT_DIAGNOSES = [
  {
    id: 'duplicate',
    title: '同じ行に数字の重複がある',
    grid: '220700800170258430060943700050000080600302009090000010001627050085419062006005007',
    marked: [0, 1],
    placedCell: 1,
    digit: 2,
    explanation: '初級No.1の1行2列へ2を入れると、もともと1行1列にある2と重なります。同じ行に2が二つあるため、この状態から完成させることはできません。',
    next: 'この例で後から入れた1行2列の2を消し、元の問題と照合します。実際の盤面でも、最初からある数字と自分が書いた数字を分けて確認しましょう。',
    tool: '/tools/candidate-checker/',
    toolLabel: '重複のある盤面をチェッカーで確認',
  },
  {
    id: 'no-candidates',
    title: '重複はないが、候補が0個のマスができた',
    grid: '209700800170258430060943700050000080600302009090000010001627050085419062006005007',
    marked: [2, 7],
    placedCell: 2,
    digit: 9,
    explanation: '1行3列の空欄へ9を入れても、その場では重複しません。しかし1行8列などで、行・列・ブロックの制約を満たす数字が一つも残らなくなります。',
    next: '1行8列の候補をチェッカーで調べ、候補0の原因を確認します。この例では追加した9を戻せば元の唯一解の問題に戻ります。実際の問題では、候補0になったマス自体が間違いの場所とは限りません。',
    tool: '/tools/candidate-checker/',
    toolLabel: '1行8列の候補が0になる理由を確認',
  },
  {
    id: 'global-contradiction',
    title: '各マスに候補は残るが、全体として解がない',
    grid: '230700800170258430060943700050000080600302009090000010001627050085419062006005007',
    marked: [1],
    placedCell: 1,
    digit: 3,
    explanation: '1行2列へ3を入れた直後には重複がなく、すべての空きマスに候補が残っています。それでも、盤面全体の条件を同時に満たす完成形は0個です。「いま重複しない」と「正しい答え」は同じではありません。',
    next: '完成形の有無はソルバーで確認します。この例の元の問題は唯一解で、1行2列の答えは4です。3は後から加えた数字なので、元に戻して続きを考えます。一般の盤面でソルバーが解なしと表示しても、どの一手を消せばよいかまで自動的に特定できるわけではありません。',
    tool: '/tools/solver/',
    toolLabel: '重複なしでも解なしになる例をソルバーで確認',
  },
] as const;

const fail = (message: string): never => { throw new Error(`診断例の検証失敗：${message}`); };
const accepts = (puzzle: string, solution: string): boolean =>
  [...puzzle].every((value, cell) => value === '0' || value === solution[cell]);
const complete = (solution: string): boolean =>
  /^[1-9]{81}$/.test(solution) && UNITS.every(unit => new Set(unit.map(cell => solution[cell])).size === 9);

// 本文で示す条件が崩れたら構築を止める。上限3で「ちょうど2解」まで検証する。
if (!complete(ORIGINAL_SOLUTION) || !complete(ALTERNATE_SOLUTION)) fail('完成形の27単位');
if (!accepts(ORIGINAL_PUZZLE, ORIGINAL_SOLUTION) || countSolutions(gridFromString(ORIGINAL_PUZZLE), 2) !== 1) fail('元の問題');
if (!accepts(MULTIPLE_PUZZLE, ORIGINAL_SOLUTION) || !accepts(MULTIPLE_PUZZLE, ALTERNATE_SOLUTION)) fail('二つの完成形と提示数字');
if (ORIGINAL_SOLUTION.localeCompare(ALTERNATE_SOLUTION) === 0 || countSolutions(gridFromString(MULTIPLE_PUZZLE), 3) !== 2) fail('ちょうど二つの解');
if (countSolutions(gridFromString(UNIQUE_PUZZLE), 2) !== 1) fail('提示を一つ戻した唯一解');
for (const example of INPUT_DIAGNOSES) {
  const grid = gridFromString(example.grid);
  const duplicates = grid.some((digit, cell) => digit > 0 && PEERS[cell].some(peer => grid[peer] === digit));
  const candidates = computeCandidates(grid);
  const zeros = grid.some((digit, cell) => digit === 0 && candidates[cell] === 0);
  const differences = [...example.grid].filter((digit, cell) => digit !== ORIGINAL_PUZZLE[cell]).length;
  if (differences !== 1 || ORIGINAL_PUZZLE[example.placedCell] !== '0' || grid[example.placedCell] !== example.digit) fail(`${example.id}：変更箇所`);
  if (countSolutions(grid, 2) !== 0) fail(`${example.id}：解なし`);
  if (duplicates !== (example.id === 'duplicate')) fail(`${example.id}：重複の有無`);
  if (example.id === 'no-candidates' && (duplicates || !zeros || candidates[7] !== 0)) fail('候補0の例');
  if (example.id === 'global-contradiction' && (duplicates || zeros)) fail('局所的な候補はある全体矛盾');
}

export const exampleToolHref = (path: string, grid: string): string =>
  `${path}#${new URLSearchParams({ grid }).toString()}`;
