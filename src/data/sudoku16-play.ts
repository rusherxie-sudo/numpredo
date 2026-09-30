import manifest from '../../public/downloads/variants/manifest.json' with {type:'json'};
export const SUDOKU16_PLAY = manifest.packs.find(p=>p.slug==='16x16')!.puzzles.map(p=>({id:p.id,puzzle:p.puzzle,solution:p.solution}));
