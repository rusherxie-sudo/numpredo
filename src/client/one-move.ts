import { newRun,restoreRun,wrongIds,type OneMoveSet,type OneMoveRun } from './one-move-state.ts';
import { readHistory,historyKey,needsReview,recommendIds,type PracticeHistory } from './practice-history.ts';
import { addReturnLink } from './learning-transfer.ts';
import { track } from './track.ts';
const root=document.querySelector<HTMLElement>('[data-one-move]');
if(root) {
  const get=<T extends HTMLElement>(name:string)=>root.querySelector<T>(`[data-om-${name}]`)!;
  const select=get<HTMLSelectElement>('select'),start=get<HTMLButtonElement>('start');
  const status=get('status'),game=get('game'),result=get('result'),next=get<HTMLButtonElement>('next');
  let set:OneMoveSet,run:OneMoveRun,hint=false,history:PracticeHistory={};
  addReturnLink(get('return'));
  get('return').addEventListener('click',()=>track('one_move_return'));
  function recommendedRun():OneMoveRun {return newRun(set,recommendIds(set,history));}
  function showHistory():void {
    const ids=set.questions.map(q=>q.id),seen=ids.filter(id=>history[id]),review=ids.filter(id=>needsReview(history[id]));
    get('history').textContent=`${set.name}：全${ids.length}局面中${seen.length}局面を回答済み・復習おすすめ${review.length}局面（直近で誤答、またはヒントを使用）。次の5問は復習・未回答を優先します。`;
    get<HTMLButtonElement>('history-review').hidden=!review.length;
  }
  function saveHistory():void {try{localStorage.setItem(historyKey(set.slug),JSON.stringify(history));}catch{get('storage').textContent='このブラウザでは記録を保存できません。';}showHistory();}
  const allowed=Array.from(select.options).map(o=>o.value);
  const requested=new URLSearchParams(location.search).get('tech');
  if(requested && allowed.includes(requested)) select.value=requested;
  else { try { const last=localStorage.getItem('numpredo.one-move.last');if(last && allowed.includes(last))select.value=last; }catch{} }
  const key=(slug:string)=>`numpredo.one-move.v1.${slug}`;
  function saved(slug:string):string|null { try{return localStorage.getItem(key(slug));}catch{return null;} }
  function save():void {
    try {localStorage.setItem(key(set.slug),JSON.stringify(run));localStorage.setItem('numpredo.one-move.last',set.slug);localStorage.setItem(`numpredo.one-move.updated.${set.slug}`,String(Date.now()));}
    catch {get('storage').textContent='このブラウザでは保存できません。ページを閉じると進み具合は失われます。';}
  }
  const question=()=>set.questions.find(q=>q.id===run.ids[run.index])!;
  function score():number {return run.answers.filter((a,i)=>a===set.questions.find(q=>q.id===run.ids[i])!.answer).length;}
  function board():void {
    const q=question(),table=document.createElement('table');
    table.setAttribute('aria-label',`${set.name}の局面。回答するマスは${Math.floor(q.target/9)+1}行${q.target%9+1}列`);
    const head=table.createTHead().insertRow();
    for(let i=0;i<=9;i++){const th=document.createElement('th');th.textContent=i?String(i):'';if(i)th.scope='col';head.append(th);}
    const body=table.createTBody();
    for(let r=0;r<9;r++) {
      const row=body.insertRow(),label=document.createElement('th');label.scope='row';label.textContent=String(r+1);row.append(label);
      for(let c=0;c<9;c++) {
        const i=r*9+c,cell=row.insertCell();
        if(i===q.target)cell.classList.add('om-target');
        if((hint||run.answers[run.index]!==null)&&q.marks.includes(i))cell.classList.add('om-mark');
        cell.setAttribute('aria-label',`${r+1}行${c+1}列${i===q.target?'（回答するマス）':''}：${q.grid[i]||'候補 '+q.candidates[i].join('・')}`);
        if(q.grid[i])cell.textContent=String(q.grid[i]);
        else {const notes=document.createElement('div');notes.className='om-notes';notes.setAttribute('aria-hidden','true');for(let d=1;d<=9;d++){const n=document.createElement('span');n.textContent=q.candidates[i].includes(d)?String(d):' ';notes.append(n);}cell.append(notes);}
      }
    }
    get('board').replaceChildren(table);
  }
  function render(focus=false):void {
    game.hidden=run.finished;result.hidden=!run.finished;
    if(run.finished) {
      const wrong=wrongIds(run,set);
      get('result-title').textContent=`${set.name}${run.mode==='review'?'・復習':''}：${run.ids.length}問中${score()}問正解`;
      const list=document.createElement('ul');
      run.ids.forEach((id,i)=>{const q=set.questions.find(q=>q.id===id)!,li=document.createElement('li'),a=document.createElement('a');li.textContent=`${i+1}問目 ${run.answers[i]===q.answer?'正解':'要復習'} — `;a.href=`/play/${q.level}/?n=${q.number}#level-game`;a.textContent=`${q.levelName} No.${q.number}を最初から解く`;li.append(a);list.append(li);});
      get('summary').replaceChildren(list);get<HTMLButtonElement>('review').hidden=!wrong.length;
      if(focus)get('result-title').focus();return;
    }
    const q=question(),answered=run.answers[run.index]!==null;
    get('progress').textContent=`${set.name}${run.mode==='review'?'・復習':''} — ${run.index+1} / ${run.ids.length}問 · 初回正解 ${score()}`;
    get('question').textContent=`${Math.floor(q.target/9)+1}行${q.target%9+1}列${q.placing?'に入る数字は？':'から、この手筋で消せる候補は？'}`;
    get('origin').textContent=`${q.levelName} No.${q.number}・${q.stepNumber}手目の直前。これまでの候補消去も反映しています。`;
    get('feedback').textContent=answered?(run.answers[run.index]===q.answer?'正解です。根拠を確認して次へ進みましょう。':'この根拠で選ぶ一手とは異なります。正しい数字と理由を確認しましょう。'):'';
    get('explanation').hidden=!answered;get('premise').textContent=q.premise;get('outcome').textContent=q.outcome;
    get<HTMLAnchorElement>('guide').href=`/guide/techniques/${set.slug}/`;
    get<HTMLAnchorElement>('play').href=`/play/${q.level}/?n=${q.number}#level-game`;
    const options=q.options.map(d=>{const b=document.createElement('button');b.type='button';b.textContent=`${d}${q.placing?'を入れる':'を消す'}`;b.dataset.digit=String(d);b.disabled=answered;if(answered&&d===q.answer)b.dataset.correct='true';b.addEventListener('click',()=>{
      if(run.answers[run.index]!==null)return;
      run.answers[run.index]=d;history[q.id]={correct:d===q.answer,hint,at:Date.now()};saveHistory();save();track('one_move_answer',{technique:set.slug,question_id:q.id,correct:d===q.answer,mode:run.mode,hint_used:hint});render();get('feedback').focus();
    });return b;});
    get('options').replaceChildren(...options);get('feedback').tabIndex=-1;
    next.disabled=!answered;next.textContent=run.index===run.ids.length-1?'結果を見る':'次の局面へ';
    get<HTMLButtonElement>('hint').disabled=hint||answered;board();if(focus)get('question').focus();
  }
  start.addEventListener('click',async()=>{
    const slug=select.value;if(!allowed.includes(slug))return;
    start.disabled=select.disabled=true;status.textContent='問題を読み込んでいます…';
    try {
      const response=await fetch(`/data/one-move/${slug}.json`);if(!response.ok)throw new Error('load');
      const data=await response.json() as OneMoveSet;
      if(data.version!==1||data.slug!==slug||data.questions.length<5)throw new Error('format');
      set=data;history=readHistory(slug);const restored=restoreRun(saved(slug),set);
      if(restored)restored.ids.forEach((id,i)=>{if(restored.answers[i]!==null&&!history[id])history[id]={correct:restored.answers[i]===set.questions.find(q=>q.id===id)!.answer,hint:restored.hints[i],at:Date.now()};});
      run=restored??recommendedRun();hint=run.hints[run.index];saveHistory();
      save();status.textContent=restored?'保存した練習を開きました。':'5問のチャレンジを始めます。';
      track(restored?'one_move_resume':'one_move_start',{technique:slug,mode:run.mode});render(true);
    } catch {status.textContent='問題を読み込めませんでした。通信を確認して、もう一度押してください。';}
    finally{start.disabled=select.disabled=false;}
  });
  get('hint').addEventListener('click',()=>{if(!run||hint)return;hint=true;run.hints[run.index]=true;save();get<HTMLButtonElement>('hint').disabled=true;board();track('one_move_hint',{technique:set.slug,question_id:question().id,mode:run.mode});});
  next.addEventListener('click',()=>{
    if(!run||run.finished||run.answers[run.index]===null)return;
    if(run.index===run.ids.length-1){run.finished=true;save();track('one_move_complete',{technique:set.slug,mode:run.mode,correct_count:score(),question_count:run.ids.length});}
    else{run.index++;hint=false;save();}render(true);
  });
  get('review').addEventListener('click',()=>{const ids=wrongIds(run,set);if(!ids.length)return;run=newRun(set,ids,'review');hint=false;save();track('one_move_start',{technique:set.slug,mode:run.mode});render(true);});
  get('history-review').addEventListener('click',()=>{
    if(!set)return;const ids=set.questions.filter(q=>needsReview(history[q.id])).map(q=>q.id);if(!ids.length)return;
    run=newRun(set,ids,'review');hint=false;save();track('one_move_start',{technique:set.slug,mode:run.mode});render(true);
  });
  get('again').addEventListener('click',()=>{run=recommendedRun();hint=false;save();track('one_move_start',{technique:set.slug,mode:run.mode});render(true);});
}
