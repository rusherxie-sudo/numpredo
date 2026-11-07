// NP01 synthetic-only browser contract. Never load third-party analytics.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.NP01_RUNNER+'/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox']});
const origin=process.env.NP01_ORIGIN||'http://127.0.0.1:4391';
const slice=process.argv[2]||'input';
let externalSuccess=0,blocked=0,collect=0;
const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true});
await c.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(/\/(?:g\/)?collect$/.test(u.pathname)){collect++;assert(!decodeURIComponent(q.url()+(q.postData()||'')).includes('NP01_SENTINEL'));return r.abort();}if(u.origin===origin)return r.continue();blocked++;return r.abort();});
c.on('response',r=>{if(new URL(r.url()).origin!==origin)externalSuccess++;});
await c.addInitScript(()=>{window.dataLayer=[];window.__prints=0;window.print=()=>window.__prints++;});
const p=await c.newPage();
const errors=[];p.on('pageerror',()=>errors.push('pageerror'));
const events=()=>p.evaluate(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).filter(x=>x[0]==='event').map(x=>({name:x[1],params:x[2]})));
async function game(path='/play/beginner/?n=1'){await p.goto(origin+path);await p.locator('.sk-cell').first().waitFor();}
async function move(){const m=await p.evaluate(async()=>{const {solveOne,gridFromString}=await import('/src/engine/index.ts');const r=document.querySelector('[data-sudoku]'),set=JSON.parse(r.dataset.set),n=Number(new URLSearchParams(location.search).get('n')||1)-1,q=set[n];const i=[...q.puzzle].findIndex(x=>!/[1-9]/.test(x));return {i,d:Number((q.solution||solveOne(gridFromString(q.puzzle)))[i])};});await p.locator('.sk-cell').nth(m.i).tap();await p.keyboard.press(String(m.d));}
try{
 if(slice==='input') {await game();await move();assert.equal((await events()).filter(e=>e.name==='puzzle_first_input').length,1,'first real valid input emits once');await p.getByRole('button',{name:'ヒント',exact:true}).click();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_hint'));assert.equal((await events()).filter(e=>e.name==='game_hint').length,1,'presented hint emits');assert(await p.evaluate(()=>JSON.parse(localStorage.getItem('numpredo.puzzle.beginner.1')).h===1),'hint persisted immediately');}
 if(slice==='return'){await game();await p.getByRole('button',{name:'ヒント',exact:true}).click();await p.getByRole('button',{name:'ヒント',exact:true}).click();const link=p.locator('[data-hint-practice]');await link.click();await p.locator('[data-learning-return]').waitFor();await p.locator('[data-learning-return]').click();await p.locator('.sk-cell').first().waitFor();await p.waitForFunction(()=>Array.from(window.dataLayer||[],x=>Array.from(x)).some(x=>x[1]==='game_learning_return'));assert.equal((await events()).filter(e=>e.name==='game_learning_return').length,1,'actual same saved game return');assert(await p.locator('.sk-left').evaluate(e=>e.classList.contains('sk-paused')),'return stays paused');await p.getByRole('button',{name:'再開',exact:true}).click();await move();assert.equal((await events()).filter(e=>e.name==='game_learning_input').length,1,'real post-return input');}
 if(slice==='pdf'){await p.goto(origin+'/print/progression/');const img=p.locator('figure img').first();await img.scrollIntoViewIfNeeded();await p.waitForTimeout(800);assert.equal((await events()).filter(e=>e.name==='pdf_preview_view').length,1,'loaded visible PDF preview');await p.locator('[data-pack-format]').first().click();assert.equal((await events()).filter(e=>e.name==='pdf_link_click').length,1,'PDF activation');await p.goto(origin+'/print/blank/');await p.locator('[data-blank-print]').click();assert.equal((await events()).filter(e=>e.name==='print_intent').length,1,'print intent before print');}
 if(slice==='privacy'){await p.goto(origin+'/print/?title=NP01_SENTINEL#NP01_SENTINEL');const config=await p.evaluate(()=>Array.from(window.dataLayer,x=>Array.from(x)).find(x=>x[0]==='config')?.[2]);assert.equal(config.page_location,origin+'/print/','config removes all query/hash');assert.equal(config.page_referrer,'','empty real referrer');await p.mouse.click(30,30);assert.equal(await p.locator('script[src*="hm.baidu"]').count(),0,'sensitive function page excludes Baidu');}
 assert.equal(externalSuccess,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({slice,pass:true,externalSuccess,blocked,collect,eventCounts:(await events()).reduce((a,e)=>(a[e.name]=(a[e.name]||0)+1,a),{})}));
}finally{await c.close();await browser.close();}
