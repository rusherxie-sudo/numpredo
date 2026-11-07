export function returnPath(value:string|null):string|null {
 if(!value||/[\\\x00-\x20]/.test(value))return null;
 // Match the raw path before URL normalization: encoded/double-encoded traversal cannot enter.
 const m=value.match(/^(\/(?:play\/(?:beginner\/|intermediate\/|advanced\/|hard\/|extreme\/)?|daily\/(?:archive\/)?|guide\/newspaper\/)?)(?:\?([^#]*))?(#(?:sudoku-game|home-game|newspaper-input))?$/);
 if(!m)return null;
 const q=new URLSearchParams(m[2]);
 for(const [k,v]of q){
  if(q.getAll(k).length!==1)return null;
  if(k==='n'){if(!/^\d+$/.test(v)||+v<1||+v>10000||!/^\/(?:play\/|$)/.test(m[1]))return null;}
  else if(k==='tab'){if(!/^[0-6]$/.test(v)||!m[1].startsWith('/daily/'))return null;}
  else if(k==='d'){if(m[1]!=='/daily/archive/'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;try{if(new Date(v).toISOString().slice(0,10)!==v)return null;}catch{return null;}}
  else return null;
 }
 return value;
}
export function carriedParam(key: string): string | null {
  return new URLSearchParams(location.hash.slice(1)).get(key) ?? new URLSearchParams(location.search).get(key);
}
export function carriedReturn(): string | null { return returnPath(carriedParam('return')); }
export function toolLink(path: string, grid: number[], back = carriedReturn()): string {
  const params = new URLSearchParams({ grid: grid.map(v => v || '.').join('') });
  if (back) params.set('return', back);
  return `${path}#${params}`;
}
export function addReturnLink(parent: HTMLElement): void {
  const back = carriedReturn();
  if (!back) return;
  const p = document.createElement('p'), a = document.createElement('a');
  a.href = back; a.textContent = back.startsWith('/guide/newspaper/')?'新聞の入力ページに戻る →':'元のゲームに戻って続きを解く →'; a.dataset.learningReturn = '';
  p.append(a); parent.append(p);
}
