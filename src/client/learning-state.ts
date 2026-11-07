// Local-only proof, never an analytics identifier. One pending trip per tab.
import { returnPath } from './learning-transfer.ts';
export const LEARNING_KEY = 'numpredo.learning.np01';
export const TECHNIQUES = ['general','naked-single','hidden-single','pointing','naked-pair','hidden-pair','naked-triple','x-wing','swordfish','skyscraper'];
export interface LearningTrip { v:1; visited?:boolean; at:number; state:'outbound'|'returned'; back:string; destination:string; kind:'guide'|'practice'; technique:string; key:string; saved:string; generation:number; revision:number; }
export function writeTrip(t:LearningTrip):boolean { try{sessionStorage.setItem(LEARNING_KEY,JSON.stringify(t));return true;}catch{return false;} }
export function clearTrip():void {try{sessionStorage.removeItem(LEARNING_KEY);}catch{/* optional */}}
export function readTrip():LearningTrip|null {
 try {
  const t=JSON.parse(sessionStorage.getItem(LEARNING_KEY)||'null');
  if(!t)return null;
  if(t.v!==1 || !['outbound','returned'].includes(t.state) || !Number.isFinite(t.at) || Date.now()<t.at || Date.now()-t.at>7200000 || returnPath(t.back)!==t.back || !['guide','practice'].includes(t.kind) || !TECHNIQUES.includes(t.technique) || !Number.isSafeInteger(t.revision) || !Number.isSafeInteger(t.generation) || typeof t.key!=='string' || typeof t.saved!=='string' || !/^\/(?:practice\/|guide\/(?:how-to-solve\/|techniques\/[a-z-]+\/))$/.test(t.destination)) {clearTrip();return null;}
  return t;
 } catch {return null;}
}

export function markLearningVisit():void {
 const t=readTrip(),back=returnPath(new URLSearchParams(location.search).get('return'));
 if(t?.state==='outbound' && t.destination===location.pathname && t.back===back){t.visited=true;writeTrip(t);}
}
