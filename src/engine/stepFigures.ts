// 求解步骤 → 图解（SVG ＋ 日语说明）。题目集页（构建期）与 solver（客户端运行时）共用，
// 技巧文案与渲染逻辑单一来源。renderBoardSvg / TOKEN_THEME 复用引擎渲染层（svg.ts）。
import { renderBoardSvg, TOKEN_THEME } from './svg.ts';
import type { Grid, SolveStep } from './types.ts';

// ---- 説明文の部品：消去ステップを盤面の実データ（どのマスから・どの数字を消すか）で具体化する ----
// 同構造ページ（題目集 150 頁）の文面が金太郎飴にならないよう、説明は eliminations から生成し、
// 言い回しは盤面座標から**決定的に**選ぶ（Math.random 不使用 → ビルド再現性を保つ）。

const rcJa = (c: number): string => `${((c / 9) | 0) + 1}行${(c % 9) + 1}列`;

/** 消去先の要約：「3行7列のマス」「3行7列と5行7列のマス」「3行7列など4マス」＋消える数字 */
function elimTarget(el: Array<[number, number]>): string {
  if (!el.length) return '関係するマスから不要な候補'; // 護欄：消去型は必ず ≥1 だが、将来の技巧が空を返しても NaN 文を出さない
  const cs = [...new Set(el.map(([c]) => c))];
  const ds = [...new Set(el.map(([, d]) => d))].sort((a, b) => a - b);
  const place =
    cs.length === 1 ? `${rcJa(cs[0])}のマス` : cs.length === 2 ? `${rcJa(cs[0])}と${rcJa(cs[1])}のマス` : `${rcJa(cs[0])}など${cs.length}マス`;
  return `${place}から候補${ds.join('・')}`;
}

/** 盤面座標から決定的に言い回しを選ぶ（同一題は常に同一文面） */
function pick(s: SolveStep, variants: Array<(el: Array<[number, number]>) => string>): string {
  const el = s.eliminations ?? [];
  const seed = (el[0]?.[0] ?? s.cell ?? 0) + el.length;
  return variants[seed % variants.length](el);
}

/** 技巧元数据：日语名 ＋ 技巧详解页 slug ＋ 说明生成器（数据驱动每步文案） */
export const TECH_INFO: Record<string, { ja: string; slug?: string; desc: (s: SolveStep) => string }> = {
  nakedSingle: {
    ja: '裸の単数',
    desc: (s) => `${rcJa(s.cell ?? 0)}のマスは、残る候補が${s.digit}だけ。ここは${s.digit}で確定します。`,
  },
  hiddenSingle: {
    ja: '隠れた単数',
    desc: (s) => `${rcJa(s.cell ?? 0)}のマスに注目。この行・列・ブロックで${s.digit}が入れるのはここだけなので、${s.digit}で確定します。`,
  },
  lockedCandidates: {
    ja: '区画の絞り込み',
    slug: 'pointing',
    desc: (s) =>
      pick(s, [
        (el) => `ある数字の候補が、ブロックと行（列）の交差部分に絞り込まれました。交差の外側にあたる${elimTarget(el)}を消去できます。`,
        (el) => `候補の並びが一つの区画に閉じ込められる形です。区画の絞り込みにより、${elimTarget(el)}を消去できます。`,
      ]),
  },
  nakedPair: {
    ja: 'ペア（二国同盟）',
    slug: 'naked-pair',
    desc: (s) =>
      pick(s, [
        (el) => `同じ2候補だけを持つ2マス（ペア）が見つかりました。ペア以外の${elimTarget(el)}を消去できます。`,
        (el) => `2つのマスが同じ2つの数字を取り合う二国同盟の形。同じ単元に属する${elimTarget(el)}を消去できます。`,
      ]),
  },
  hiddenPair: {
    ja: '隠れたペア',
    slug: 'hidden-pair',
    desc: (s) =>
      pick(s, [
        (el) => `2つの数字の入り先が同じ2マスに限られる「隠れたペア」です。この2マスに残る他の候補、${elimTarget(el)}を消去できます。`,
        (el) => `候補表示の中に隠れたペアが潜んでいました。ペアの2マスから、${elimTarget(el)}を整理できます。`,
      ]),
  },
  nakedTriple: {
    ja: '三国同盟（ネイキッドトリプル）',
    slug: 'naked-triple',
    desc: (s) =>
      pick(s, [
        (el) => `3つのマスの候補が3種類の数字に収まる三国同盟です。同盟の外側にあたる${elimTarget(el)}を消去できます。`,
        (el) => `3マスで3つの数字を分け合う形が確定しました。これにより${elimTarget(el)}を消去できます。`,
      ]),
  },
  xWing: {
    ja: 'X-Wing',
    slug: 'x-wing',
    desc: (s) =>
      pick(s, [
        (el) => `ある数字の候補が長方形の四隅に並ぶX-Wingが完成しています。四隅の行（列）に沿って、${elimTarget(el)}を消去できます。`,
        (el) => `2本の行（列）で候補の位置がそろうX-Wing。挟まれたラインの${elimTarget(el)}を消去できます。`,
      ]),
  },
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
