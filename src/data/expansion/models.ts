// Local logical models, explicitly not full Sudoku puzzles. Unshown cells are not empty cells.
export interface LogicModel { caption:string; cells:{cell:number;values:number[]}[]; target:number; digit:number; exactlyOne?:{cells:number[];digit:number}[]; boolean?:boolean }
const row=(domains:number[][])=>domains.map((values,cell)=>({cell,values}));
export const MODELS:Record<string,LogicModel>={
 'claiming':{caption:'1行目の7の候補はr1c1・r1c2だけ。表示していない場所の他の数字は省略しています。',boolean:true,cells:[{cell:0,values:[0,7]},{cell:1,values:[0,7]},{cell:11,values:[0,7]}],target:11,digit:7,exactlyOne:[{cells:[0,1],digit:7}]},
 'hidden-triple':{caption:'1行目の全候補を示した局所モデルです。2〜9行目は省略しています。',cells:row([[1,2,4],[1,3,5],[2,3,6],...[0,1,2,3,4,5].map(()=>[4,5,6,7,8,9])]),target:0,digit:4},
 'naked-quad':{caption:'1行目の全候補。先頭4マスの候補は合計4種類です。下の8行は省略しています。',cells:row([[1,2],[2,3],[3,4],[1,4],[1,5,6],[5,6,7],[7,8],[8,9],[5,9]]),target:4,digit:1},
 'hidden-quad':{caption:'1行目の全候補。1〜4を置けるのは先頭4マスだけです。下の8行は省略しています。',cells:row([[1,2,5],[2,3,6],[3,4,7],[1,4,8],...[0,1,2,3,4].map(()=>[5,6,7,8,9])]),target:0,digit:5},
 'xyz-wing':{caption:'軸r2c2と翼r2c5・r3c3の全候補。回答対象r2c3は3マスすべてを見ます。他のマスは省略しています。',cells:[{cell:10,values:[1,2,3]},{cell:13,values:[1,3]},{cell:20,values:[2,3]},{cell:11,values:[3,4]}],target:11,digit:3},
 'two-string-kite':{caption:'1行目の5はr1c2・r1c8だけ、1列目の5はr2c1・r8c1だけです。5以外の候補と関係のないマスは省略しています。',boolean:true,cells:[{cell:1,values:[0,5]},{cell:7,values:[0,5]},{cell:9,values:[0,5]},{cell:63,values:[0,5]},{cell:70,values:[0,5]}],target:70,digit:5,exactlyOne:[{cells:[1,7],digit:5},{cells:[9,63],digit:5}]},
};
// Enumerate every assignment satisfying the stated local premises. Zero means
// 'not this digit' in single-digit models, not a Sudoku value.
export function localAssignments(model:LogicModel,forced?:number):number {
 const assigned=new Map<number,number>();let count=0;
 const peer=(a:number,b:number)=>Math.floor(a/9)===Math.floor(b/9)||a%9===b%9||(Math.floor(a/27)===Math.floor(b/27)&&Math.floor(a%9/3)===Math.floor(b%9/3));
 function visit(i:number):void {
  if(i===model.cells.length){if((model.exactlyOne??[]).every(g=>g.cells.filter(c=>assigned.get(c)===g.digit).length===1))count++;return;}
  const {cell,values}=model.cells[i];
  for(const d of values){
   if(cell===model.target&&forced!==undefined&&d!==forced)continue;
   if(d&&[...assigned].some(([c,v])=>v===d&&peer(c,cell)))continue;
   assigned.set(cell,d);
   if((model.exactlyOne??[]).every(g=>g.cells.filter(c=>assigned.get(c)===g.digit).length<=1))visit(i+1);
   assigned.delete(cell);
  }
 }
 visit(0);return count;
}
