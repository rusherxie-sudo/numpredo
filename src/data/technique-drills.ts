import { teachingCase, type CaseSpec } from './teaching-cases.ts';
import { digitsOf } from '../engine/index.ts';

export const DRILL_SPECS: Record<string, CaseSpec[]> = {
  'hidden-single': [2, 3].map(number => ({ level: 'intermediate', number, technique: 'hiddenSingle', heading: '隠れた単数の練習', question: 'このマスに確定できる数字は？' })),
  pointing: [4, 5].map(number => ({ level: 'intermediate', number, technique: 'lockedCandidates', heading: '区画の絞り込みの練習', question: 'この一手で消せる候補は？' })),
  'naked-pair': [4, 8].map(number => ({ level: 'advanced', number, technique: 'nakedPair', heading: '二国同盟の練習', question: 'この一手で消せる候補は？' })),
};

export function buildDrill(spec: CaseSpec) {
  const lesson = teachingCase(spec);
  const placing = lesson.step.cell != null;
  const [cell, answer] = placing ? [lesson.step.cell!, lesson.step.digit!] : lesson.step.eliminations![0];
  const removed = new Set((lesson.step.eliminations ?? []).filter(([c]) => c === cell).map(([,d]) => d));
  const distractors = (placing ? [1,2,3,4,5,6,7,8,9] : digitsOf(lesson.before.candidates[cell]))
    .filter(d => d !== answer && !removed.has(d)).slice(0, 2);
  if (!distractors.length) throw new Error('Drill needs a safe distractor');
  return { ...lesson, placing, cell, answer, options: [answer, ...distractors].sort((a,b) => a-b) };
}
