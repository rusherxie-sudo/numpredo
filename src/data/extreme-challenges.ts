import { teachingCase } from './teaching-cases.ts';

const groups = [
  { id: 'start', title: '超難問を初めて解く', intro: '掲載手順の手数が少なめの超難問から。ヒントや途中保存はいつも通り使えます。', pairs: [[436,'skyscraper'],[500,'xWing'],[112,'skyscraper']] },
  { id: 'technique', title: '手筋を一つずつ練習', intro: '同じ数字の候補を、行や列でどう比べるか。練習したい手筋から選べます。', pairs: [[966,'xWing'],[600,'skyscraper'],[136,'swordfish']] },
  { id: 'expert', title: '手応えのある一問に挑戦', intro: '掲載手順が長い問題。まず自力で進め、行き詰まったら盤面のヒントを使えます。', pairs: [[671,'skyscraper'],[935,'swordfish'],[735,'swordfish']] },
] as const;

export const EXTREME_CHALLENGES = groups.map(group => ({
  id:group.id, title:group.title, intro:group.intro,
  items:group.pairs.map(([number,technique])=>{
    const t = teachingCase({ level:'extreme',number,technique,heading:'',question:'' });
    return {number, technique, steps:t.totalSteps, keyStep:t.stepNumber, techniqueName:t.name};
  }),
}));
if (new Set(EXTREME_CHALLENGES.flatMap(g=>g.items.map(t=>t.number))).size!==9) throw new Error('Duplicate challenge puzzle');
export const EXTREME_TECH_LINK: Record<string,number> = {'x-wing':966,skyscraper:600,swordfish:136};
