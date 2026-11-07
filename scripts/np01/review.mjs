// Review regressions: real local UI, fresh context, all external traffic blocked first.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {solveOne,gridFromString} from '../../src/engine/index.ts';
const require=createRequire(process.env.NP01_RUNNER+'/package.json'),{chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
const origin=process.env.NP01_ORIGIN||'http://127.0.0.1:4393',filter=process.env.NP01_FILTER||'';
let failures=0,blocked=0,externalSuccess=0;
async function run(name,fn,width=390,chunk=''){
 if(filter&&!name.includes(filter))return;
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900}}),events=[],failedChunks=[];
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin||/\/(?:g\/)?collect$/.test(u.pathname)){blocked++;return r.abort();}if(chunk&&u.pathname.includes(chunk)){failedChunks.push(u.pathname);return r.fulfill({status:404,body:'synthetic missing optional chunk'});}return r.continue();});
 c.on('response',r=>{if(new URL(r.url()).origin!==origin)externalSuccess++;});
 await c.exposeBinding('__reviewEvent',(_,n)=>events.push(n));
 await c.addInitScript(()=>{window.dataLayer=[];const push=window.dataLayer.push;window.dataLayer.push=function(...xs){for(const x of xs)if(x[0]==='event')window.__reviewEvent(x[1]);return push.apply(this,xs);};window.__prints=0;window.print=()=>window.__prints++;});
 c.setDefaultTimeout(4500);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.name));
 const count=n=>events.filter(e=>e===n).length;
 const game=async path=>{await p.goto(origin+path);await p.locator('.sk-cell').first().waitFor();await p.waitForTimeout(150);};
 const board=()=>p.locator('.sk-board').innerText();
 const move=async()=>{const info=await p.locator('[data-sudoku]').evaluate(r=>{const g=[...r.querySelectorAll('.sk-cell')].map(c=>Number(c.textContent.trim())||0);return g;});const sol=solveOne(info),i=info.indexOf(0);assert(sol);await p.locator('.sk-cell').nth(i).click();await p.keyboard.press(String(sol[i]));assert.equal((await p.locator('.sk-cell').nth(i).innerText()).trim(),String(sol[i]),'real digit written');};
 const hint=()=>p.getByRole('button',{name:'ヒント',exact:true}).click();
 try{await fn({p,c,game,move,board,hint,count,failedChunks});assert.deepEqual(errors,[],'no unhandled page exceptions');console.log(JSON.stringify({name,width,pass:true,failedChunks:failedChunks.length}));}catch(e){failures++;console.log(JSON.stringify({name,width,pass:false,error:e.message}));}finally{await c.close();}
}
try{
for(const width of [390,1440]){
 await run('S1 sensitive guides before load and deferred recheck',async({p})=>{
  for(const path of ['/guide/techniques/naked-single/?return=%2Fplay%2F','/guide/newspaper/#synthetic']){await p.goto(origin+path);await p.mouse.click(10,10);assert.equal(await p.locator('script[src*="hm.baidu"]').count(),0,'sensitive guide cannot load Baidu');}
  await p.goto(origin+'/guide/techniques/naked-single/');await p.evaluate(()=>history.replaceState(null,'','?return=%2Fplay%2F'));await p.mouse.click(10,10);await p.waitForTimeout(8200);assert.equal(await p.locator('script[src*="hm.baidu"]').count(),0,'timer rechecks guide URL');
 },width);
 await run('L1 collection entry level-game to candidate and solver',async({p,game})=>{
  await p.goto(origin+'/guide/techniques/hidden-single/');const link=p.locator('a[href*="#level-game"]').first();await link.waitFor();const back=await link.getAttribute('href');await link.click();await p.locator('.sk-cell').first().waitFor();
  await p.getByRole('button',{name:'候補・次の一手',exact:true}).click();await p.locator('[data-learning-return]').waitFor();assert.equal(await p.locator('[data-learning-return]').getAttribute('href'),back.replace('#level-game','#sudoku-game'));
  await game(back);await p.getByRole('button',{name:'ソルバーで解説',exact:true}).click();await p.locator('[data-learning-return]').waitFor();assert.equal(await p.locator('[data-learning-return]').getAttribute('href'),back.replace('#level-game','#sudoku-game'));
 },width);
 for(const path of ['/','/play/'])await run('L2 current B refresh '+path,async({p,game,move,board,count})=>{
  await game(path);await move();const a=await board();await p.getByRole('button',{name:'別の問題',exact:true}).click();await move();const b=await board();assert(a!==b);assert.equal(count('puzzle_first_input'),2);await p.reload();await p.locator('.sk-cell').first().waitFor();assert((await board())===b,'refresh restores B instead of A per-puzzle slot');await move();assert.equal(count('puzzle_first_input'),2,'B first input remains deduplicated');
  await game(path+'?n=1');await move();assert.equal(count('puzzle_first_input'),2,'A first input remains deduplicated');
 },width);
 await run('L3 returned A survives B input then A input',async({p,game,hint,move,count})=>{
  await game('/play/beginner/?n=1');await hint();await hint();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').click();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'));assert.equal(count('game_learning_return'),1,'A return observed');await p.getByRole('button',{name:'再開',exact:true}).click();
  const select=async n=>p.locator('[data-sudoku]').evaluate((r,n)=>r.dispatchEvent(new CustomEvent('puzzle-select',{detail:n})),n);
  await select(2);await move();assert.equal(count('game_learning_input'),0,'B cannot claim A');assert(await p.evaluate(()=>!!sessionStorage.getItem('numpredo.learning.np01')),'B cannot consume A pending');await p.getByRole('button',{name:'最初から',exact:true}).click();assert(await p.evaluate(()=>!!sessionStorage.getItem('numpredo.learning.np01')),'restart B cannot invalidate A');await select(1);const resume=p.getByRole('button',{name:'再開',exact:true});if(await resume.isVisible())await resume.click();await move();assert.equal(count('game_learning_input'),1,'A post-learning input recorded');await move();assert.equal(count('game_learning_input'),1);
 },width);
 await run('L3 daily A survives B tab input then A input',async({p,game,hint,move,count})=>{
  await game('/daily/?tab=1');await hint();await hint();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').click();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'));await p.getByRole('button',{name:'再開',exact:true}).click();
  await p.locator('[data-tab="5"]').click();await move();assert.equal(count('game_learning_input'),0);assert(await p.evaluate(()=>!!sessionStorage.getItem('numpredo.learning.np01')),'B tab must preserve A trip');await p.locator('[data-tab="1"]').click();const resume=p.getByRole('button',{name:'再開',exact:true});if(await resume.isVisible())await resume.click();await move();assert.equal(count('game_learning_input'),1);
 },width);
}
await run('L3 returned proof with corrupted original puzzle cannot report input',async({p,game,hint,move,count})=>{
 await game('/play/beginner/?n=1');await hint();await hint();await p.locator('[data-hint-practice]').click();await p.locator('[data-learning-return]').click();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'));await p.getByRole('button',{name:'再開',exact:true}).click();
 await p.evaluate(()=>{const k='numpredo.learning.np01',t=JSON.parse(sessionStorage.getItem(k)),saved=JSON.parse(t.saved);saved.p='9'.repeat(81);t.saved=JSON.stringify(saved);sessionStorage.setItem(k,JSON.stringify(t));});await move();assert.equal(count('game_learning_input'),0,'damaged original proof cannot claim a valid learning input');
});
await run('D1 unresolved optional chunk cannot delay game setup',async({p,c,move})=>{let release;const pending=new Promise(r=>release=r);await c.route('**/np01-game.*',async r=>{await pending;await r.fulfill({status:404,body:'missing'}).catch(()=>{});});try{await p.goto(origin+'/play/beginner/',{waitUntil:'domcontentloaded'});await p.locator('.sk-cell').first().waitFor({timeout:1000});await move();}finally{release();}});
await run('D1 unresolved learning chunk cannot delay original hint',async({p,c,game,hint,move})=>{await game('/play/beginner/');let release;const pending=new Promise(r=>release=r);await c.route('**/game-learning.*',async r=>{await pending;await r.fulfill({status:404,body:'missing'}).catch(()=>{});});try{await hint();await p.locator('.sk-hint.on').waitFor({timeout:1000});await move();}finally{release();}});
for(const chunk of ['np01-game.','np01-track.','game-learning.'])await run('D1 game optional chunk 404 '+chunk,async({p,game,move,hint,count,failedChunks})=>{await game('/play/beginner/?n=1');await move();await hint();await p.waitForTimeout(200);await move();assert(failedChunks.length,'404 actually injected');assert.equal(count('game_learning_open'),0);if(chunk!=='game-learning.')assert.equal(count('puzzle_first_input'),0,'missing measurement does not report emission');},390,chunk);
for(const chunk of ['np01-track.','pdf-measurement.'])await run('D1 print optional chunk 404 '+chunk,async({p,count,failedChunks})=>{await p.goto(origin+'/print/');await p.locator('#print-go').waitFor();await p.locator('#print-go').click();await p.waitForFunction(()=>window.__prints===1);assert(failedChunks.length);assert.equal(count('print_generate'),1,'original generator event retained');assert.equal(count('pdf_link_click'),0);},390,chunk);
await run('T1 PDF actual Enter middle double init and legacy counts',async({p,count})=>{
 await p.goto(origin+'/print/progression/');await p.waitForTimeout(250);
 const file=readdirSync('dist/_astro').find(n=>n.startsWith('pdf-measurement.')&&n.endsWith('.js'));const source=readFileSync('dist/_astro/'+file,'utf8'),alias=source.match(/export\{\w+ as (\w+)\}/)?.[1];assert(alias,'compiled real module export');
 await p.evaluate(async({file,alias})=>{for(const query of ['?review=1','?review=2']){const m=await import('/_astro/'+file+query);m[alias]();m[alias]();}document.addEventListener('click',e=>{if(e.target.closest('a[href$=".pdf"]'))e.preventDefault();});document.addEventListener('auxclick',e=>e.preventDefault());},{file,alias});
 const preview=p.locator('figure a').first();await preview.focus();await p.keyboard.press('Enter');assert.equal(count('pdf_link_click'),1);assert.equal(count('print_pdf_download'),0);await preview.click({button:'middle'});assert.equal(count('pdf_link_click'),2);assert.equal(count('print_pdf_download'),0);await p.locator('[data-pack-format]').first().click();assert.equal(count('pdf_link_click'),3);assert.equal(count('print_pdf_download'),1);
});
assert.equal(externalSuccess,0);console.log(JSON.stringify({failures,blocked,externalSuccess,evidence:'local UI/queue only; no real gtag privacy claim'}));
}finally{await browser.close();}
process.exitCode=failures?1:0;
