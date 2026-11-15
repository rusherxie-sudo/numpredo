import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normalizeGrid, validateGrid, parseSource, sha256 } from '../src/server/public-puzzles/validation.ts';
import { handlePublicPuzzles, type Env, type Statement } from '../src/server/public-puzzles/service.ts';
import { SOLVER_SAMPLE } from '../src/data/solver-sample.ts';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('../migrations/0001_public_puzzles.sql',import.meta.url),'utf8'));
class Query implements Statement {
 values: unknown[] = [];
 sql: string;
 constructor(sql: string) { this.sql = sql; }
 bind(...values: unknown[]) { const q = new Query(this.sql); q.values = values; return q; }
 async first<T>() { return (sqlite.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null; }
 async all<T>() { return {results:sqlite.prepare(this.sql).all(...this.values as never[]) as T[]}; }
 async run() { return {meta:sqlite.prepare(this.sql).run(...this.values as never[])}; }
}
const env: Env = {PUBLIC_PUZZLES_ENABLED:'true',PUBLIC_PUZZLES_ADMIN_TOKEN:'test-only',PUBLIC_PUZZLES_RATE_LIMITER:{async limit(){return {success:true};}},PUBLIC_PUZZLES_DB:{prepare(sql){return new Query(sql);},async batch(queries){ sqlite.exec('BEGIN'); try { const results=[]; for(const q of queries) results.push(await q.run()); sqlite.exec('COMMIT'); return results; } catch(e) {sqlite.exec('ROLLBACK');throw e;} }}};
const puzzle='530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const solved='534678912672195348198342567859761423426853791713924856961537284287419635345286179';
assert.equal(validateGrid(puzzle).status,'unique');
assert.equal(validateGrid('0'.repeat(81)).status,'empty');
assert.equal(validateGrid(solved).status,'complete');
assert.equal(validateGrid('11'+'0'.repeat(79)).status,'conflict');
assert.equal(validateGrid('1'+'0'.repeat(80)).status,'multiple');
assert.equal(validateGrid('531070000'+puzzle.slice(9)).status,'unsolvable');
assert.equal(validateGrid(puzzle,1).status,'pending_validation');
assert.equal(validateGrid(normalizeGrid(SOLVER_SAMPLE)).status,'known_example');
assert.throws(()=>normalizeGrid('x'.repeat(81)));
assert.equal(normalizeGrid('.'.repeat(81)),'0'.repeat(81));
assert.throws(()=>parseSource({kind:'newspaper',publicationDate:'2026-02-30'}));
assert.throws(()=>parseSource({kind:'newspaper',publicationDate:'2999-01-01'}));
assert.throws(()=>parseSource({kind:'newspaper',doubleCells:[1,1]}));
assert.equal(parseSource({kind:'newspaper',publicationDate:'1900-01-01'})?.publicationDate,'1900-01-01');
const root='https://numpredo.com/api/public-puzzles';
async function req(path='', data?:unknown, admin=false, customEnv=env) {
 const response=await handlePublicPuzzles(new Request(root+path,data===undefined?{}:{method:'POST',headers:{origin:'https://numpredo.com','content-type':'application/json',...(admin?{authorization:'Bearer test-only'}:{})},body:JSON.stringify(data)}),customEnv);
 return {status:response.status,data:await response.json() as Record<string,any>};
}
const submission={grid:puzzle,inputMethod:'ocr',confirmed:true,noticeVersion:'2026-11-15',source:{kind:'newspaper',newspaper:'yomiuri',publicationDate:'2026-01-01',doubleCells:[0,80]}};
assert.equal((await req('',undefined,false,{})).status,503);
assert.equal((await req('',{...submission,confirmed:false})).status,422);
assert.equal((await req('',{...submission,grid:solved})).status,422);
assert.equal((await req('',submission,false,{...env,PUBLIC_PUZZLES_RATE_LIMITER:{async limit(){return {success:false};}}})).status,429);
for (const origin of [null,'https://evil.example']) {
 const headers: Record<string,string> = {'content-type':'application/json'}; if(origin) headers.origin=origin;
 assert.equal((await handlePublicPuzzles(new Request(root,{method:'POST',headers,body:JSON.stringify(submission)}),env)).status,403);
}
for (const contentLength of [undefined,'5000']) {
 const headers: Record<string,string> = {origin:'https://numpredo.com','content-type':'application/json'}; if(contentLength) headers['content-length']=contentLength;
 assert.equal((await handlePublicPuzzles(new Request(root,{method:'POST',headers,body:JSON.stringify({padding:'x'.repeat(5000)})}),env)).status,422);
}
const first=await req('',submission);
assert.equal(first.status,201); assert.equal(first.data.duplicate,false);
assert.equal(first.data.puzzleId,await sha256('standard-9x9:'+puzzle));
const again=await req('',{...submission,source:{kind:'newspaper',newspaper:'asahi',publicationDate:'2026-01-02'}});
assert.equal(again.data.puzzleId,first.data.puzzleId); assert.equal(again.data.duplicate,true);
assert.equal((await req()).data.items.length,0);
assert.equal((await req('/'+first.data.puzzleId)).status,404);
sqlite.prepare("UPDATE public_puzzles SET validation='pending_validation' WHERE id=?").run(first.data.puzzleId);
assert.equal((await req('/'+first.data.puzzleId+'/moderate',{status:'public',reason:'pending must stay hidden',rightsReviewed:true},true)).status,422);
sqlite.prepare("UPDATE public_puzzles SET validation='unique' WHERE id=?").run(first.data.puzzleId);
assert.equal((await req('/'+first.data.puzzleId+'/moderate',{status:'public',reason:'test',rightsReviewed:true})).status,401);
assert.equal((await req('/'+first.data.puzzleId+'/moderate',{status:'public',reason:'test'},true)).status,422);
assert.equal((await req('/'+first.data.puzzleId+'/moderate',{status:'public',reason:'test rights review',rightsReviewed:true},true)).status,200);
assert.equal((await req()).data.items.length,1);
const detail=(await req('/'+first.data.puzzleId)).data;
assert.equal(detail.grid,puzzle); assert.equal(detail.sources.length,2); assert.equal(detail.sources[0].verification,'unverified');
assert.equal(detail.withdrawToken,undefined);
assert.equal((await req('/'+first.data.puzzleId+'/review-source',{submissionId:first.data.submissionId,verification:'verified',reason:'checked'},true)).status,200);
assert.equal((await req('/'+first.data.puzzleId)).data.sources.find((s: any)=>s.newspaper==='yomiuri').verification,'verified');
assert.equal((await req('/'+first.data.puzzleId+'/withdraw',{submissionId:first.data.submissionId,withdrawToken:'wrong'})).status,404);
assert.equal((await req('/'+first.data.puzzleId+'/withdraw',first.data)).status,200);
assert.equal((await req('/'+first.data.puzzleId)).status,404);
assert.equal((await req()).data.items.length,0);
const third=await req('',submission); assert.equal(third.data.duplicate,true); assert.equal((await req('/'+first.data.puzzleId)).status,404);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM public_puzzles').get()?.n,1);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM public_puzzle_submissions').get()?.n,3);
await req('/'+first.data.puzzleId+'/withdraw',again.data);
await req('/'+first.data.puzzleId+'/withdraw',third.data);
assert.equal((await req('/'+first.data.puzzleId+'/moderate',{status:'public',reason:'no active submissions',rightsReviewed:true},true)).status,409);
assert.equal((await req('/'+first.data.puzzleId)).status,404);
// 整批投稿在第二条SQL失败时回滚题面，不能留下孤立候选。
sqlite.exec("CREATE TRIGGER reject_test_submission BEFORE INSERT ON public_puzzle_submissions BEGIN SELECT RAISE(ABORT,'test rollback'); END");
const swapped=puzzle.replace(/[12]/g,c=>c==='1'?'2':'1');
const before=sqlite.prepare('SELECT count(*) AS n FROM public_puzzles').get()?.n;
assert.equal((await req('',{...submission,grid:swapped})).status,503);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM public_puzzles').get()?.n,before);
sqlite.exec('DROP TRIGGER reject_test_submission');
assert.ok(Number(sqlite.prepare('SELECT count(*) AS n FROM public_puzzle_audit').get()?.n)>=5);
// 验证D1限流原子上限与未知配置关闭。
const d1Limited = {...env,PUBLIC_PUZZLES_RATE_LIMITER:undefined,PUBLIC_PUZZLES_RATE_SALT:'0123456789abcdef0123456789abcdef'};
for (let i=0;i<10;i++) assert.notEqual((await req('',{...submission,confirmed:false},false,d1Limited)).status,429);
assert.equal((await req('',submission,false,d1Limited)).status,429);
assert.equal((await req('',submission,false,{...d1Limited,PUBLIC_PUZZLES_RATE_SALT:undefined})).status,503);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM public_puzzle_rate_limits WHERE length(key)!=64').get()?.n,0);
// 多页同秒稳定倒序；相同时间以id打破平局。
const insert = sqlite.prepare("INSERT INTO public_puzzles(id,grid,validation,validation_version,status,created_at,updated_at) VALUES(?,?,'unique','test','public',?,?)");
for(let i=0;i<23;i++) {const id=i.toString(16).padStart(64,'0'); const grid=i.toString().padStart(81,'0'); insert.run(id,grid,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');}
const page1=(await req()).data; assert.equal(page1.items.length,20); assert.ok(page1.nextCursor);
const page2=(await req('?cursor='+encodeURIComponent(page1.nextCursor))).data; assert.equal(page2.items.length,3); assert.equal(page2.nextCursor,null);
assert.equal(new Set([...page1.items,...page2.items].map((x:any)=>x.id)).size,23);
assert.equal((await req('?cursor=bad')).status,400);
// 故障被转换为503。
assert.equal((await req('',submission,false,{...env,PUBLIC_PUZZLES_DB:{prepare(){throw Error('db down');},async batch(){return [];}}})).status,503);
console.log('公共题库校验、SQLite事务、去重、读取隔离、审核、来源并存与撤回检查通过');
sqlite.close();
