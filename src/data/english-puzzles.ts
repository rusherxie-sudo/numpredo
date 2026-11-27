import beginner from './puzzles/beginner.json' with { type: 'json' };
import intermediate from './puzzles/intermediate.json' with { type: 'json' };
import advanced from './puzzles/advanced.json' with { type: 'json' };

export const ENGLISH_PUZZLES = [beginner, intermediate, advanced].flatMap(({ level, puzzles }) =>
  puzzles.slice(0, 2).map(({ puzzle, solution }, index) => ({ id: `${level}-${index + 1}`, puzzle, solution })),
);
