// 盘面 SVG 渲染器（框架无关，输出纯字符串）。
// 交互盘面与攻略图解共用：支持给定/填入区分、候选铅笔标记、单元格高亮、候选高亮/消除标记。
// 矢量 + 文字可写日语 → KB 级、利 CWV、利 image pack。
import type { Grid } from './types.ts';
import { digitsOf } from './board.ts';

export interface SvgTheme {
  bg: string;
  gridThin: string;
  gridThick: string;
  given: string; // 题面给定数字
  filled: string; // 用户/解答填入数字
  candidate: string; // 候选铅笔色
  highlightCell: string; // 单元格高亮底色
  candHighlight: string; // 候选高亮色
  eliminate: string; // 消除标记色
}

/** 和モダン明亮主题（与站点盘面统一） */
export const LIGHT_THEME: SvgTheme = {
  bg: '#fffdf8', // 和纸白
  gridThin: '#e4dece',
  gridThick: '#3a352e', // 墨
  given: '#1f1b16', // 墨黑（题面，明朝体由使用方设字体）
  filled: '#2b5b7a', // 藍（用户填入）
  candidate: '#a89f90', // 茶灰候选
  highlightCell: '#f1ead9', // 豆腐
  candHighlight: '#c8463c', // 朱赤
  eliminate: '#b5302a', // 消除红
};

/** 和モダン暗色主题（夜の墨，暖黑） */
export const DARK_THEME: SvgTheme = {
  bg: '#24211c',
  gridThin: '#3a352e',
  gridThick: '#7a7060',
  given: '#ece7dd',
  filled: '#86b6d2',
  candidate: '#8a8174',
  highlightCell: '#2c2822',
  candHighlight: '#e0655a',
  eliminate: '#e0655a',
};

export interface CandidateMark {
  cell: number;
  digit: number;
  type: 'highlight' | 'eliminate';
}

export interface RenderOptions {
  /** 每格候选位掩码（用于空格铅笔标记） */
  candidates?: number[];
  /** 哪些格是题面给定（加粗深色），其余填入数字用 filled 色 */
  given?: boolean[];
  /** 单元格背景高亮：cell index → 颜色（缺省用主题 highlightCell） */
  cellHighlights?: Array<{ cell: number; color?: string }>;
  /** 候选标记：高亮某候选 / 标记某候选将被消除（攻略演示核心） */
  candidateMarks?: CandidateMark[];
  /** 单格像素，默认 56 */
  cell?: number;
  /** 主题 */
  theme?: SvgTheme;
  /** 无障碍/SEO：<title> 与 <desc>（用日语写） */
  title?: string;
  desc?: string;
}

const sub = (d: number): { sr: number; sc: number } => ({ sr: ((d - 1) / 3) | 0, sc: (d - 1) % 3 });

/** 渲染盘面为 SVG 字符串 */
export function renderBoardSvg(grid: Grid, opts: RenderOptions = {}): string {
  const cell = opts.cell ?? 56;
  const m = Math.round(cell * 0.18); // 外边距
  const t = opts.theme ?? LIGHT_THEME;
  const S = m * 2 + cell * 9;
  const given = opts.given;
  const parts: string[] = [];

  parts.push(
    `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg" role="img"${
      opts.title ? ` aria-label="${esc(opts.title)}"` : ''
    }>`,
  );
  if (opts.title) parts.push(`<title>${esc(opts.title)}</title>`);
  if (opts.desc) parts.push(`<desc>${esc(opts.desc)}</desc>`);
  parts.push(`<rect width="${S}" height="${S}" fill="${t.bg}"/>`);

  // 单元格高亮（先画，垫底）
  for (const h of opts.cellHighlights ?? []) {
    const r = (h.cell / 9) | 0;
    const c = h.cell % 9;
    parts.push(
      `<rect x="${m + c * cell}" y="${m + r * cell}" width="${cell}" height="${cell}" fill="${h.color ?? t.highlightCell}"/>`,
    );
  }

  // 数字 / 候选
  const fontMain = Math.round(cell * 0.56);
  const fontCand = Math.round(cell * 0.24);
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const x = m + c * cell;
    const y = m + r * cell;
    if (grid[i] !== 0) {
      const isGiven = given ? given[i] : true;
      parts.push(
        `<text x="${x + cell / 2}" y="${y + cell / 2}" font-family="sans-serif" font-size="${fontMain}" font-weight="${
          isGiven ? 700 : 400
        }" fill="${isGiven ? t.given : t.filled}" text-anchor="middle" dominant-baseline="central">${grid[i]}</text>`,
      );
    } else if (opts.candidates && opts.candidates[i]) {
      for (const d of digitsOf(opts.candidates[i])) {
        const { sr, sc } = sub(d);
        const cx = x + (sc + 0.5) * (cell / 3);
        const cy = y + (sr + 0.5) * (cell / 3);
        const mark = (opts.candidateMarks ?? []).find((mk) => mk.cell === i && mk.digit === d);
        const fill = mark?.type === 'highlight' ? t.candHighlight : mark?.type === 'eliminate' ? t.eliminate : t.candidate;
        const weight = mark ? 700 : 400;
        parts.push(
          `<text x="${cx}" y="${cy}" font-family="sans-serif" font-size="${fontCand}" font-weight="${weight}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${d}</text>`,
        );
        if (mark?.type === 'eliminate') {
          const rr = (cell / 3) * 0.34;
          parts.push(
            `<line x1="${cx - rr}" y1="${cy - rr}" x2="${cx + rr}" y2="${cy + rr}" stroke="${t.eliminate}" stroke-width="${Math.max(
              1,
              cell * 0.025,
            )}"/>`,
          );
        }
      }
    }
  }

  // 网格线：细线
  for (let k = 0; k <= 9; k++) {
    const p = m + k * cell;
    const thick = k % 3 === 0;
    const w = thick ? Math.max(2, cell * 0.05) : 1;
    const col = thick ? t.gridThick : t.gridThin;
    parts.push(`<line x1="${m}" y1="${p}" x2="${m + cell * 9}" y2="${p}" stroke="${col}" stroke-width="${w}"/>`);
    parts.push(`<line x1="${p}" y1="${m}" x2="${p}" y2="${m + cell * 9}" stroke="${col}" stroke-width="${w}"/>`);
  }

  parts.push('</svg>');
  return parts.join('');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
