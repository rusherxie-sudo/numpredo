import type { CaseSpec } from './teaching-cases.ts';

export const lockedDirectionCases: CaseSpec[] = [
  { level: 'intermediate', number: 1, technique: 'lockedCandidates', heading: '列からブロックへ：同じ列に限られる候補', question: '5列目の2が入る場所はどのブロックにありますか。そのブロック内で列の外から消せる候補を探してください。' },
  { level: 'advanced', number: 14, technique: 'lockedCandidates', heading: 'ブロックから行へ：同じ行に限られる候補', question: 'ブロック8の5が入る場所は何行目ですか。その行のブロック外から消せる候補を探してください。上級問題の途中盤面から、中級でも使う一手を取り出しました。' },
];
