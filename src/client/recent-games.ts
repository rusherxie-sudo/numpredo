import { returnPath } from './learning-transfer.ts';
export interface RecentGame { key:string; href:string; label:string; at:number }
export function todayJst():string {return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
export function readRecentGames():RecentGame[] {
  const rows:RecentGame[]=[];
  try {
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)!;
      if(!/^numpredo\.(puzzle|prog)\./.test(key))continue;
      try {
        const s=JSON.parse(localStorage.getItem(key)??'null'),r=s?.recent;
        if(!r||s.d!==0||!/^[0-9]{81}$/.test(s.c)||typeof r.href!=='string'||!returnPath(r.href)||typeof r.label!=='string'||!Number.isFinite(r.at))continue;
        if(r.href.startsWith('/daily/?')&&s.day!==todayJst())continue;
        rows.push({key,...r});
      }catch{}
    }
  }catch{}
  const seen=new Set<string>();
  return rows.sort((a,b)=>b.at-a.at).filter(r=>{if(seen.has(r.href))return false;seen.add(r.href);return true;}).slice(0,12);
}
