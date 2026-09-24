import { peersFor, variantCandidates, type VariantPuzzle } from '../engine/variant-grid.ts';
import { track } from './track.ts';
document.querySelectorAll<HTMLElement>('[data-variant-game]').forEach(setup);
function setup(root:HTMLElement):void {
  const puzzles:VariantPuzzle[]=JSON.parse(root.dataset.puzzles!);
  const size=Number(root.dataset.size),br=Number(root.dataset.br),bc=Number(root.dataset.bc),kind=root.dataset.kind!;
  const peers=peersFor(size,br,bc),storageKey=`numpredo.variant.${kind}.v1`;
  let index=0, grid:number[]=[],notes:number[][]=[],selected=0,memo=false,completed=false,started=false;
  let history:{grid:number[];notes:number[][]}[]=[];let wrong=new Set<number>();
  const board=root.querySelector<HTMLElement>('[data-board]')!,status=root.querySelector<HTMLElement>('[data-status]')!;
  const cells:HTMLButtonElement[]=[];board.style.gridTemplateColumns=`repeat(${size},minmax(0,1fr))`;
  for(let r=0;r<size;r++) {const row=document.createElement('div');row.className='vg-row';row.setAttribute('role','row');board.append(row);
    for(let c=0;c<size;c++){const i=r*size+c,b=document.createElement('button');b.type='button';b.setAttribute('role','gridcell');b.addEventListener('click',()=>{selected=i;render();});b.addEventListener('focus',()=>{if(selected!==i){selected=i;render();}});row.append(b);cells.push(b);}
  }
  const original=()=>Array.from(puzzles[index].puzzle,c=>c==='.'?0:Number(c));
  function save():void { try {localStorage.setItem(storageKey,String(index));localStorage.setItem(`${storageKey}.${puzzles[index].id}`,JSON.stringify({grid,notes}));}catch{} }
  function load(i:number):void {index=(i+puzzles.length)%puzzles.length;grid=original();notes=grid.map(()=>[]);history=[];wrong.clear();selected=Math.max(0,grid.indexOf(0));completed=false;started=false;status.textContent='空きマスを選び、数字を入力してください。';restore();}
  function snapshot():void {history.push({grid:grid.slice(),notes:notes.map(x=>x.slice())});if(history.length>100)history.shift();}
  function render():void {
    const fixed=original();root.querySelector('[data-label]')!.textContent=`問題 ${index+1} / ${puzzles.length}`;
    cells.forEach((b,i)=>{b.className='vg-cell';b.classList.toggle('fixed',!!fixed[i]);b.classList.toggle('user',!fixed[i]&&!!grid[i]);b.classList.toggle('selected',i===selected);b.classList.toggle('br',(i%size+1)%bc===0&&i%size<size-1);b.classList.toggle('bb',(Math.floor(i/size)+1)%br===0&&i<size*(size-1));b.classList.toggle('wrong',wrong.has(i));b.replaceChildren();const text=document.createElement('span');text.textContent=grid[i]?String(grid[i]):notes[i].join(' ');if(!grid[i])text.className='notes';b.append(text);b.tabIndex=i===selected?0:-1;b.setAttribute('aria-selected',String(i===selected));b.setAttribute('aria-label',`${Math.floor(i/size)+1}行${i%size+1}列 ${grid[i]||'空き'}${fixed[i]?' 固定':''}${!grid[i]&&notes[i].length?' メモ '+notes[i].join('・'):''}`);
      for(const [a,to,op] of puzzles[index].signs??[])if(a===i){const s=document.createElement('span');s.className=`vg-sign ${to===a+1?'horizontal':'vertical'}`;s.textContent=to===a+1?op:op==='<'?'∧':'∨';s.setAttribute('aria-hidden','true');b.append(s);b.setAttribute('aria-label',b.getAttribute('aria-label')+`、${to===a+1?'右':'下'}のマスより${op==='<'?'小さい':'大きい'}`);}
    });
    root.querySelector<HTMLButtonElement>('[data-undo]')!.disabled=!history.length;
  }
  function input(d:number):void {
    if(original()[selected])return;
    if(!started){track('variant_game_start',{variant:kind,puzzle:index+1});started=true;}
    snapshot();wrong.clear();
    if(memo&&d&&!grid[selected]){const at=notes[selected].indexOf(d);if(at<0)notes[selected].push(d);else notes[selected].splice(at,1);notes[selected].sort();}
    else {grid[selected]=d;notes[selected]=[];}
    if(grid.every((v,i)=>v===Number(puzzles[index].solution[i]))){status.textContent='完成です！すべてのルールを満たしています。次の問題もどうぞ。';if(!completed)track('variant_game_complete',{variant:kind,puzzle:index+1});completed=true;}
    else {completed=false;status.textContent=memo?'メモを更新しました。':'入力を保存しました。';}
    save();render();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b=>b.addEventListener('click',()=>input(Number(b.dataset.digit))));
  root.querySelector('[data-memo]')!.addEventListener('click',()=>{memo=!memo;root.querySelector('[data-memo]')!.setAttribute('aria-pressed',String(memo));});
  root.querySelector('[data-undo]')!.addEventListener('click',()=>{const p=history.pop();if(p){grid=p.grid;notes=p.notes;wrong.clear();completed=false;status.textContent='一手戻しました。';save();render();}});
  root.querySelector('[data-reset]')!.addEventListener('click',()=>{snapshot();grid=original();notes=grid.map(()=>[]);wrong.clear();completed=false;status.textContent='最初に戻しました。「元に戻す」で取り消せます。';save();render();});
  for(const [attr,delta] of [['prev',-1],['next',1]] as const)root.querySelector(`[data-${attr}]`)!.addEventListener('click',()=>{load(index+delta);save();render();});
  root.querySelector('[data-check]')!.addEventListener('click',()=>{wrong=new Set(grid.map((v,i)=>v&&v!==Number(puzzles[index].solution[i])?i:-1).filter(i=>i>=0));status.textContent=wrong.size?`${wrong.size}マスを確認してください。赤いマスを直せます。`:grid.includes(0)?'ここまで合っています。空きマスを続けて解きましょう。':'完成です！';render();});
  root.querySelector('[data-hint]')!.addEventListener('click',()=>{
    if(grid.some((v,i)=>v&&v!==Number(puzzles[index].solution[i]))){status.textContent='先に「答え合わせ」で入力を確認してください。';return;}
    const ds=variantCandidates(grid,size,peers,puzzles[index].signs);const cell=grid.findIndex((v,i)=>!v&&ds[i].length===1);
    if(cell<0){status.textContent=grid.includes(0)?'候補が一つになるマスは見つかりません。下の解き方を確認してください。':'すべて埋まっています。';return;}
    selected=cell;status.textContent=`${Math.floor(cell/size)+1}行${cell%size+1}列は、行・列・ブロック${kind==='inequality'?'と不等号':''}で候補を絞ると${ds[cell][0]}だけです。自分で入力してみましょう。`;track('variant_game_hint',{variant:kind});render();cells[cell].focus();
  });
  board.addEventListener('keydown',e=>{if(/^[1-9]$/.test(e.key)&&Number(e.key)<=size){e.preventDefault();input(Number(e.key));}else if(['0','Delete','Backspace'].includes(e.key)){e.preventDefault();input(0);}else {const delta=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size} as Record<string,number>)[e.key];if(delta){e.preventDefault();selected=Math.max(0,Math.min(grid.length-1,selected+delta));render();cells[selected].focus();}}});
  function restore():void {
    try {
      const saved=JSON.parse(localStorage.getItem(`${storageKey}.${puzzles[index].id}`)||'null');const base=original();
      if(saved&&Array.isArray(saved.grid)&&saved.grid.length===size*size&&saved.grid.every((v:number,i:number)=>Number.isInteger(v)&&v>=0&&v<=size&&(!base[i]||base[i]===v))){
        grid=saved.grid;
        if(Array.isArray(saved.notes)&&saved.notes.length===grid.length&&saved.notes.every((ns:unknown)=>Array.isArray(ns)&&ns.every(n=>Number.isInteger(n)&&n>=1&&n<=size)))notes=saved.notes;
        status.textContent='保存した途中経過を再開しました。';
      }
    }catch{}
    completed=grid.every((v,i)=>v===Number(puzzles[index].solution[i]));
  }
  let savedIndex=0;
  try {const n=Number(localStorage.getItem(storageKey));if(Number.isInteger(n)&&n>=0&&n<puzzles.length)savedIndex=n;}catch{}
  load(savedIndex);render();
}
