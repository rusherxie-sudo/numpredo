export {npTrack as track} from './np01-track.ts';
// Only the new NP01 helpers are loaded dynamically, only on standard games.
import type {Measurement,Saved} from './sudoku-game.ts';
import type {Game} from './game-learning.ts';
export function params(archive:boolean,daily:boolean,level:string,slot?:number):Record<string,unknown>{
 return {measurement_version:'np01',game_mode:archive?'archive':daily?'daily':'library',game_level:level.replace(/^home-/,''),...(daily&&slot!==undefined?{daily_slot:slot}:{})};
}
export function restore(s?:Saved|null):Measurement {
 const m=s?.measurement;
 return m?.v===1&&['yes','no','unknown'].includes(m.input)&&['yes','no','unknown'].includes(m.hint)&&Number.isSafeInteger(m.revision)&&m.revision>=0&&Number.isSafeInteger(m.generation)&&m.generation>=0
  ?{...m,hint:s?.h===1?'yes':s?.h===0?'no':m.hint}
  :{v:1,input:s?'unknown':'no',hint:s?(s.h===1?'yes':s.h===0?'no':'unknown'):'no',revision:0,generation:0};
}
export function learningLoader(game:()=>Game):{load:()=>Promise<void>;restore:()=>void;input:()=>void;clear:()=>void} {
 const jst=()=>new Date(Date.now()+32400000).toISOString().slice(0,10),day=jst();
 let learning:{input:()=>void;clear:()=>void;observe:()=>void}|undefined,loading:Promise<void>|undefined;
 const load=()=>loading??=(import('./game-learning.ts').then(({initGameLearning})=>{const g=game();learning=initGameLearning({...g,validDay:()=>g.params().game_mode!=='daily'||jst()===day});learning.observe();}).catch(()=>{loading=undefined;}));
 return {load,restore:()=>{if(learning){learning.observe();return;}try{if(sessionStorage.getItem('numpredo.learning.np01'))load();}catch{/* no cross-page proof */}},input:()=>learning?.input(),clear:()=>learning?.clear()};
}
export function persist(data:Saved,m:Measurement,memory:Map<string,Saved>,key:string,hint:boolean):void {
 m.revision++;data.measurement={...m};
 if(m.hint==='unknown')delete data.h;else data.h=hint?1:0;
 memory.set(key,data);
}
export function input(m:Measurement,valid:boolean,save:()=>void,params:()=>Record<string,unknown>,learning:()=>void):void {
 if(!valid)return;learning();if(m.input==='yes')return;m.input='yes';save();emit('puzzle_first_input',params());
}
import {npTrack as emit} from './np01-track.ts';
import {readTrip,clearTrip} from './learning-state.ts';
// Inspect the actual slot before the legacy migration can recreate a deleted slot.
export function validateStorage():void {
 const t=readTrip();if(!t)return;
 try {const raw=localStorage.getItem(t.key);if(!raw || (t.state==='outbound'&&raw!==t.saved))clearTrip();else JSON.parse(raw);}catch{clearTrip();}
}
export function completion(m:Measurement,p:Record<string,unknown>):Record<string,unknown>{return {...p,hint_used:m.hint,input_observed:m.input};}
