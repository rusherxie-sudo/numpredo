// Build-time teaching cases: replay actual solver steps, then identify the premise
// independently from the recorded candidate state. Never invent a candidate diagram.
import beginner from './puzzles/beginner.json' with { type: 'json' };
import intermediate from './puzzles/intermediate.json' with { type: 'json' };
import advanced from './puzzles/advanced.json' with { type: 'json' };
import hard from './puzzles/hard.json' with { type: 'json' };
import extreme from './puzzles/extreme.json' with { type: 'json' };
import { bit, computeCandidates, countSolutions, digitsOf, gridFromString, logicalSolve, PEERS, UNITS, TECH_INFO } from '../engine/index.ts';
import type { SolveStep } from '../engine/types.ts';

const packs = { beginner, intermediate, advanced, hard, extreme };
export const levelNames = { beginner: '初級', intermediate: '中級', advanced: '上級', hard: '難問', extreme: '超難問' };
export interface CaseSpec { level: keyof typeof packs; number: number; technique: string; heading: string; question: string; }
export const techniqueCases: Record<string, CaseSpec> = {
  'naked-single': { level: 'beginner', number: 4, technique: 'nakedSingle', heading: '実際の初級問題で、候補が一つのマスを探す', question: '色の付いたマスには何が入りますか。行・列・ブロックにある数字を除いて考えてください。' },
  'hidden-single': { level: 'intermediate', number: 3, technique: 'hiddenSingle', heading: '候補が複数でも、数字の置き場所は一つ', question: '色の付いたマスで、候補の個数だけでは見つからない確定数字を探してください。' },
  pointing: { level: 'intermediate', number: 4, technique: 'lockedCandidates', heading: '実際の中級問題で、区画の絞り込みを確認', question: '色の付いた候補は、どの行・列・ブロックに閉じ込められていますか。' },
  'naked-pair': { level: 'advanced', number: 4, technique: 'nakedPair', heading: '同じ2候補を持つ2マスから、外側の候補を消す', question: '色の付いた2マスが使う数字と、他のマスから消せる数字を考えてください。' },
  'hidden-pair': { level: 'advanced', number: 3, technique: 'hiddenPair', heading: '実際の上級問題から、隠れたペアを見つける', question: '2つの数字を置ける場所はどこですか。その2マスの中から何を消せますか。' },
  'naked-triple': { level: 'hard', number: 3, technique: 'nakedTriple', heading: '3マスの候補の和集合を、実際の盤面で確かめる', question: '色の付いた3マスの候補を合わせると何種類ですか。他のマスに残せない候補を探してください。' },
  'x-wing': { level: 'extreme', number: 17, technique: 'xWing', heading: '実戦のX-Wing：2本のラインの候補位置を比較', question: '色の付いた4マスを結ぶ2本の行または列で、同じ数字の候補が他にないことを確かめてください。' },
  swordfish: { level: 'extreme', number: 51, technique: 'swordfish', heading: '実戦のスワードフィッシュ：3本のラインを使う', question: '3本の行または列の候補が、反対方向のどの3本に収まるかを探してください。' },
  skyscraper: { level: 'extreme', number: 53, technique: 'skyscraper', heading: '実戦のスカイスクレイパー：両端を見るマスを探す', question: '2本の強リンクの非共有端を見つけ、両方の端を同時に見るマスを探してください。' },
};
export const guideCases: Record<string, CaseSpec> = {
  rules: { level: 'beginner', number: 1, technique: 'nakedSingle', heading: '3つのルールを重ねて、最初の1マスを埋める', question: '色の付いたマスに入る数字を一つ選んでください。使えない数字はどこにありますか。' },
  beginner: { level: 'intermediate', number: 2, technique: 'hiddenSingle', heading: '練習：候補が複数のマスを、数字の置き場所から決める', question: '単数には2種類あります。このマス自身の候補と、同じ数字を置ける他のマスを比べてください。中級問題の途中から、基本の一手だけを取り出しました。' },
  intermediate: { level: 'intermediate', number: 5, technique: 'lockedCandidates', heading: '単数で止まった中級盤面を、候補消去で動かす', question: '数字をすぐ埋められないとき、どの候補を消せば進めるでしょうか。ブロックと行・列の交わりを見てください。' },
  advanced: { level: 'advanced', number: 7, technique: 'hiddenPair', heading: '上級の練習：候補の多い2マスからペアを取り出す', question: '候補が2個のマスだけを探すと見落とします。数字ごとの置き場所を調べ、2マスに限られる2数字を見つけてください。' },
  'hard-sudoku-solving': { level: 'hard', number: 10, technique: 'nakedTriple', heading: '難問の実戦例：三国同盟で突破する一手', question: '単数とペアで進まなくなった途中盤面です。色の付いた3マスの候補を合わせ、他のマスから消せる数字を考えてください。' },
  tips: { level: 'advanced', number: 8, technique: 'nakedPair', heading: '手筋を選ぶ練習：この候補の並びなら何を使う？', question: '単数・区画の絞り込み・ペアのうち、この2マスを使うのはどれでしょうか。名前だけでなく、消せる場所も答えてください。' },
  'when-stuck': { level: 'intermediate', number: 6, technique: 'lockedCandidates', heading: '診断例：候補をそろえた後、どこを見るか', question: '数字を置けるマスが見つからない状態です。候補が一つの区画に偏っていないか、数字ごとに調べてください。' },
  glossary: { level: 'beginner', number: 6, technique: 'nakedSingle', heading: '盤面で読む：r・c、候補、単数の対応', question: 'rは上から数えた行、cは左から数えた列です。色の付いたマスの座標と候補を読み、用語と盤面を対応させてください。' },
};
export const rc = (c: number): string => `r${Math.floor(c / 9) + 1}c${c % 9 + 1}`;
const unitName = (i: number): string => i < 9 ? `${i + 1}行目` : i < 18 ? `${i - 8}列目` : `ブロック${i - 17}（左上から横に1〜9）`;
const combinations = (xs: number[], n: number): number[][] => n === 0 ? [[]] : xs.flatMap((x, i) => combinations(xs.slice(i + 1), n - 1).map(rest => [x, ...rest]));
export interface Premise { cells: number[]; digits: number[]; text: string; }

