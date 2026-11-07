import {readTrip,writeTrip,clearTrip,TECHNIQUES, type LearningTrip} from './learning-state.ts';
import {returnPath} from './learning-transfer.ts';
import {npTrack as track} from './np01-track.ts';
interface State {done:boolean;paused:boolean;generation:number;revision:number;p:string;c:string;n:string;e:number;}
export interface Game {validDay?:()=>boolean;hintMsg:HTMLElement;back:()=>string;key:()=>string;save:()=>void;read:()=>string|null;state:()=>State;params:()=>Record<string,unknown>;pauseRestored:()=>void;}
export function initGameLearning(g:Game):{input:()=>void;clear:()=>void;observe:()=>void} {
 let returned:LearningTrip|null=null;
 g.hintMsg.addEventListener('click',event=>{
  const a=(event.target as Element).closest<HTMLAnchorElement>('a'),s=g.state();if(!a||s.done||s.paused)return;
  if(g.validDay&&!g.validDay()){clearTrip();return;}
  const u=new URL(a.href,location.href),practice=u.pathname==='/practice/';
  const slug=practice?a.dataset.hintPractice:u.pathname.match(/^\/guide\/techniques\/([a-z-]+)\/$/)?.[1]??(u.pathname==='/guide/how-to-solve/'?'general':'');
  const back=returnPath(g.back());if(!back||u.origin!==location.origin||!slug||!TECHNIQUES.includes(slug))return;
  g.save();const saved=g.read(),now=g.state();
  let stored=false;
  try{const sv=JSON.parse(saved??'null');stored=sv?.measurement?.revision===now.revision&&sv?.measurement?.generation===now.generation&&sv.p===now.p&&sv.c===now.c&&sv.n===now.n&&sv.e===now.e;}catch{/* unavailable save */}
  const t:LearningTrip={v:1,at:Date.now(),state:'outbound',back,destination:u.pathname,kind:practice?'practice':'guide',technique:slug,key:g.key(),saved:saved??'',generation:now.generation,revision:now.revision};
  if(stored&&writeTrip(t))track('game_learning_open',{...g.params(),learning_kind:t.kind,technique:slug});
  else{clearTrip();g.hintMsg.append(document.createTextNode(' このブラウザでは記録を保存できません。'));}
  u.searchParams.set('return',back);a.href=u.pathname+u.search+u.hash;
 });
 const observe=()=>{
  const s=g.state(),t=readTrip();if(g.validDay&&!g.validDay()){clearTrip();return;}if(s.done||!t||t.back!==g.back()||t.key!==g.key()||t.generation!==s.generation)return;
  const raw=g.read();if(!raw)return;
  if(t.state==='outbound'){
   if(!t.visited||raw!==t.saved||s.revision!==t.revision)return;
   let sv;try{sv=JSON.parse(raw);}catch{return;}
   if(sv.p!==s.p||sv.c!==s.c||sv.n!==s.n||sv.e!==s.e)return;
   t.state='returned';if(!writeTrip(t))return;returned=t;g.pauseRestored();
   track('game_learning_return',{...g.params(),learning_kind:t.kind,technique:t.technique});
  }else {returned=t;if(t.revision===s.revision)g.pauseRestored();}
 };
 window.addEventListener('pageshow',observe);
 return {observe,clear:()=>{returned=null;clearTrip();},input:()=>{
  if(!returned)return;
  if(g.validDay&&!g.validDay()){returned=null;clearTrip();return;}
  const t=readTrip(),s=g.state();
  if(t?.state==='returned'&&t.back===g.back()&&t.key===g.key()&&t.generation===s.generation)track('game_learning_input',{...g.params(),learning_kind:t.kind,technique:t.technique});
  returned=null;clearTrip();
 }};
}
