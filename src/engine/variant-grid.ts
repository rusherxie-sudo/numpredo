export type Inequality = [number, number, '<' | '>'];
export interface VariantPuzzle { id: string; puzzle: string; solution: string; signs?: Inequality[]; }
const unitsByPeers=new WeakMap<number[][],number[][]>();
export function peersFor(size: number, blockRows: number, blockCols: number): number[][] {
  const units:number[][]=[];
  for(let r=0;r<size;r++)units.push(Array.from({length:size},(_,c)=>r*size+c));
  for(let c=0;c<size;c++)units.push(Array.from({length:size},(_,r)=>r*size+c));
  for(let r=0;r<size;r+=blockRows)for(let c=0;c<size;c+=blockCols)units.push(Array.from({length:blockRows},(_,dr)=>Array.from({length:blockCols},(_,dc)=>(r+dr)*size+c+dc)).flat());
  const peers=Array.from({length:size*size},(_,i)=>[...new Set(units.filter(u=>u.includes(i)).flat())].filter(j=>j!==i));
  unitsByPeers.set(peers,units);return peers;
}
export function variantCandidates(grid: number[], size: number, peers: number[][], signs: Inequality[]=[]): number[][] {
  const out=grid.map((v,i)=>v?[v]:Array.from({length:size},(_,d)=>d+1).filter(d=>peers[i].every(j=>grid[j]!==d)));
  let changed=true;
  while(changed) {
    changed=false;
    for(const [a,b,op] of signs) {
      const left=out[a].filter(x=>out[b].some(y=>op==='<'?x<y:x>y));
      const right=out[b].filter(y=>left.some(x=>op==='<'?x<y:x>y));
      if(left.length!==out[a].length||right.length!==out[b].length) changed=true;
      out[a]=left;out[b]=right;
    }
  }
  // Hidden singles supplement naked singles; no guessing or solution lookup.
  const units=unitsByPeers.get(peers)??[];
  for(const unit of units)for(let d=1;d<=size;d++){
    if(unit.some(i=>grid[i]===d))continue;
    const cells=unit.filter(i=>!grid[i]&&out[i].includes(d));
    if(cells.length===1)out[cells[0]]=[d];
  }
  return out;
}
export function killerCombinations(count: number, sum: number, required: number[]=[], excluded: number[]=[]): number[][] {
  if(!Number.isInteger(count)||count<1||count>9||!Number.isInteger(sum)||sum<1||sum>45) return [];
  if([...required,...excluded].some(d=>!Number.isInteger(d)||d<1||d>9)||new Set(required).size!==required.length||required.some(d=>excluded.includes(d))) return [];
  const out:number[][]=[];
  function visit(start:number, picked:number[],total:number):void {
    if(picked.length===count){if(total===sum&&required.every(d=>picked.includes(d)))out.push(picked);return;}
    for(let d=start;d<=9;d++)if(!excluded.includes(d)&&total+d<=sum)visit(d+1,[...picked,d],total+d);
  }
  visit(1,[],0);return out;
}
