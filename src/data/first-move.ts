import examples from '../../public/data/one-move/naked-single.json' with { type: 'json' };
// 首页只使用既有题库中第一手的真实局面；推理数据在构建期重新计算。
const question = examples.questions[0];
const { grid, target, answer } = question;
const row = Math.floor(target / 9), column = target % 9;
const indices = {
  row: Array.from({length:9},(_,i)=>row*9+i),
  column: Array.from({length:9},(_,i)=>i*9+column),
  block: Array.from({length:9},(_,i)=>(Math.floor(row/3)*3+Math.floor(i/3))*9+Math.floor(column/3)*3+i%3),
};
const digits = (cells:number[]) => [...new Set(cells.map(i=>grid[i]).filter(Boolean))].sort((a,b)=>a-b);
const units = {row:digits(indices.row),column:digits(indices.column),block:digits(indices.block)};
const candidates = Array.from({length:9},(_,i)=>i+1).filter(d=>!Object.values(units).some(values=>values.includes(d)));
if(grid[target]!==0 || candidates.length!==1 || candidates[0]!==answer || question.stepNumber!==1) throw new Error('首页单步例题必须是可直接验证的唯一候选');
const rejection = Object.fromEntries(Array.from({length:9},(_,i)=>i+1).map(d=>[d,
  units.row.includes(d) ? '同じ行に'+d+'があります。' : units.column.includes(d) ? '同じ列に'+d+'があります。' : units.block.includes(d) ? '同じ3×3ブロックに'+d+'があります。' : ''
]));
export const firstMove = {grid,target,answer,row,column,units,candidates,rejection,peers:[...new Set(Object.values(indices).flat())],origin:'/play/'+question.level+'/?n='+question.number+'#level-game',number:question.number};
