import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun,restoreRun,wrongIds,type OneMoveSet } from '../src/client/one-move-state.ts';
import { PUZZLE_TECHNIQUES } from '../src/data/puzzle-techniques.ts';
for(const t of PUZZLE_TECHNIQUES) {
  const set:OneMoveSet=JSON.parse(readFileSync(`public/data/one-move/${t.slug}.json`,'utf8'));
  const r=newRun(set);assert.equal(r.ids.length,5);assert.equal(new Set(r.ids).size,5);
  assert.deepEqual(restoreRun(JSON.stringify(r),set),r);
  const q=set.questions.find(q=>q.id===r.ids[0])!;
  r.answers[0]=q.options.find(d=>d!==q.answer)!;r.hints[0]=true;
  assert.deepEqual(wrongIds(r,set),[q.id]);assert.deepEqual(restoreRun(JSON.stringify(r),set),r);
  r.index=1;assert.deepEqual(restoreRun(JSON.stringify(r),set),r);
  for(const raw of ['broken','null','[]',JSON.stringify({...r,index:9}),JSON.stringify({...r,slug:'invalid'}),JSON.stringify({...r,ids:[r.ids[0],r.ids[0]]}),JSON.stringify({...r,answers:[9]}),JSON.stringify({...r,finished:true}),JSON.stringify({...r,hints:[]})]) assert.equal(restoreRun(raw,set),null);
  const review=newRun(set,wrongIds(r,set),'review');assert.equal(review.ids.length,1);assert.equal(review.answers[0],null);assert.deepEqual(restoreRun(JSON.stringify(review),set),review);
  review.answers[0]=q.answer;review.finished=true;assert.equal(wrongIds(review,set).length,0);assert.deepEqual(restoreRun(JSON.stringify(review),set),review);
  const stale={...r,ids:r.ids.map((id,i)=>i===0?'retired-position':id)};assert.equal(restoreRun(JSON.stringify(stale),set),null);
  const html=readFileSync(`dist/guide/techniques/${t.slug}/index.html`,'utf8');assert.ok(html.includes(`/practice/?tech=${t.slug}#one-move`));
}
const html=readFileSync('dist/practice/index.html','utf8');assert.ok(html.includes('data-one-move'));assert.ok(html.includes('data-practice'));assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('one-move/'));
console.log('✓ Nine technique sets: resumable answers/hints, invalid saves rejected, mistake-only review, tutorial links, original diagnostic retained');
