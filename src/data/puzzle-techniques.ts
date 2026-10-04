// Engine identifiers shared by the library filters and build-time analysis.
export const PUZZLE_TECHNIQUES = [
  { key: 'nakedSingle', slug: 'naked-single', name: '裸の単数' },
  { key: 'hiddenSingle', slug: 'hidden-single', name: '隠れた単数' },
  { key: 'lockedCandidates', slug: 'pointing', name: '区画の絞り込み' },
  { key: 'nakedPair', slug: 'naked-pair', name: 'ネイキッドペア（二国同盟）' },
  { key: 'hiddenPair', slug: 'hidden-pair', name: '隠れたペア' },
  { key: 'nakedTriple', slug: 'naked-triple', name: '三国同盟' },
  { key: 'skyscraper', slug: 'skyscraper', name: 'スカイスクレイパー' },
  { key: 'xWing', slug: 'x-wing', name: 'X-Wing' },
  { key: 'swordfish', slug: 'swordfish', name: 'スワードフィッシュ' },
] as const;
export interface LibraryPuzzle { n: number; clues: number; steps: number; hardest: string; techniques: string[] }
export type LibraryProgress = Record<string, 'started' | 'done'>;