export function explainPremise(cand: number[], step: SolveStep): Premise {
  const targets = step.eliminations ?? [];
  const spots = (u: number[], d: number) => u.filter(c => cand[c] & bit(d));
  if (step.technique === 'nakedSingle') {
    const c = step.cell!;
    if (cand[c] !== bit(step.digit!)) throw new Error('Invalid single premise');
    return { cells: [c], digits: [step.digit!], text: `${rc(c)}の候補は｛${digitsOf(cand[c]).join('・')}｝だけです。行・列・ブロックにある数字を除くと、この数字しか残りません。` };
  }
  if (step.technique === 'hiddenSingle') {
    const ui = UNITS.findIndex(u => spots(u, step.digit!).length === 1 && spots(u, step.digit!)[0] === step.cell);
    if (ui >= 0) return { cells: [step.cell!], digits: [step.digit!], text: `${unitName(ui)}で${step.digit}を置けるのは${rc(step.cell!)}だけです。このマスの候補は｛${digitsOf(cand[step.cell!]).join('・')}｝ですが、${step.digit}の置き場所は一つに決まります。` };
  }
  for (let ui = 0; ui < UNITS.length; ui++) {
    const u = UNITS[ui];
    if (['nakedPair', 'nakedTriple'].includes(step.technique)) {
      const n = step.technique === 'nakedPair' ? 2 : 3;
      for (const cells of combinations(u.filter(c => digitsOf(cand[c]).length >= 2 && digitsOf(cand[c]).length <= n), n)) {
        const mask = cells.reduce((m,c) => m | cand[c],0);
        if (digitsOf(mask).length === n && targets.every(([c,d]) => u.includes(c) && !cells.includes(c) && (mask & bit(d)))) {
          return { cells, digits: digitsOf(mask), text: `${unitName(ui)}の${cells.map(c => `${rc(c)}＝｛${digitsOf(cand[c]).join('・')}｝`).join('、')}。この${n}マスが｛${digitsOf(mask).join('・')}｝の${n}数字を使い切るため、同じ単位の他のマスではこれらの数字を使えません。` };
        }
      }
    }
    if (step.technique === 'hiddenPair') for (const ds of combinations([1,2,3,4,5,6,7,8,9],2)) {
      const cells = spots(u,ds[0]);
      if (cells.length === 2 && spots(u,ds[1]).length === 2 && spots(u,ds[1]).every(c=>cells.includes(c)) && targets.every(([c,d])=>cells.includes(c)&&!ds.includes(d)))
        return { cells, digits: ds, text: `${unitName(ui)}で${ds.join('と')}を置けるのは、どちらも${cells.map(rc).join('・')}の2マスだけです。この2マスを${ds.join('と')}が使うため、2マスの内側に残る他の候補を消せます。` };
    }
    if (step.technique === 'lockedCandidates') {
      const d = targets[0][1], cells = spots(u,d);
      if (cells.length < 2) continue;
      const vi = UNITS.findIndex((v,j) => j !== ui && cells.every(c=>v.includes(c)) && targets.every(([c,nd])=>nd===d&&v.includes(c)&&!u.includes(c)));
      if (vi >= 0) return { cells, digits: [d], text: `${unitName(ui)}の${d}の候補は${cells.map(rc).join('・')}だけで、すべて${unitName(vi)}にも属します。${d}はこの交わりに入るため、${unitName(vi)}の交わりの外から${d}を消せます。` };
    }
  }
  if (['xWing','swordfish','skyscraper'].includes(step.technique)) {
    const d = targets[0][1], n = step.technique === 'swordfish' ? 3 : 2;
    for (const offset of [0,9]) for (const indices of combinations(Array.from({length:9},(_,i)=>i+offset).filter(i=>spots(UNITS[i],d).length>=2&&spots(UNITS[i],d).length<=n),n)) {
      const groups = indices.map(i=>spots(UNITS[i],d));
      const cells = groups.flat();
      const cross = (c: number) => offset === 0 ? c % 9 : Math.floor(c / 9);
      const covers = [...new Set(cells.map(cross))];
      if (step.technique === 'skyscraper') {
        const common = groups[0].filter(c=>groups[1].some(t=>cross(c)===cross(t)));
        if (common.length !== 1) continue;
        const ends = cells.filter(c=>cross(c)!==cross(common[0]));
        if (ends.length === 2 && targets.every(([c,nd])=>nd===d&&!cells.includes(c)&&ends.every(e=>PEERS[e].includes(c))))
          return { cells, digits: [d], text: `${indices.map(unitName).join('と')}では、${d}の候補がそれぞれ${groups.map(cs=>cs.map(rc).join('・')).join('／')}の2マスだけです。共通の${offset===0?'列':'行'}の2マスは同時に${d}になれません。したがって非共有端${ends.map(rc).join('・')}の少なくとも一方は${d}になり、両端を見るマスから${d}を消せます。` };
      } else if (covers.length === n && targets.every(([c,nd])=>nd===d&&!cells.includes(c)&&!indices.some(i=>UNITS[i].includes(c))&&covers.includes(cross(c))))
        return { cells, digits: [d], text: `${indices.map(unitName).join('・')}の${d}の候補は、すべて${covers.sort((a,b)=>a-b).map(i=>i+1).join('・')}${offset===0?'列':'行'}目に収まります。${n}本の元のラインがその${n}本を使い切るため、交差先の他のマスから${d}を消せます。` };
    }
  }
  throw new Error(`No demonstrable premise for ${step.technique}`);
}

