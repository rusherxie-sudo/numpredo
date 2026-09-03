export interface Mini4Puzzle {
  id: number;
  level: 'やさしい' | 'ふつう' | 'むずかしい';
  puzzle: string;
  solution: string;
  clues: number;
}

// 固定小题库：离线穷举确认每题唯一解。按提示数分三档，顺序不可随意重排，
// 浏览器会用 id 保存每道题的进度。
export const MINI4_PUZZLES: Mini4Puzzle[] = [
  { id: 1, level: 'やさしい', puzzle: '.3.21...2431..2.', solution: '4312124324313124', clues: 8 },
  { id: 2, level: 'やさしい', puzzle: '..31.3..3..4.123', solution: '2431134232144123', clues: 8 },
  { id: 3, level: 'やさしい', puzzle: '4..1.1..14.2..14', solution: '4321214314323214', clues: 8 },
  { id: 4, level: 'やさしい', puzzle: '421......4.12.34', solution: '4213134234212134', clues: 8 },
  { id: 5, level: 'ふつう', puzzle: '24.....4.13.3...', solution: '2413132441323241', clues: 6 },
  { id: 6, level: 'ふつう', puzzle: '.1..4...14.3...1', solution: '2134431214233241', clues: 6 },
  { id: 7, level: 'ふつう', puzzle: '3..112..41......', solution: '3421124341322314', clues: 6 },
  { id: 8, level: 'ふつう', puzzle: '.32.....4..23.4.', solution: '1324241341323241', clues: 6 },
  { id: 9, level: 'むずかしい', puzzle: '...1..42....3.1.', solution: '2431134241233214', clues: 5 },
  { id: 10, level: 'むずかしい', puzzle: '.3.2....3..4..2.', solution: '1342243132144123', clues: 5 },
  { id: 11, level: 'むずかしい', puzzle: '4...32....3....2', solution: '4123321424311342', clues: 5 },
  { id: 12, level: 'むずかしい', puzzle: '2..4........4.31', solution: '2314142331424231', clues: 5 },
];
