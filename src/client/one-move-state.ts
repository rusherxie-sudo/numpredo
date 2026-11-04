export interface OneMoveQuestion {
  id: string; grid: number[]; candidates: number[][]; target: number; answer: number;
  options: number[]; placing: boolean; marks: number[]; premise: string; outcome: string;
  level: string; levelName: string; number: number; stepNumber: number;
}
export interface OneMoveSet { version: 1; slug: string; name: string; questions: OneMoveQuestion[] }
export interface OneMoveRun {
  version: 1; slug: string; mode: 'challenge' | 'review'; ids: string[];
  answers: (number | null)[]; hints: boolean[]; index: number; finished: boolean;
}
export function newRun(set: OneMoveSet, ids = set.questions.map(q => q.id), mode: OneMoveRun['mode'] = 'challenge'): OneMoveRun {
  const shuffled = [...ids];
  for (let i=shuffled.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  return { version:1,slug:set.slug,mode,ids:shuffled,answers:shuffled.map(()=>null),hints:shuffled.map(()=>false),index:0,finished:false };
}
export function restoreRun(raw: string | null, set: OneMoveSet): OneMoveRun | null {
  try {
    const r=JSON.parse(raw ?? 'null') as OneMoveRun;
    if (!r || r.version!==1 || r.slug!==set.slug || !['challenge','review'].includes(r.mode) ||
      !Array.isArray(r.ids) || !r.ids.length || r.ids.length>set.questions.length || new Set(r.ids).size!==r.ids.length ||
      (r.mode==='challenge' && r.ids.length!==set.questions.length) || !Array.isArray(r.answers) || r.answers.length!==r.ids.length ||
      !Array.isArray(r.hints) || r.hints.length!==r.ids.length || r.hints.some(h=>typeof h!=='boolean') ||
      !Number.isInteger(r.index) || r.index<0 || r.index>=r.ids.length || typeof r.finished!=='boolean') return null;
    for (let i=0;i<r.ids.length;i++) {
      const q=set.questions.find(q=>q.id===r.ids[i]); const a=r.answers[i];
      if (!q || (a!==null && !q.options.includes(a)) || (i<r.index && a===null) || (i>r.index && a!==null)) return null;
    }
    if (r.finished && (r.index!==r.ids.length-1 || r.answers.some(a=>a===null))) return null;
    return r;
  } catch { return null; }
}
export function wrongIds(run: OneMoveRun,set: OneMoveSet): string[] {
  return run.ids.filter((id,i)=>run.answers[i]!==null && run.answers[i]!==set.questions.find(q=>q.id===id)!.answer);
}
