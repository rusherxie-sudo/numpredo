import { peersFor } from './variant-grid.ts';
export function newspaperInput(text:string): {grid:number[];error?:undefined}|{grid?:undefined;error:string} {
  const clean=text.normalize('NFKC').replace(/[\s|]/g,'').replace(/[0□・]/g,'.');
  if(!/^[1-9.]{81}$/.test(clean))return {error:'9文字×9行、計81マスを入力してください。空きは「.」または0で、数字は1〜9です。'};
  const grid=[...clean].map(c=>c==='.'?0:Number(c));
  if(!grid.some(Boolean))return {error:'紙面に最初から印刷された数字を入れてください。'};
  const peers=peersFor(9,3,3);
  const at=grid.findIndex((d,i)=>d&&peers[i].some(j=>grid[j]===d));
  if(at>=0)return {error:`${Math.floor(at/9)+1}行${at%9+1}列の数字が行・列・ブロックで重複しています。紙面と照合してください。`};
  return {grid};
}
