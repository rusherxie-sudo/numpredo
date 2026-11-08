import type {LogicModel} from './models.ts';

// Render only the stated local candidates. Dashes mark omitted cells, not empty
// puzzle cells. Row models are cropped to one row to keep the candidates legible.
export function modelDiagram(model:LogicModel,title:string,remove=false):string {
 const rowOnly=model.cells.every(c=>c.cell<9),rows=rowOnly?1:9;
 const unit=48,left=22,top=24,width=left+9*unit+8,height=top+rows*unit+10;
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title>`];
 for(let c=0;c<9;c++)parts.push(`<text x="${left+c*unit+24}" y="15" text-anchor="middle" fill="var(--ink-3)" font-size="12">${c+1}</text>`);
 for(let r=0;r<rows;r++){
  parts.push(`<text x="10" y="${top+r*unit+28}" text-anchor="middle" fill="var(--ink-3)" font-size="12">${r+1}</text>`);
  for(let c=0;c<9;c++){
   const cell=r*9+c,x=left+c*unit,y=top+r*unit,item=model.cells.find(v=>v.cell===cell),target=cell===model.target;
   parts.push(`<rect x="${x}" y="${y}" width="48" height="48" fill="${target?'var(--accent-tint)':item?'var(--surface-2)':'var(--surface)'}" stroke="var(--line-2)"/>`);
   if(!item){parts.push(`<text x="${x+24}" y="${y+29}" text-anchor="middle" fill="var(--ink-4)" font-size="14">—</text>`);continue;}
   if(model.boolean){
    const label=target&&remove?`${model.digit}なし`:`${model.digit}？`;
    parts.push(`<text x="${x+24}" y="${y+29}" text-anchor="middle" fill="${target?'var(--accent)':'var(--ink)'}" font-size="15">${label}</text>`);
   }else{
    for(const digit of item.values.filter(Boolean)){
     const dx=x+8+((digit-1)%3)*16,dy=y+13+Math.floor((digit-1)/3)*15,deleted=target&&remove&&digit===model.digit;
     parts.push(`<text x="${dx}" y="${dy}" text-anchor="middle" fill="${deleted?'var(--num-error)':'var(--ink)'}" font-size="12">${digit}</text>`);
     if(deleted)parts.push(`<path d="M${dx-5},${dy-10}l10,11" stroke="var(--num-error)" stroke-width="2"/>`);
    }
   }
   if(target)parts.push(`<rect x="${x+2}" y="${y+2}" width="44" height="44" fill="none" stroke="var(--accent)" stroke-width="2"/>`);
  }
 }
 // Block boundaries remain distinct from the thin cell grid.
 for(const col of [0,3,6,9])parts.push(`<path d="M${left+col*unit},${top}v${rows*unit}" stroke="var(--ink-3)" stroke-width="1.8"/>`);
 for(const row of rowOnly?[0,1]:[0,3,6,9])parts.push(`<path d="M${left},${top+row*unit}h${9*unit}" stroke="var(--ink-3)" stroke-width="1.8"/>`);
 parts.push('</svg>');return parts.join('');
}
