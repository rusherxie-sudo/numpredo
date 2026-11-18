// 用行列坐标直接重算候选，独立于教学模块使用的求解器。
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beginnerWalkthrough, TUTORIAL_GAME, TUTORIAL_DOWNLOAD_DIR } from '../src/data/beginner-walkthrough.ts';

const lesson = beginnerWalkthrough();
const digits = [1,2,3,4,5,6,7,8,9];
const units = (cell: number) => {
  const row = Math.floor(cell / 9), col = cell % 9;
  return [digits.map((_,i)=>row*9+i), digits.map((_,i)=>i*9+col), digits.map((_,i)=>(Math.floor(row/3)*3+Math.floor(i/3))*9+Math.floor(col/3)*3+i%3)];
};
const candidates = (grid: number[], cell: number) => {
  const used = new Set(units(cell).flat().map(i=>grid[i]));
  return digits.filter(n=>!used.has(n));
};
let grid = lesson.initial.slice();
assert.equal(lesson.steps.length, 43);
assert.equal(grid.filter(Boolean).length, 38);
for (const step of lesson.steps) {
  assert.deepEqual(step.before, grid, '前一步必须连续');
  assert.equal(grid[step.cell], 0, '只能填空格');
  assert.deepEqual(candidates(grid,step.cell), [step.digit], '不依赖求解器重算的唯一候选');
  assert.deepEqual(step.candidateDigits, [step.digit]);
  assert.equal(step.technique, 'nakedSingle');
  units(step.cell).forEach((unit,i)=>assert.deepEqual(step.groups[i].digits,[...new Set(unit.map(c=>grid[c]).filter(Boolean))].sort((a,b)=>a-b)));
  grid[step.cell] = step.digit;
  assert.deepEqual(step.after, grid, '每一步只更改该空格');
  assert.equal(step.remaining, grid.filter(n=>n===0).length);
  lesson.initial.forEach((given,i)=>{if(given)assert.equal(grid[i],given,'原题数字不可改变');});
}
assert.equal(grid.join(''),lesson.solution);
for(let cell=0;cell<81;cell++) for(const unit of units(cell)) assert.deepEqual(unit.map(i=>grid[i]).sort((a,b)=>a-b),digits);
const hidden = lesson.hidden;
assert.deepEqual(units(hidden.cell)[0].filter(c=>lesson.initial[c]===0&&candidates(lesson.initial,c).includes(hidden.digit)),[hidden.cell]);
hidden.cells.forEach(c=>assert.deepEqual(c.candidates,candidates(lesson.initial,c.cell)));
assert.equal(lesson.steps[hidden.stepNumber-1].cell,hidden.cell);

const dir = 'public'+TUTORIAL_DOWNLOAD_DIR;
const manifest = JSON.parse(readFileSync(dir+'manifest.json','utf8'));
assert.equal(manifest.puzzle,lesson.puzzle);
assert.equal(manifest.solution,lesson.solution);
assert.equal(manifest.steps,lesson.steps.length);
assert.deepEqual(manifest.files.map((f:{name:string,pages:number})=>[f.name,f.pages]),[['questions.pdf',lesson.questionPages],['answers.pdf',lesson.answerPages]]);
for(const file of manifest.files){
  const bytes=readFileSync(dir+file.name);
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  assert.equal(bytes.length,file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,'PDF必须对应已校验清单');
}
const output='dist/guide/how-to-solve/index.html';
if(existsSync(output)){
  const html=readFileSync(output,'utf8');
  const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const checkSvg = (fragment: string, expected: number[], highlight?: number) => {
    const svgs=[...fragment.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)];
    assert.equal(svgs.length,1,'每幅棋盘必须有一张实际SVG');
    assert.equal(attrs(svgs[0][1]).viewBox,'0 0 336 336');
    const actual=Array(81).fill(0);
    for(const text of svgs[0][2].matchAll(/<text\b([^>]*)>([1-9])<\/text>/g)){
      const a=attrs(text[1]);
      const col=(Number(a.x)-24)/36,row=(Number(a.y)-24)/36;
      assert.ok(Number.isInteger(row)&&row>=0&&row<9&&Number.isInteger(col)&&col>=0&&col<9,'SVG数字必须位于棋格中心');
      const cell=row*9+col;
      assert.equal(actual[cell],0,'SVG同格不能有重复数字');
      assert.equal(Number(a['font-size']),20);
      assert.equal(Number(a['font-weight']),lesson.initial[cell]?700:500,'原题与填入数字的字重必须区分');
      actual[cell]=Number(text[2]);
    }
    assert.deepEqual(actual,expected,'实际SVG棋盘与本步不一致');
    const highlights=[...svgs[0][2].matchAll(/<rect\b([^>]*)\/?\s*>/g)].map(m=>attrs(m[1])).filter(a=>a.width==='36'&&a.height==='36');
    assert.equal(highlights.length,highlight===undefined?0:1,'本步必须且只能高亮目标格');
    if(highlight!==undefined){assert.equal(Number(highlights[0].x),6+highlight%9*36);assert.equal(Number(highlights[0].y),6+Math.floor(highlight/9)*36);assert.ok(highlights[0].fill&&highlights[0].fill!=='none');}
  };
  const checkTutorialHtml=(source: string)=>{
    const articles=[...source.matchAll(/<article\b[^>]*data-tutorial-step="(\d+)"[^>]*>([\s\S]*?)<\/article>/g)];
    assert.deepEqual(articles.map(m=>Number(m[1])),lesson.steps.map(s=>s.number));
    lesson.steps.forEach((step,i)=>{
      const body=articles[i][2];
      assert.ok(body.includes(step.number+'手目：'+step.location+'に'+step.digit+'を入れる'),'实际标题必须对应本步');
      for(const reason of step.reasoning)assert.ok(body.includes(reason),'第'+step.number+'步缺少实际完整理由：'+reason);
      assert.ok(body.includes('残り'+step.remaining+'マス'),'剩余空格数错误');
      checkSvg(body,step.after,step.cell);
    });
  };
  checkTutorialHtml(html);
  // 反例只在内存修改，必须拦住丢失棋盘或被改错的正文。
  assert.throws(()=>checkTutorialHtml(html.replace(/<svg\b[\s\S]*?<\/svg>/g,'')),/SVG/);
  assert.throws(()=>checkTutorialHtml(html.replace(lesson.steps[0].reasoning[0],'1行目にある数字：1。')),/完整理由/);
  const opening=html.match(/<figure\b[^>]*id="tutorial-start"[^>]*>([\s\S]*?)<\/figure>/);
  const complete=html.match(/<section\b[^>]*id="tutorial-complete"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(opening&&complete);
  checkSvg(opening[1],lesson.initial);
  checkSvg(complete[1],grid);
  assert.ok(html.includes('href="'+TUTORIAL_GAME+'"'));
  for(const file of manifest.files)assert.ok(html.includes(TUTORIAL_DOWNLOAD_DIR+file.name));
  assert.ok(html.includes('id="tutorial-complete"')&&html.includes('id="advanced-techniques"'));
  for(const route of ['play/beginner','play/intermediate','guide/tips']) assert.ok(readFileSync('dist/'+route+'/index.html','utf8').includes('/guide/how-to-solve/#beginner-walkthrough'),route+'缺少完整教程入口');
}
console.log(JSON.stringify({tutorial:lesson.number,givens:38,steps:lesson.steps.length,independentCandidateChecks:43,pdfs:manifest.files.map((f:{name:string,pages:number})=>({name:f.name,pages:f.pages})),staticHtmlChecked:existsSync(output)}));
