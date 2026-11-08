import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const gate=resolve('scripts/check-release-candidate.sh'),sha='a'.repeat(40);
function run(mode,expected=sha){
 const dir=mkdtempSync(join(tmpdir(),'numpredo-gate-'));
 try{
  writeFileSync(join(dir,'git'),`#!/bin/bash
case "$1" in
 rev-parse) if [[ "$GATE_MODE" == wrong ]]; then printf '%040d\\n' 0; else echo "$GATE_SHA"; fi;;
 status) if [[ "$GATE_MODE" == status-error ]] || { [[ "$GATE_MODE" == final-status-error ]] && [[ -f "$GATE_LOG" ]]; }; then echo 'simulated git status failure' >&2; exit 128; fi
 if [[ "$GATE_MODE" == dirty ]] || { [[ "$GATE_MODE" == generated ]] && [[ -f "$GATE_LOG" ]]; }; then echo ' M changed'; fi;;
 *) exit 99;;
esac
`,{mode:0o755});
  for(const cmd of ['npm','node','python3'])writeFileSync(join(dir,cmd),`#!/bin/bash
echo "${cmd} $*" >> "$GATE_LOG"
[[ "$GATE_MODE" != failure || "$*" != 'run demo' ]]
`,{mode:0o755});
  const log=join(dir,'commands');const result=spawnSync('/bin/bash',[gate,expected],{encoding:'utf8',env:{...process.env,PATH:dir+':/usr/bin:/bin',GATE_MODE:mode,GATE_SHA:sha,GATE_LOG:log}});
  let commands='';try{commands=readFileSync(log,'utf8');}catch{}
  return {status:result.status,output:result.stdout+result.stderr,commands};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('exact clean SHA executes daily/type/engine/contracts/full build',()=>{const r=run('clean');assert.equal(r.status,0,r.output);assert(r.commands.startsWith('npm run check:daily\nnpm run check\nnpm run demo\nnode --test scripts/np01/contracts.test.ts '));assert(r.commands.includes('scripts/pwa/cohort.test.mjs\npython3 scripts/pwa/report.test.py\n'));assert(r.commands.endsWith('npm run build\nnode --test scripts/np01/output.test.ts\n'));});
for(const mode of ['wrong','dirty'])test(`reject ${mode} before checks`,()=>{const r=run(mode);assert.notEqual(r.status,0);assert.equal(r.commands,'');});
test('reject abbreviated SHA',()=>{const r=run('clean','abc');assert.notEqual(r.status,0);assert.equal(r.commands,'');});
test('failed engine blocks build and success',()=>{const r=run('failure');assert.notEqual(r.status,0);assert(!r.commands.includes('npm run build'));assert(!r.output.includes('Quality gate passed'));});
test('generated business differences block final success',()=>{const r=run('generated');assert.notEqual(r.status,0);assert(r.commands.includes('npm run build'));assert(!r.output.includes('Quality gate passed'));});
test('status read error rejects entry before any checks',()=>{
 const r=run('status-error');
 assert.equal(r.commands,'');
 assert.notEqual(r.status,0,r.output);
 assert(!r.output.includes('Quality gate passed'));
 assert.match(r.output,/simulated git status failure/);
 assert.match(r.output,/Failed to read candidate git status/);
});
test('status read error rejects final success after all checks',()=>{
 const r=run('final-status-error');
 const commands=r.commands.trimEnd().split('\n');
 assert.equal(commands.length,7,r.commands);
 assert.deepEqual(commands.slice(0,3),['npm run check:daily','npm run check','npm run demo']);
 assert(commands[3].startsWith('node --test scripts/np01/contracts.test.ts '));assert(r.commands.includes('scripts/pwa/cohort.test.mjs\npython3 scripts/pwa/report.test.py\n'));
 assert.deepEqual(commands.slice(4),['python3 scripts/pwa/report.test.py','npm run build','node --test scripts/np01/output.test.ts']);
 assert.notEqual(r.status,0,r.output);
 assert(!r.output.includes('Quality gate passed'));
 assert.match(r.output,/simulated git status failure/);
 assert.match(r.output,/Failed to read candidate git status/);
});
