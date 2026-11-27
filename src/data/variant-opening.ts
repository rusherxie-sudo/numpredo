import type { VariantPuzzle } from '../engine/variant-grid.ts';
import { decodeVariant, variantSymbol } from '../engine/variant-symbols.ts';

export function explainOpening(puzzle: VariantPuzzle, size: number, blockRows: number, blockCols: number, row: number, column: number) {
  const grid = decodeVariant(puzzle.puzzle);
  const cell = (row - 1) * size + column - 1;
  const rowValues = grid.slice((row - 1) * size, row * size);
  const columnValues = grid.filter((_, index) => index % size === column - 1);
  const blockTop = Math.floor((row - 1) / blockRows) * blockRows;
  const blockLeft = Math.floor((column - 1) / blockCols) * blockCols;
  const blockValues = Array.from({ length: blockRows }, (_, offset) => {
    const start = (blockTop + offset) * size + blockLeft;
    return grid.slice(start, start + blockCols);
  }).flat();

  const rowMissing = Array.from({ length: size }, (_, index) => index + 1).filter(digit => !rowValues.includes(digit));
  const columnBlocked = rowMissing.filter(digit => columnValues.includes(digit));
  const afterColumn = rowMissing.filter(digit => !columnValues.includes(digit));
  const blockBlocked = afterColumn.filter(digit => blockValues.includes(digit));
  const answer = afterColumn.filter(digit => !blockValues.includes(digit));
  if (grid[cell] !== 0 || !columnBlocked.length || !blockBlocked.length || answer.length !== 1 || variantSymbol(answer[0]) !== puzzle.solution[cell]) {
    throw new Error(`Invalid opening example for ${puzzle.id} at ${row},${column}`);
  }

  const symbols = (values: number[]) => values.map(variantSymbol).join('・');
  return { row, column, cell, rowMissing: symbols(rowMissing), columnBlocked: symbols(columnBlocked), blockBlocked: symbols(blockBlocked), answer: variantSymbol(answer[0]) };
}
