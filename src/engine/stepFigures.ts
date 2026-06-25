// 求解步骤 → 图解（SVG ＋ 日语说明）。题目集页（构建期）与 solver（客户端运行时）共用，
// 技巧文案与渲染逻辑单一来源。renderBoardSvg / TOKEN_THEME 复用引擎渲染层（svg.ts）。
import { renderBoardSvg, TOKEN_THEME } from './svg.ts';
import type { Grid, SolveStep } from './types.ts';

/** 技巧元数据：日语名 ＋ 技巧详解页 slug ＋ 一句说明（数据驱动每步文案） */
export const TECH_INFO: Record<string, { ja: string; slug?: string; desc: (s: SolveStep) => string }> = {
  nakedSingle: { ja: '裸の単数', desc: (s) => `${(((s.cell ?? 0) / 9) | 0) + 1}行目・左から${((s.cell ?? 0) % 9) + 1}番目のマスは、候補が${s.digit}ひとつだけ。ここは${s.digit}で確定します。` },
  hiddenSingle: { ja: '隠れた単数', desc: (s) => `${(((s.cell ?? 0) / 9) | 0) + 1}行目・左から${((s.cell ?? 0) % 9) + 1}番目のマス。この行・列・ブロックで${s.digit}が入れるのはここだけなので、${s.digit}で確定します。` },
  lockedCandidates: { ja: '区画の絞り込み（ポインティング）', slug: 'pointing', desc: () => 'あるブロック内で、ある数字の候補が一直線に並んでいます。その行（列）の交差する外のマスから、その数字の候補を消去できます。' },
  nakedPair: { ja: 'ペア（二国同盟）', slug: 'naked-pair', desc: () => '同じ2つの候補だけを持つ2マス（ペア）を見つけました。同じ単元の他のマスから、その2つの数字を消去できます。' },
  hiddenPair: { ja: '隠れたペア', slug: 'hidden-pair', desc: () => '2つの数字が同じ2マスにしか入らない形（隠れたペア）です。その2マスから、ペア以外の候補をすべて消去できます。' },
  nakedTriple: { ja: '三国同盟（ネイキッドトリプル）', slug: 'naked-triple', desc: () => '3つのマスで候補が3種類に収まる組（三国同盟）を見つけました。同じ単元の他のマスから、その3数字を消去できます。' },
  xWing: { ja: 'X-Wing', slug: 'x-wing', desc: () => '2つの行で、ある数字の候補が同じ2つの列だけに現れる長方形（X-Wing）です。その2列の他の行から、その数字を消去できます。' },
};

export interface StepFigure {
  svg: string;
  label: string;
  text: string;
  slug?: string;
}

/**
 * キーステップ列 → 図解（SVG ＋ ラベル ＋ 説明）。
 * given は元の問題マス（太字表示用）。cell は 1 マスの px サイズ。
 * 消去ステップは「消える候補に赤マーク＋関係マスを枠囲み」、確定ステップは「落子マスを枠囲み」。
 */
export function renderStepFigures(
  keySteps: Array<{ grid: Grid; candidates: number[]; step: SolveStep }>,
  given: boolean[],
  cell = 34,
): StepFigure[] {
  return keySteps.map((ks, i) => {
    const st = ks.step;
    const isElim = !!(st.eliminations && st.eliminations.length);
    const marks = isElim
      ? st.eliminations!.map(([c, digit]) => ({ cell: c, digit, type: 'eliminate' as const }))
      : [];
    const hl = isElim
      ? [...new Set(st.eliminations!.map(([c]) => c))].map((c) => ({ cell: c }))
      : st.cell != null
        ? [{ cell: st.cell }]
        : [];
    const info = TECH_INFO[st.technique] ?? TECH_INFO.nakedSingle;
    return {
      svg: renderBoardSvg(ks.grid, {
        given,
        candidates: ks.candidates,
        cellHighlights: hl,
        candidateMarks: marks,
        theme: TOKEN_THEME,
        cell,
        title: `手順${i + 1}：${info.ja}`,
        desc: info.ja,
      }),
      label: `手順 ${i + 1}：${info.ja}`,
      text: info.desc(st),
      slug: info.slug,
    };
  });
}
