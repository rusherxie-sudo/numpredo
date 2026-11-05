import type { OneMoveSet } from './one-move-state.ts';
export interface PracticeResult { correct: boolean; hint: boolean; at: number }
export type PracticeHistory = Record<string, PracticeResult>;
export const historyKey=(slug:string)=>`numpredo.one-move.history.v1.${slug}`;
export function parseHistory(raw:string|null):PracticeHistory {
  try {
    const data=JSON.parse(raw??'null');
    if(!data || typeof data!=='object' || Array.isArray(data))return {};
    return Object.fromEntries(Object.entries(data).filter(([id,v])=>{
      const r=v as PracticeResult;
      return /^[a-z]+-\d+-\d+$/.test(id) && r && typeof r.correct==='boolean' && typeof r.hint==='boolean' && Number.isFinite(r.at);
    })) as PracticeHistory;
  } catch{return {};}
}
export function readHistory(slug:string):PracticeHistory {
  try{return parseHistory(localStorage.getItem(historyKey(slug)));}catch{return {};}
}
export function needsReview(result:PracticeResult|undefined):boolean {return !!result&&(!result.correct||result.hint);}
export function recommendIds(set:OneMoveSet,history:PracticeHistory):string[] {
  // Refresh the order within each group, retaining priority: review, unseen, confident.
  const groups:[string[],string[],string[]]=[[],[],[]];
  for(const q of set.questions){const r=history[q.id];groups[needsReview(r)?0:!r?1:2].push(q.id);}
  for(const ids of groups)for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  return groups.flat().slice(0,5);
}
