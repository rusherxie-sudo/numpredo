// Fixed 6×6 lessons use 2-row × 3-column blocks; never pass them to the 9×9 solver.
export const mini6Peers = Array.from({length:36},(_,i)=>Array.from({length:36},(_,j)=>j).filter(j=>j!==i&&(Math.floor(i/6)===Math.floor(j/6)||i%6===j%6||(Math.floor(i/12)===Math.floor(j/12)&&Math.floor(i%6/3)===Math.floor(j%6/3)))));
export function mini6Candidates(grid: number[], i: number): number[] {
  return grid[i] ? [] : [1,2,3,4,5,6].filter(d=>mini6Peers[i].every(p=>grid[p]!==d));
}
export function countMini6(grid: number[], limit=2): number {
  if(grid.length!==36||grid.some((d,i)=>!Number.isInteger(d)||d<0||d>6||(d&&mini6Peers[i].some(p=>grid[p]===d))))return 0;
  let count=0;
  function visit(): void {
    if(count>=limit)return;
    let target=-1, options:number[]=[];
    for(let i=0;i<36;i++)if(!grid[i]){const ds=mini6Candidates(grid,i);if(!ds.length)return;if(target<0||ds.length<options.length){target=i;options=ds;}}
    if(target<0){count++;return;}
    for(const d of options){grid[target]=d;visit();grid[target]=0;if(count>=limit)return;}
  }
  visit();return count;
}
export function traceMini6(puzzle: string) {
  const grid=[...puzzle].map(c=>c==='.'?0:Number(c));
  if(countMini6(grid.slice())!==1)throw new Error('6×6 lesson must have exactly one solution');
  const steps:{cell:number;digit:number;before:number[]}[]=[];
  while(grid.includes(0)){
    const cell=grid.findIndex((d,i)=>!d&&mini6Candidates(grid,i).length===1);
    if(cell<0)throw new Error('6×6 introductory lesson must finish using singles');
    const digit=mini6Candidates(grid,cell)[0];steps.push({cell,digit,before:grid.slice()});grid[cell]=digit;
  }
  return {steps,solution:grid.join('')};
}
export const MINI6_PUZZLES = [
  { puzzle: '.4..6.2.6431624....1....5326....1.25', solution: '143562256431624153315246532614461325' },
  { puzzle: '3.6..5.2..4.2.3.6446...26.24..13....', solution: '346125521643213564465312652431134256' },
  { puzzle: '315.....231..3...45.4231..64......5.', solution: '315642642315231564564231156423423156' },
  { puzzle: '.2643..3....14..53...14236......5...', solution: '526431431526142653653142364215215364' },
  { puzzle: '..5....1423.....4....3511...2324....', solution: '325164614235531642462351156423243516' },
  { puzzle: '.5.2.1.....4...46.3.41.524......5...', solution: '456231132654521463364125243516615342' },
];
