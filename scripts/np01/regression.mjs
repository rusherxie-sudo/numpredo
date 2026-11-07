import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {solveOne,gridFromString,STANDARD_CONTEXT} from '../../src/engine/index.ts';
const require=createRequire(process.env.NP01_RUNNER+'/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
const origin=process.env.NP01_ORIGIN||'http://127.0.0.1:4391';
let externalSuccess=0,blocked=0,collect=0,tests=0;
const summaries=[];
async function run(name,fn,width=390,mode='normal'){
 if(process.env.NP01_FILTER&&!name.includes(process.env.NP01_FILTER))return;
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900},hasTouch:width===390});
 await c.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(/\/(?:g\/)?collect$/.test(u.pathname)){collect++;const raw=decodeURIComponent(q.url()+(q.postData()||''));assert(!raw.includes('NP01_SENTINEL'),'no sentinel in any collect');assert(!/"(?:grid|user_id|href|title)"/.test(raw),'no forbidden business field');return r.fulfill({status:204,body:''});}if(u.origin===origin)return r.continue();blocked++;return r.abort();});
 c.on('response',r=>{if(new URL(r.url()).origin!==origin)externalSuccess++;});
 const observed=[];await c.exposeBinding('__np01Event',(_,name)=>{if(typeof name==='string'&&/^[a-z0-9_]+$/.test(name))observed.push(name);});
 await c.addInitScript(({mode})=>{
  window.dataLayer=[];window.__prints=0;window.print=()=>{window.__prints++;if(mode==='print-throws')throw Error('synthetic');};
  if(mode==='storage'||mode==='session-storage'){
   for(const k of mode==='storage'?['localStorage','sessionStorage']:['sessionStorage'])Object.defineProperty(window,k,{get(){throw Error('synthetic');}});
  }
  if(mode==='track')window.dataLayer.push=()=>{throw Error('synthetic');};
  if(mode==='transport'){
   // Explicit test double, not gtag serialization or a Google receiver.
   window.dataLayer.push=function(...items){for(const item of items){const a=Array.from(item);if(a[0]==='config'||a[0]==='event')fetch('/g/collect',{method:'POST',body:JSON.stringify({command:a[0],name:a[0]==='event'?a[1]:'config',params:a[2]})}).catch(()=>{});}return Array.prototype.push.apply(this,items);};
  }
  if(mode!=='track'){const push=window.dataLayer.push;window.dataLayer.push=function(...items){for(const x of items)if(x[0]==='event')window.__np01Event(x[1]);return push.apply(this,items);};}
 },{mode});
 c.setDefaultTimeout(7000);c.setDefaultNavigationTimeout(10000);
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push((e.stack||'').split('\n').slice(1,5).map(x=>x.replace(/http[^ )]+/g,u=>{try{return new URL(u).pathname}catch{return '[local]'}})).join(' ')||'inline'));
 const ev=()=>p.evaluate(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).filter(x=>x[0]==='event').map(x=>({name:x[1],params:x[2]})));
 const count=async n=>(await ev()).filter(x=>x.name===n).length;
 const allCount=n=>observed.filter(x=>x===n).length;
 const goto=async path=>{await p.goto(origin+path);await p.locator('[data-sudoku] .sk-cell').first().waitFor();};
 const q=async()=>{const d=await p.evaluate(()=>{const r=document.querySelector('[data-sudoku]'),s=JSON.parse(r.dataset.set);let i=Number(new URLSearchParams(location.search).get('n')||1)-1;if(r.dataset.daily==='1'){const tab=Number(document.querySelector('.sk-dtab.on')?.dataset.tab||0),day=r.dataset.archive==='1'?Math.floor(Date.parse(new URLSearchParams(location.search).get('d')+'T00:00:00Z')/86400000):Math.floor((Date.now()+32400000)/86400000);i=(day-Number(r.dataset.daystart))*7+tab;}return {p:s[i].puzzle,level:r.dataset.level};});return {...d,g:gridFromString(d.p),sol:solveOne(gridFromString(d.p))};};
 const write=async(i,d,touch=false)=>{const cell=p.locator('.sk-cell').nth(i);if(touch)await cell.tap();else await cell.click();if(touch)await p.locator('.sk-key').nth(d-1).tap();else await p.keyboard.press(String(d));};
 const move=async(touch=false)=>{const d=await q(),i=d.g.indexOf(0);await write(i,d.sol[i],touch);return {i,d:d.sol[i]};};
 const hint=()=>p.getByRole('button',{name:'ヒント',exact:true}).click();
 const restart=()=>p.getByRole('button',{name:'やり直す',exact:true}).click();
 try{console.log(JSON.stringify({name,width,started:true}));await fn({p,c,ev,count,allCount,goto,q,write,move,hint,restart});assert.deepEqual(errors,[],name+' page errors');tests++;summaries.push({name,width,pass:true,eventCounts:(await ev()).reduce((a,e)=>(a[e.name]=(a[e.name]||0)+1,a),{})});console.log(JSON.stringify(summaries.at(-1)));}finally{await c.close();}
}
try{
for(const width of [390,1440]){
 await run('input exclusions, conflict then valid, hint guard and undo',async({p,count,goto,q,write,move,hint})=>{
  await goto('/play/beginner/?n=1');const d=await q(),i=d.g.indexOf(0),fixed=d.g.findIndex(v=>v>0);
  await write(fixed,d.g[fixed]);assert.equal(await count('puzzle_first_input'),0);
  await p.locator('.sk-cell').nth(i).click();await p.getByRole('button',{name:'メモ',exact:true}).click();await p.keyboard.press(String(d.sol[i]));assert.equal(await count('puzzle_first_input'),0);
  await p.getByRole('button',{name:'メモ',exact:true}).click();await p.keyboard.press('Delete');await p.getByRole('button',{name:'一時停止',exact:true}).click();await p.keyboard.press('1');await hint();assert.equal(await count('game_hint'),0);await p.getByRole('button',{name:'再開',exact:true}).click();
  const peer=STANDARD_CONTEXT.peers[i].find(j=>d.g[j]>0);await write(i,d.g[peer]);assert.equal(await count('puzzle_first_input'),0,'conflict is excluded');await p.keyboard.press('Delete');
  await write(i,d.sol[i],width===390);assert.equal(await count('puzzle_first_input'),1);await p.keyboard.press(String(d.sol[i]));await p.keyboard.press('0');await p.getByRole('button',{name:'元に戻す',exact:true}).click();assert.equal(await count('puzzle_first_input'),1);assert.equal(await count('game_start'),1);assert.equal(await count('page_view'),0);
 },width);
 await run('A B A, refresh, restart and hint phase',async({p,count,goto,move,hint})=>{
  await goto('/play/beginner/?n=1');await move();await hint();await hint();await hint();
  await p.locator('[data-sudoku]').evaluate(r=>r.dispatchEvent(new CustomEvent('puzzle-select',{detail:2})));await move();await p.locator('[data-sudoku]').evaluate(r=>r.dispatchEvent(new CustomEvent('puzzle-select',{detail:1})));assert.equal(await count('puzzle_first_input'),2);await hint();assert.equal(await p.locator('[data-hint-practice]').count(),0,'hint reset to stage one on switch');
  await p.reload();await p.locator('.sk-cell').first().waitFor();await move();assert.equal(await count('puzzle_first_input'),0);await p.getByRole('button',{name:'最初から',exact:true}).click();await move();assert.equal(await count('puzzle_first_input'),1);assert.equal(await count('game_start'),1);
 },width);
 await run('learning practice state/time equal, return once and post-return input',async({p,count,allCount,goto,move,hint,q,write})=>{
  await goto('/play/intermediate/?n=37');await move();const d=await q(),i=d.g.findIndex((v,j)=>v===0&&j!==d.g.indexOf(0));await p.locator('.sk-cell').nth(i).click();await p.getByRole('button',{name:'メモ',exact:true}).click();await p.keyboard.press('1');await p.getByRole('button',{name:'メモ',exact:true}).click();await hint();await hint();
  await p.locator('[data-hint-practice]').waitFor();await p.waitForTimeout(100);await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').waitFor();
  assert.equal(allCount('game_learning_open'),1);assert.equal(allCount('hint_practice_click'),1);
  const before=await p.evaluate(()=>{const t=JSON.parse(sessionStorage.getItem('numpredo.learning.np01'));return JSON.parse(t.saved);});
  await p.locator('[data-om-start]').click();await p.locator('[data-om-game]:not([hidden])').waitFor();assert.equal(await count('one_move_start')+await count('one_move_resume'),1);
  await p.waitForTimeout(150);await p.locator('[data-learning-return]').click();await p.waitForTimeout(150);await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'),null,{timeout:3000}).catch(async e=>{console.log(await p.evaluate(()=>{const t=JSON.parse(sessionStorage.getItem('numpredo.learning.np01')||'null'),sv=t&&JSON.parse(localStorage.getItem(t.key)||'null');return {pending:!!t,visited:t?.visited,state:t?.state,rawEqual:t&&localStorage.getItem(t.key)===t.saved,revisionEqual:t?.revision===sv?.measurement?.revision,generationEqual:t?.generation===sv?.measurement?.generation,backEqual:t?.back===location.pathname+location.search+location.hash,paused:document.querySelector('.sk-left')?.classList.contains('sk-paused')};}));throw e;});assert.equal(await count('game_learning_return'),1);assert(await p.locator('.sk-left').evaluate(e=>e.classList.contains('sk-paused')));
  assert.equal(allCount('one_move_return'),1);
  const equal=await p.evaluate(b=>{const s=JSON.parse(localStorage.getItem('numpredo.puzzle.intermediate.37'));return ['p','c','n','e','h'].every(k=>s[k]===b[k]);},before);assert(equal,'board notes hint time equal');
  await p.reload();await p.waitForTimeout(150);assert.equal(await count('game_learning_return'),0);assert(await p.locator('.sk-left').evaluate(e=>e.classList.contains('sk-paused')));await p.getByRole('button',{name:'再開',exact:true}).click();await write(i,d.sol[i]);assert.equal(await count('game_learning_input'),1);await write(i,d.sol[i]);assert.equal(await count('game_learning_input'),1);
 },width);
}
await run('last input before complete, restored completion emits nothing; legacy unknown',async({p,c,goto,q,count,ev,write})=>{
 await goto('/play/beginner/?n=1');const d=await q(),i=d.g.indexOf(0);
 await c.addInitScript(({g,sol,i})=>{if(sessionStorage.__np01fixture)return;sessionStorage.__np01fixture='1';const c=[...sol];c[i]=0;localStorage.setItem('numpredo.puzzle.beginner.1',JSON.stringify({p:g.join(''),s:sol.join(''),c:c.join(''),n:Array(81).fill(0).join(','),e:1000,d:0}));},{g:d.g,sol:d.sol,i});
 await p.reload();await p.locator('.sk-cell').first().waitFor();await write(i,d.sol[i]);const es=await ev();assert(es.findIndex(e=>e.name==='puzzle_first_input')<es.findIndex(e=>e.name==='game_complete'));
 const complete=es.find(e=>e.name==='game_complete');assert.equal(complete.params.hint_used,'unknown');assert.equal(complete.params.input_observed,'yes');assert.equal(complete.params.measurement_version,'np01');await p.reload();await p.locator('.sk-cell').first().waitFor();assert.equal(await count('game_complete'),0);await write(i,d.sol[i]);assert.equal(await count('puzzle_first_input'),0);
});
await run('daily repeated slots and archive remain separate',async({p,goto,q,write,count,ev})=>{
 await goto('/daily/?tab=1');let d=await q();await write(d.g.indexOf(0),d.sol[d.g.indexOf(0)]);await p.locator('[data-tab="5"]').click();d=await q();await write(d.g.indexOf(0),d.sol[d.g.indexOf(0)]);await p.locator('[data-tab="1"]').click();assert.equal(await count('puzzle_first_input'),2);assert.deepEqual((await ev()).filter(e=>e.name==='puzzle_first_input').map(e=>e.params.daily_slot),[1,5]);await p.reload();await p.locator('.sk-cell').first().waitFor();assert.equal(await count('puzzle_first_input'),0);
 const yesterday=new Date(Date.now()+32400000-86400000).toISOString().slice(0,10);await goto('/daily/archive/?d='+yesterday+'&tab=5');d=await q();await write(d.g.indexOf(0),d.sol[d.g.indexOf(0)]);assert.equal((await ev()).find(e=>e.name==='puzzle_first_input').params.game_mode,'archive');
});
await run('guide return and browser back',async({p,goto,hint,count})=>{
 await goto('/play/beginner/?n=1');await hint();await hint();await p.waitForTimeout(100);await p.locator('.sk-hint a:not([data-hint-practice])').first().click();await p.locator('[data-learning-return]').waitFor();await p.goBack();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'));assert.equal(await count('game_learning_return'),1);
});
for(const invalid of ['expired','revision','missing','corrupt','other','generation'])await run('pending rejects '+invalid,async({p,goto,hint,count})=>{
 await goto('/play/beginner/?n=1');await hint();await hint();await p.waitForTimeout(100);await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').waitFor();
 const back=await p.evaluate(mode=>{const k='numpredo.learning.np01',t=JSON.parse(sessionStorage.getItem(k));if(mode==='expired')t.at-=7200001;if(mode==='revision'){const sv=JSON.parse(localStorage.getItem(t.key));sv.measurement.revision++;localStorage.setItem(t.key,JSON.stringify(sv));}if(mode==='missing')localStorage.removeItem(t.key);if(mode==='corrupt')localStorage.setItem(t.key,'{');if(mode==='generation')t.generation++;if(mode==='other')t.back='/play/beginner/?n=2#sudoku-game';sessionStorage.setItem(k,JSON.stringify(t));return mode==='other'?t.back:new URLSearchParams(location.search).get('return');},invalid);
 await goto(back);await p.waitForTimeout(150);assert.equal(await count('game_learning_return'),0);
});
for(const mode of ['storage','session-storage','track'])await run('optional failure '+mode,async({p,goto,move,hint,count})=>{await goto('/play/beginner/?n=1');await move();await hint();await hint();await p.waitForTimeout(100);assert(await p.locator('[data-hint-practice]').count());await p.locator('[data-hint-practice]').click();await p.waitForURL('**/practice/**');if(mode==='storage'||mode==='session-storage'){await p.locator('[data-learning-return]').click();await p.waitForTimeout(200);assert.equal(await count('game_learning_return'),0);}},390,mode);
await run('write failure keeps memory authoritative over legacy storage',async({p,c,goto,q,move,hint,count,allCount})=>{
 await goto('/play/beginner/?n=1');const d=await q();
 await c.addInitScript(({g,sol})=>{if(!sessionStorage.__quotaSeed){localStorage.setItem('numpredo.puzzle.beginner.1',JSON.stringify({p:g.join(''),s:sol.join(''),c:g.join(''),n:Array(81).fill(0).join(','),e:0,d:0}));sessionStorage.__quotaSeed='1';}Storage.prototype.setItem=function(){throw Error('synthetic quota');};},{g:d.g,sol:d.sol});
 await p.reload();await p.locator('.sk-cell').first().waitFor();await move();await p.locator('[data-sudoku]').evaluate(r=>r.dispatchEvent(new CustomEvent('puzzle-select',{detail:2})));await move();await p.locator('[data-sudoku]').evaluate(r=>r.dispatchEvent(new CustomEvent('puzzle-select',{detail:1})));await move();assert.equal(await count('puzzle_first_input'),2);await hint();await hint();await p.locator('[data-hint-practice]').waitFor();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').waitFor();assert.equal(allCount('game_learning_open'),0);
});
await run('embed still no analytics',async({p,ev})=>{await p.goto(origin+'/embed/mini4/');await p.locator('.vg-cell').first().waitFor();await p.locator('.vg-cell').first().click();await p.keyboard.press('1');assert.equal((await ev()).length,0);assert.equal(await p.locator('script[src*="google"],script[src*="baidu"]').count(),0);});
for(const path of ['/','/play/','/play/advanced/','/play/hard/','/play/extreme/'])await run('standard route '+path,async({goto,move,ev,count})=>{await goto(path);await move();assert.equal(await count('puzzle_first_input'),1);assert((await ev()).find(e=>e.name==='puzzle_first_input').params.game_level);});
await run('PDF loaded preview once and keyboard/middle activation legacy scope',async({p,count,ev})=>{
 await p.goto(origin+'/print/progression/');const img=p.locator('figure img').first();await img.scrollIntoViewIfNeeded();await p.waitForTimeout(500);assert.equal(await count('pdf_preview_view'),1);
 if(process.env.NP01_BUILT){
  const file=readdirSync('dist/_astro').find(n=>n.startsWith('pdf-measurement.')&&n.endsWith('.js'));
  const alias=readFileSync('dist/_astro/'+file,'utf8').match(/export\{\w+ as (\w+)\}/)?.[1];assert(alias,'real built PDF module export');
  await p.evaluate(async({file,alias})=>{for(const suffix of ['?double=1','?double=2']){const m=await import('/_astro/'+file+suffix);m[alias]();m[alias]();}},{file,alias});
 }else await p.evaluate(async()=>{const m=await import('/src/client/pdf-measurement.ts');m.initPdfMeasurement();m.initPdfMeasurement();});
 await p.evaluate(()=>{document.addEventListener('click',e=>{if(e.target.closest('a[href$=".pdf"]'))e.preventDefault();});document.addEventListener('auxclick',e=>e.preventDefault());});
 const preview=p.locator('figure a').first();await preview.focus();await p.keyboard.press('Enter');assert.equal(await count('pdf_link_click'),1);assert.equal(await count('print_pdf_download'),0);
 await preview.click({button:'middle'});assert.equal(await count('pdf_link_click'),2);assert.equal(await count('print_pdf_download'),0);
 await p.locator('[data-pack-format]').first().click();assert.equal(await count('pdf_link_click'),3);assert.equal(await count('print_pdf_download'),1);assert.deepEqual((await ev()).filter(e=>e.name==='pdf_link_click').map(e=>e.params.pdf_entry),['preview','preview','download']);
 await p.evaluate(()=>scrollTo(0,0));await img.scrollIntoViewIfNeeded();await p.waitForTimeout(150);assert.equal(await count('pdf_preview_view'),1);
});
for(const path of ['/print/beginner/','/print/senior/','/print/6x6/','/print/candidate-notes/'])await run('resource '+path,async({p,count,ev})=>{
 await p.goto(origin+path);await p.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('a[href$=".pdf"]'))e.preventDefault();}));
 const link=p.locator('a[href$=".pdf"]').first();await link.click();assert.equal(await count('pdf_link_click'),1);assert.equal(await count('print_pdf_download'),1);
});
await run('previews hidden until loaded and visible, answers independent',async({p,count})=>{
 await p.goto(origin+'/print/candidate-notes/');assert.equal(await count('pdf_preview_view'),0);const first=p.locator('figure img').first();await first.scrollIntoViewIfNeeded();await p.waitForTimeout(500);assert.equal(await count('pdf_preview_view'),1);
 const details=p.locator('details').filter({has:p.locator('img')});await details.locator('summary').click();await details.locator('img').scrollIntoViewIfNeeded();await p.waitForTimeout(500);assert.equal(await count('pdf_preview_view'),2);
});
for(const path of ['/print/blank/','/print/techniques/','/print/beginner/'])await run('print stub '+path,async({p,count})=>{
 await p.goto(origin+path);const button=p.locator(path==='/print/blank/'?'[data-blank-print]':path==='/print/techniques/'?'[data-print-drill]' :'#print-go');await button.first().click();await p.waitForFunction(()=>window.__prints===1);assert.equal(await count('print_intent'),1);if(path==='/print/beginner/'){assert.equal(await count('print_pdf'),1);assert.equal(await count('print_generate'),1);}await p.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await count('print_intent'),1);
},1440,'print-throws');
await run('nonconflicting wrong digit counts; correction hints each persist',async({p,goto,q,write,count,hint})=>{
 await goto('/play/intermediate/?n=37');const d=await q();let pick;
 for(let i=0;i<81&&!pick;i++)if(!d.g[i])for(let n=1;n<=9;n++)if(n!==d.sol[i]&&!STANDARD_CONTEXT.peers[i].some(j=>d.g[j]===n)){pick={i,n};break;}
 assert(pick);await write(pick.i,pick.n);assert.equal(await count('puzzle_first_input'),1);await hint();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_hint'));await hint();await p.waitForTimeout(100);assert.equal(await count('game_hint'),2);assert(await p.evaluate(()=>JSON.parse(localStorage.getItem('numpredo.puzzle.intermediate.37')).h===1));
});
for(const h of [0,1])await run('legacy completed hint flag '+h,async({p,c,goto,q,write,ev,count})=>{
 await goto('/play/beginner/?n=1');const d=await q(),i=d.g.indexOf(0);
 await c.addInitScript(({g,sol,i,h})=>{if(sessionStorage.__seed)return;sessionStorage.__seed='1';const a=[...sol];a[i]=0;localStorage.setItem('numpredo.puzzle.beginner.1',JSON.stringify({p:g.join(''),s:sol.join(''),c:a.join(''),n:Array(81).fill(0).join(','),d:0,e:1000,h}));},{g:d.g,sol:d.sol,i,h});
 await p.reload();await p.locator('.sk-cell').first().waitFor();await write(i,d.sol[i]);assert.equal((await ev()).find(e=>e.name==='game_complete').params.hint_used,h?'yes':'no');
});
await run('daily pending cannot cross JST date',async({p,c,goto,hint,count})=>{
 await goto('/daily/?tab=1');await hint();await hint();await p.locator('[data-hint-practice]').waitFor();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').waitFor();const back=await p.locator('[data-learning-return]').getAttribute('href');
 await c.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+86400000]));}static now(){return D.now()+86400000;}};});
 await goto(back);await p.waitForTimeout(200);assert.equal(await count('game_learning_return'),0);
});
await run('already open daily cannot start a false trip after JST rollover',async({p,goto,hint,count,allCount})=>{
 await goto('/daily/?tab=1');await p.evaluate(()=>{const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+86400000]));}static now(){return D.now()+86400000;}};});await hint();await hint();await p.locator('[data-hint-practice]').waitFor();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').waitFor();assert.equal(allCount('game_learning_open'),0);assert.equal(await p.evaluate(()=>sessionStorage.getItem('numpredo.learning.np01')),null);
});
await run('direct guide creates no trip',async({p,count})=>{await p.goto(origin+'/guide/techniques/naked-single/');assert.equal(await p.locator('[data-learning-return]').count(),0);assert.equal(await count('game_learning_open')+await count('game_learning_return'),0);});
await run('failed preview has no exposure',async({p,count})=>{await p.route('**/images/print/*-preview.png',r=>r.abort());await p.goto(origin+'/print/progression/');await p.locator('figure img').first().scrollIntoViewIfNeeded();await p.waitForTimeout(300);assert.equal(await count('pdf_preview_view'),0);});
for(const [path,selector,kind] of [['/variants/4x4/','[data-mini4-print]','mini4'],['/variants/6x6/','[data-mini6-print]','mini6'],['/variants/16x16/','[data-print-sample]','solver16'],['/tools/generator/','#pg-print','generator']])await run('other print '+kind,async({p,count,ev})=>{await p.goto(origin+path);await p.locator(selector).first().click();await p.waitForFunction(()=>window.__prints===1);assert.equal(await count('print_intent'),1);assert.equal((await ev()).find(e=>e.name==='print_intent').params.print_kind,kind);});
await run('PDF and print survive throwing tracking queue',async({p,count})=>{
 await p.goto(origin+'/print/progression/');const [download]=await Promise.all([p.waitForEvent('download'),p.locator('[data-pack-format]').first().click()]);assert(download);
 await p.goto(origin+'/print/blank/');await p.locator('[data-blank-print]').click();assert.equal(await p.evaluate(()=>window.__prints),1);assert.equal(await count('print_intent'),0);
},390,'track');
await run('all local collect boundary with synthetic URL/referrer; no official consumer',async({p,goto,move,ev})=>{
 await p.goto(origin+'/guide/rules/?unknown=NP01_SENTINEL');await p.goto(origin+'/play/beginner/?n=1&title=NP01_SENTINEL#grid=NP01_SENTINEL',{referer:origin+'/guide/rules/?unknown=NP01_SENTINEL'});await p.locator('.sk-cell').first().waitFor();await move();await p.waitForTimeout(200);const conf=await p.evaluate(()=>Array.from(window.dataLayer,x=>Array.from(x)).find(x=>x[0]==='config')[2]);assert(!JSON.stringify(conf).includes('NP01_SENTINEL'));assert.equal(conf.page_referrer,origin+'/guide/rules/');assert.equal(await p.locator('script[src*="hm.baidu"]').count(),0);assert(!JSON.stringify(await ev()).includes('NP01_SENTINEL'));await p.goto(origin+'/print/?title=NP01_SENTINEL&unknown=NP01_SENTINEL#grid=NP01_SENTINEL');await p.locator('#print-go').click();await p.waitForFunction(()=>window.__prints===1);assert(!JSON.stringify(await ev()).includes('NP01_SENTINEL'));
},1440,'transport');
assert.equal(externalSuccess,0);console.log(JSON.stringify({pass:true,tests,externalSuccess,blocked,collect,evidence:'local queue and explicit test double only'}));
}finally{await browser.close();}
