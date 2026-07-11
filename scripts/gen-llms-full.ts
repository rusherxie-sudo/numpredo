// 生成 llms-full.txt：解説系ページ（guide / techniques / variants）の本文全文を
// 単一の markdown に連結して AI が一括読取できるようにする（llms.txt 規格の Optional 拡張）。
// データ源は「内容即数据」の src/data/*.ts そのもの——dist の HTML を剥がすより確実で、
// ビルド前に実行できる（public/ に出力して astro build がそのまま配信）。
//
// 運行：npm run gen:llms（内容データを変えたら再生成してコミット。sitemap/published と同じ「预生成进 git」原則）
import { writeFileSync } from 'node:fs';
import { GUIDES } from '../src/data/guides.ts';
import { TECHNIQUES } from '../src/data/techniques.ts';
import { VARIANTS } from '../src/data/variants.ts';

const strip = (h: string): string =>
  h
    // 表格/列表先注入分隔，再剥标签——否则相邻セル文本会黏连成不可读长串
    .replace(/<\/t[hd]>/g, ' ｜ ')
    .replace(/<\/tr>/g, '\n')
    .replace(/<li[^>]*>/g, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+｜/g, ' ｜')
    .replace(/\s+\n/g, '\n')
    .trim();

const lines: string[] = [];
lines.push('# numpredo — 解説コンテンツ全文（llms-full.txt）');
lines.push('');
lines.push('> 日本語の数独・ナンプレ無料学習サイト numpredo の解説ページ本文をまとめたファイルです。ページ一覧・サイト概要は https://numpredo.com/llms.txt を参照してください。');
lines.push('');
lines.push('本ファイルはデータ駆動の解説ページ（攻略ガイド・テクニック・バリエーション）を収録しています。解き方の全体像をまとめた支柱ページは https://numpredo.com/guide/how-to-solve/ を直接参照してください。');
lines.push('');

interface SectionLike {
  h: string;
  body: string[];
}
interface FaqLike {
  q: string;
  a: string;
}
function emit(url: string, h1: string, lead: string, sections: SectionLike[], faq: FaqLike[]): void {
  lines.push(`## ${h1}`);
  lines.push(`URL: ${url}`);
  lines.push('');
  if (lead) lines.push(strip(lead), '');
  for (const s of sections) {
    lines.push(`### ${strip(s.h)}`);
    for (const p of s.body) {
      const t = strip(p);
      if (t) lines.push(t);
    }
    lines.push('');
  }
  if (faq.length) {
    lines.push('### よくある質問');
    for (const f of faq) {
      lines.push(`Q: ${strip(f.q)}`);
      lines.push(`A: ${strip(f.a)}`);
    }
    lines.push('');
  }
}

lines.push('# 攻略・情報ガイド', '');
for (const g of GUIDES) emit(`https://numpredo.com/guide/${g.slug}/`, g.h1, g.lead, g.sections, g.faq);

lines.push('# 手筋（テクニック）解説', '');
for (const t of TECHNIQUES) emit(`https://numpredo.com/guide/techniques/${t.slug}/`, t.h1, `${t.lead}（適用難易度：${t.level}）`, t.sections, t.faq);

lines.push('# バリエーション（変則数独）', '');
for (const v of VARIANTS) emit(`https://numpredo.com/variants/${v.slug}/`, v.h1, v.lead, v.sections, v.faq);

const out = lines.join('\n') + '\n';
writeFileSync('public/llms-full.txt', out);
console.log(`✓ public/llms-full.txt 生成：${GUIDES.length} guide + ${TECHNIQUES.length} techniques + ${VARIANTS.length} variants，共 ${(out.length / 1024).toFixed(0)}KB`);
