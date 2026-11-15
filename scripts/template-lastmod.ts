// 共享模板的页面专属分支不应刷新其他页面；比较有效内容历史，也覆盖共享内容的删除。
import {execFileSync} from 'node:child_process';

export const CANDIDATE_ONLY_LINES = [
  /^\s*import CandidateCorrection from ['"]\.\/CandidateCorrection\.astro['"];?\s*$/,
  /^\s*\{slug\s*===\s*['"]candidate-update['"]\s*&&\s*<CandidateCorrection\s*\/>\}\s*$/,
];

export function templateLastmod(file:string, excludedLines:RegExp[]=[], cwd=process.cwd()):string {
  const git=(args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8'}).trimEnd();
  const history=git(['log','--format=%H%x09%cI','--',file]).split('\n').filter(Boolean).map(line=>{
    const [sha,date]=line.split('\t');return {sha,date};
  });
  if(!history.length)return '';
  if(!excludedLines.length)return history[0].date;
  const effective=(sha:string)=>git(['show',sha+':'+file]).split('\n')
    .filter(line=>line.trim()&&!excludedLines.some(re=>re.test(line))).join('\n');
  let newer=effective(history[0].sha);
  for(let i=1;i<history.length;i++){
    const older=effective(history[i].sha);
    if(newer!==older)return history[i-1].date;
    newer=older;
  }
  return history[history.length-1].date;
}
