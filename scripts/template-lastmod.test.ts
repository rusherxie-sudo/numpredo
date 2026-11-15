import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {templateLastmod,CANDIDATE_ONLY_LINES} from './template-lastmod.ts';
const dir=mkdtempSync(join(tmpdir(),'numpredo-template-lastmod-'));
const git=(args:string[],env:Record<string,string>={})=>execFileSync('git',args,{cwd:dir,encoding:'utf8',env:{...process.env,...env}}).trim();
const file='template.astro';
const baseline='<h1>共有本文</h1>\n<p>削除する共有文</p>\n';
const exclusive="import CandidateCorrection from './CandidateCorrection.astro';\n{slug==='candidate-update'&&<CandidateCorrection />}\n";
const dates=['2026-11-01T01:00:00+00:00','2026-11-02T01:00:00+00:00','2026-11-03T01:00:00+00:00','2026-11-04T01:00:00+00:00','2026-11-05T01:00:00+00:00'];
function commit(content:string,n:number){writeFileSync(join(dir,file),content);git(['add',file]);git(['commit','-qm','fixture '+n],{GIT_AUTHOR_DATE:dates[n],GIT_COMMITTER_DATE:dates[n]});}
try{
 git(['init','-q']);git(['config','user.email','fixture@example.invalid']);git(['config','user.name','fixture']);
 commit(baseline,0);
 commit(exclusive+baseline,1);
 assert.equal(templateLastmod(file,[],dir),dates[1]);
 assert.equal(templateLastmod(file,CANDIDATE_ONLY_LINES,dir),dates[0]);
 assert.equal(templateLastmod(file,CANDIDATE_ONLY_LINES,dir),dates[0]); // 后续每日重跑仍稳定
 commit(exclusive+'<h1>共有本文</h1>\n',2); // 共享删除必须记作真实更新
 assert.equal(templateLastmod(file,CANDIDATE_ONLY_LINES,dir),dates[2]);
 commit('<h1>共有本文</h1>\n',3); // 删除专属分支不刷新别的页面
 assert.equal(templateLastmod(file,CANDIDATE_ONLY_LINES,dir),dates[2]);
 assert.equal(templateLastmod(file,[],dir),dates[3]);
 commit(exclusive+'<h1>共有本文改訂</h1>\n',4); // 混合提交不能忽略共享变更
 assert.equal(templateLastmod(file,CANDIDATE_ONLY_LINES,dir),dates[4]);
 console.log('PASS: exclusive insertion/removal, repeated generation, shared deletion and mixed changes');
}finally{rmSync(dir,{recursive:true,force:true});}
