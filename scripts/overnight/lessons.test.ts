import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS} from '../../src/data/expansion/lessons.ts';
import {MODELS,localAssignments,counterModel} from '../../src/data/expansion/models.ts';
import {modelDiagram} from '../../src/data/expansion/model-diagrams.ts';
import {teachingCase} from '../../src/data/teaching-cases.ts';
import {TECHNIQUE_NAMES,bit} from '../../src/engine/index.ts';
const removals:Record<string,[number,number][]>={claiming:[[11,7]],'hidden-triple':[[0,4],[1,5],[2,6]],'naked-quad':[[4,1]],'hidden-quad':[[0,5],[1,6],[2,7],[3,8]],'xyz-wing':[[11,3]],'two-string-kite':[[70,5]]};
for(const lesson of LESSONS)test(`${lesson.slug}: numerical premises, counterexample and displayed teaching source`,()=>{
 assert.equal(lesson.checks?.length,3);assert.equal(lesson.sections.length,7);
 if(lesson.model){
  const m=MODELS[lesson.model];assert(localAssignments(m)>0,'premises have a model');
  for(const [cell,digit] of removals[lesson.model]){assert(m.cells.find(c=>c.cell===cell)?.values.includes(digit));assert.equal(localAssignments({...m,target:cell},digit),0,`r${Math.floor(cell/9)+1}c${cell%9+1}: remove ${digit}`);}
  const counter=counterModel(lesson.model).model;assert(localAssignments(counter,counter.digit)>0,'target survives with weakened premise');
  const svg=modelDiagram(m,'test',true);assert(svg.includes(m.boolean?`${m.digit}なし`:'<path'),'result shows actual removal');
  if(['hidden-triple','naked-quad','hidden-quad','xyz-wing','two-string-kite'].includes(lesson.model))assert(!TECHNIQUE_NAMES.includes({'hidden-triple':'hiddenTriple','naked-quad':'nakedQuad','hidden-quad':'hiddenQuad','xyz-wing':'xyzWing','two-string-kite':'twoStringKite'}[lesson.model]!),'local-only techniques are not claimed as engine features');
 }else if(lesson.source){
  assert(TECHNIQUE_NAMES.includes(lesson.source.technique));const c=teachingCase({...lesson.source,heading:'audit',question:'audit'});
  assert.equal(c.step.technique,lesson.source.technique);
  if(c.step.cell!=null){assert.equal(c.step.digit,Number(c.raw.solution[c.step.cell]));assert(c.before.candidates[c.step.cell]&bit(c.step.digit!));}
  for(const [cell,digit] of c.step.eliminations??[])assert.notEqual(digit,Number(c.raw.solution[cell]));
 }else{
  assert.equal(lesson.slug,'killer-45-rule');assert.equal(45-(10+14+15),6);assert.equal(52-45,7);
  const row=[1,9,2,5,7,3,4,8,6];assert.equal(new Set(row).size,9);assert.equal(row.slice(0,2).reduce((a,b)=>a+b),10);assert.equal(row.slice(2,5).reduce((a,b)=>a+b),14);assert.equal(row.slice(5,8).reduce((a,b)=>a+b),15);
  // Row + intersecting block has 15 cells, with three counted twice.
  const r=new Set([0,1,2,3,4,5,6,7,8]),b=new Set([0,1,2,9,10,11,18,19,20]);assert.equal(new Set([...r,...b]).size,15);
 }
});