export function teachingCase(spec: CaseSpec) {
  const raw = packs[spec.level].puzzles[spec.number - 1];
  const initial = gridFromString(raw.puzzle);
  const result = logicalSolve(initial.slice());
  if (!result.solved || result.grid.join('') !== raw.solution || countSolutions(initial.slice(),2)!==1) throw new Error('Invalid teaching puzzle');
  const grid = initial.slice(), candidates = computeCandidates(grid);
  for (let i=0; i<result.steps.length; i++) {
    const step = result.steps[i];
    const before = { grid: grid.slice(), candidates: candidates.slice() };
    if (step.cell != null && step.digit != null) {
      grid[step.cell] = step.digit; candidates[step.cell] = 0;
      for (const p of PEERS[step.cell]) candidates[p] &= ~bit(step.digit);
    }
    for (const [c,d] of step.eliminations ?? []) candidates[c] &= ~bit(d);
    if (step.technique === spec.technique) {
      const premise = explainPremise(before.candidates, step);
      const outcome = step.cell != null ? `${rc(step.cell)}に${step.digit}を入れます。` : `${(step.eliminations ?? []).map(([c,d])=>`${rc(c)}の${d}`).join('、')}を候補から消します。`;
      return { spec, raw, initial, before, after: {grid:grid.slice(),candidates:candidates.slice()}, step, premise, outcome, stepNumber:i+1, totalSteps:result.steps.length, name:TECH_INFO[step.technique].ja };
    }
  }
  throw new Error(`${spec.level} No.${spec.number} does not use ${spec.technique}`);
}
