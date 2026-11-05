import { readRecentGames,todayJst } from './recent-games.ts';
import { PUZZLE_TECHNIQUES } from '../data/puzzle-techniques.ts';
import { readHistory,needsReview } from './practice-history.ts';
import { track } from './track.ts';
const root=document.querySelector<HTMLElement>('[data-continue]');
if(root){
  function link(href:string,label:string,kind:string):HTMLAnchorElement {
    const a=document.createElement('a');a.href=href;a.textContent=label;
    a.addEventListener('click',()=>track('home_continue_click',{kind}));return a;
  }
  function render():void {
    if(!root)return;
    const games=root.querySelector<HTMLElement>('[data-continue-games]')!,practice=root.querySelector<HTMLElement>('[data-continue-practice]')!;
    const gameList=games.querySelector('ul')!,practiceList=practice.querySelector('ul')!;
    gameList.replaceChildren();practiceList.replaceChildren();
    const add=(list:HTMLElement,a:HTMLElement)=>{const li=document.createElement('li');li.append(a);list.append(li);};
    for(const r of readRecentGames().slice(0,3))add(gameList,link(r.href,`${r.label}の続きを解く →`,'game'));
    try {
      // Existing saves predate the recent-games index. Preserve their entry points.
      if(!gameList.children.length){
        for(const [level,name] of [['beginner','初級'],['intermediate','中級'],['advanced','上級'],['hard','難問'],['extreme','超難問']]){
          try{const s=JSON.parse(localStorage.getItem(`numpredo.prog.${level}`)??'null');
            if(s&&s.d===0&&/^[0-9]{81}$/.test(s.c)&&(s.c!==s.p.replace(/\./g,'0')||s.h===1||String(s.n).split(',').some(n=>Number(n)>0)))add(gameList,link(`/play/${level}/#level-game`,`${name}の保存したゲーム →`,'game'));
          }catch{}
          if(gameList.children.length>=3)break;
        }
      }
      const records=PUZZLE_TECHNIQUES.map(t=>{
        try{const run=JSON.parse(localStorage.getItem(`numpredo.one-move.v1.${t.slug}`)??'null');return {t,run,at:Number(localStorage.getItem(`numpredo.one-move.updated.${t.slug}`)??0)};}catch{return {t,run:null,at:0};}
      }).filter(({t,run:r})=>r&&r.version===1&&r.slug===t.slug&&r.finished===false&&Array.isArray(r.ids)&&r.ids.length>0&&Number.isInteger(r.index)&&r.index>=0&&r.index<r.ids.length).sort((a,b)=>b.at-a.at);
      for(const {t,run:r} of records.slice(0,3))add(practiceList,link(`/practice/?tech=${t.slug}#one-move`,`${t.name}：${r.index+1}/${r.ids.length}問目から →`,'practice'));
      const log=JSON.parse(localStorage.getItem('numpredo.daily.log5')??'{}');
      const keys=Array.isArray(log?.[todayJst()])?log[todayJst()]:[];
      const valid=new Set(['beginner','intermediate','advanced','hard','extreme','beginner-2','intermediate-2']);
      const count=new Set(keys.filter((k:unknown)=>typeof k==='string'&&valid.has(k))).size;
      root.querySelector('[data-continue-daily]')!.textContent=`今日の7問：${count}/7問クリア${count===7?' — 達成しました！':' — 続きを解く →'}`;
      const recommended=PUZZLE_TECHNIQUES.map(t=>({t,n:Object.values(readHistory(t.slug)).filter(needsReview).length})).sort((a,b)=>b.n-a.n)[0];
      root.querySelector('[data-continue-recommend]')!.replaceChildren(recommended.n
        ?link(`/practice/?tech=${recommended.t.slug}#one-move`,`${recommended.t.name}を復習する（${recommended.n}局面） →`,'recommendation')
        :link('/practice/#one-move','次の一手を5問練習する →','recommendation'));
    }catch{root.querySelector('[data-continue-note]')!.textContent='このブラウザでは保存した記録を読み込めません。';}
    games.hidden=!gameList.children.length;practice.hidden=!practiceList.children.length;
  }
  render();window.addEventListener('pageshow',render);window.addEventListener('storage',render);window.addEventListener('game-progress',render);
}
