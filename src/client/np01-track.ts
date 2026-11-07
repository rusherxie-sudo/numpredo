import {track} from './track.ts';
type EventParams=Record<string,unknown>;
export function npTrack(name:string,params:EventParams={}):void {track(name,np01Params(name,params)??{});}

export function printIntent(kind:'generated'|'blank'|'technique'|'mini6'|'mini4'|'solver16'|'generator'):void {
  npTrack('print_intent',{print_kind:kind});
  try { window.print(); } catch { /* print intent is not print success */ }
}

// Runtime boundary: new events accept only finite values, never arbitrary strings/URLs.
const npNames=['puzzle_first_input','game_hint','game_learning_open','game_learning_return','game_learning_input','pdf_link_click','pdf_preview_view','print_intent'];
const npAllowed:Record<string,string>={game_mode:'library daily archive',game_level:'beginner intermediate advanced hard extreme',learning_kind:'guide practice',technique:'general naked-single hidden-single pointing naked-pair hidden-pair naked-triple x-wing swordfish skyscraper',pdf_entry:'download preview related',pdf_kind:'standard variant collection progression activity',pdf_role:'questions answers combined guide',print_kind:'generated blank technique mini6 mini4 solver16 generator'};
function np01Params(name:string,p:EventParams):EventParams|null {
 const i=npNames.indexOf(name);if(i<0)return null;
 const keys=i<5?'game_mode game_level'+(i>1?' learning_kind technique':''):i===7?'print_kind':'pdf_kind pdf_role'+(i===5?' pdf_entry':'');
 const out:EventParams={measurement_version:'np01'};
 for(const k of keys.split(' '))if(npAllowed[k].split(' ').includes(p[k] as string))out[k]=p[k];
 if(i<5&&Number.isInteger(p.daily_slot)&&Number(p.daily_slot)>=0&&Number(p.daily_slot)<=6)out.daily_slot=p.daily_slot;
 return out;
}
