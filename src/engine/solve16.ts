const SIZE = 16;
const CELL_COUNT = SIZE * SIZE;
const FULL_MASK = (1 << SIZE) - 1;
const SEARCH_LIMIT = 1_200_000;

type SolveOutcome = {
  count: number;
  solution?: Uint8Array;
  aborted: boolean;
};

export function boxIndex(row: number, col: number): number {
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

export function solve16(input: Uint8Array, limit = 2): SolveOutcome {
  if (input.length !== CELL_COUNT || input.some(v => v > SIZE)) return { count: 0, aborted: false };
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
