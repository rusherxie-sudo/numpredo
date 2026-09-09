import { countSolutions } from '../src/engine/countSolver.ts';
import { INEQUALITY_EXAMPLE } from '../src/data/inequality-example.ts';

const { puzzle, solution, horizontal, vertical } = INEQUALITY_EXAMPLE;
const digits = (text: string) => [...text].map(Number);
const answer = digits(solution);
if (puzzle.length !== 81 || solution.length !== 81 || countSolutions(digits(puzzle), 2) !== 1) throw new Error('例題は通常数独として唯一解ではありません');
for (let i = 0; i < 81; i++) if (puzzle[i] !== '0' && puzzle[i] !== solution[i]) throw new Error(`題面ヒント ${i} が解答と不一致です`);
for (const [a, b, sign] of [...horizontal, ...vertical]) {
  const valid = sign === '<' ? answer[a] < answer[b] : answer[a] > answer[b];
  if (!valid) throw new Error(`不等号 ${a}${sign}${b} が解答と不一致です`);
}
console.log(`不等号例題 OK：標準唯一解、ヒント一致、不等号 ${horizontal.length + vertical.length} 本を検証`);
