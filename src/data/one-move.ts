// Build-only: real engine snapshots; never ship the puzzle library to the client.
import { readFileSync } from 'node:fs';
import { PUZZLE_TECHNIQUES } from './puzzle-techniques.ts';
import { buildDrill } from './technique-drills.ts';
import { levelNames, type CaseSpec } from './teaching-cases.ts';
import { digitsOf } from '../engine/index.ts';
import type { OneMoveSet } from '../client/one-move-state.ts';

const lines = readFileSync('public/data/numpredo-puzzle-analysis.csv','utf8').trim().split('\n');
const header = lines.shift()!.split(',');
const catalog = lines.map(line => Object.fromEntries(header.map((key,i)=>[key,line.split(',')[i]])));

export function buildOneMoveSets(): OneMoveSet[] {
  return PUZZLE_TECHNIQUES.map(t => {
    const rows = catalog.filter(r => r.hardest_technique === t.key)
      .map(r => ({ n:Number(r.puzzle_id), steps:Number(r.logical_steps), level:r.level as CaseSpec['level'] }))
      .sort((a,b) => a.steps-b.steps || a.level.localeCompare(b.level) || a.n-b.n).slice(0, 5);
    if (rows.length !== 5) throw new Error(`Need five real examples: ${t.slug}`);
    return { version: 1, slug: t.slug, name: t.name, questions: rows.map(row => {
      const c = buildDrill({level:row.level,number:row.n,technique:t.key,heading:t.name,question:'指定されたマスの一手を選ぶ'});
      return { id:`${row.level}-${row.n}-${c.stepNumber}`, grid:c.before.grid,
        candidates:c.before.candidates.map(digitsOf), target:c.cell, answer:c.answer,
        options:c.options, placing:c.placing, marks:c.premise.cells,
        premise:c.premise.text, outcome:c.outcome, level:row.level,
        levelName:levelNames[row.level], number:row.n, stepNumber:c.stepNumber };
    }) };
  });
}
