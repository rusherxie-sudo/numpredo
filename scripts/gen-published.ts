// 生成 Article schema 的 datePublished 数据：每个 URL 的「首次发布日」= 该页内容源文件的 git 首次提交日期。
//
// 与 gen-sitemap-lastmod.ts 同源同思路，唯一区别是取「首次提交日」而非「最后提交日」：
//   · dateModified（sitemap-lastmod.json）取 `git log -1`（最后一次提交）→ 内容最近一次更新；
//   · datePublished（本脚本）取 `git log --diff-filter=A --follow`（新增该文件的那次提交）→ 内容首次发布。
//   两者满足 datePublished ≤ dateModified（首次 ≤ 最后），逻辑自洽。
//
// 为什么离线预生成（同 gen-sitemap-lastmod.ts）：
//   ① 不用构建日——datePublished 一旦写定就不该随每次部署漂移；
//   ② CF Pages 构建环境可能 shallow clone，git 历史被截断，构建时现算会失真。
//   → 结果提交进 git，可复现。
//
// 取值范围：只算「这一页自己的内容源」（页面文件 + 它驱动的数据文件），排除共享布局 Base.astro。
// 一个页面有多个源文件时，取最早的一次新增（min）——页面「首次存在」即其最早源文件诞生之时。
//
// 运行：node scripts/gen-published.ts　（与 sitemap-lastmod 覆盖同一批 URL，重点是 4 类 article 页）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const PAGES = 'src/pages';
const OUT = 'src/data/published.json';

// 动态路由模板 → 其内容数据文件（与 gen-sitemap-lastmod.ts 保持一致，改路由时同步维护）。
const DYNAMIC_DATA: Record<string, string> = {
  'play/[level].astro': 'src/data/levels.ts',
  'guide/[slug].astro': 'src/data/guides.ts',
  'guide/techniques/[slug].astro': 'src/data/techniques.ts',
  'variants/[slug].astro': 'src/data/variants.ts',
};

// 递归列出 src/pages 下所有 .astro（返回相对 PAGES 的 posix 路径）
function listPages(dir = PAGES, base = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listPages(join(dir, e.name), rel));
    else if (e.name.endsWith('.astro')) out.push(rel);
  }
  return out;
}

// 静态页：文件路径（相对 PAGES）→ 路由 URL（带尾斜杠，匹配 build.format: 'directory'）
function fileToUrl(rel: string): string {
  let p = rel.replace(/\.astro$/, '');
  if (p === 'index') return '/';
  p = p.replace(/\/index$/, '');
  return `/${p}/`;
}

// 从数据文件抽 slug 列表（纯正则——避免 import 数据模块触发 JSON import attributes 坑）
function slugsFromData(file: string): string[] {
  const src = readFileSync(file, 'utf-8');
  const slugs: string[] = [];
  const re = /\bslug:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) slugs.push(m[1]);
  return slugs;
}

// 单个文件的 git 首次提交日（新增该文件那次提交的作者日期 ISO）；无记录返回 ''
function gitFirstCommit(file: string): string {
  if (!existsSync(file)) return '';
  // --diff-filter=A 只看「新增」该路径的提交，--follow 跨改名追溯，取最早一条（首条即首次新增）
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { encoding: 'utf-8' },
    ).trim();
    const lines = out.split('\n').filter(Boolean);
    if (lines.length) return lines[lines.length - 1]; // 最后一行 = 最早的新增提交
  } catch {
    /* fallthrough */
  }
  // 兜底：文件无「新增」记录（罕见，如被重写过历史）时退回到 --reverse 取首条任意提交
  try {
    const out = execFileSync('git', ['log', '--reverse', '--format=%aI', '--', file], {
      encoding: 'utf-8',
    }).trim();
    const first = out.split('\n').filter(Boolean)[0];
    return first ?? '';
  } catch {
    return '';
  }
}

// 一组源文件 → 最早 git 首次提交日（ISO 8601，取最小）；都无提交记录则返回 ''
function gitPublished(files: string[]): string {
  let best = '';
  for (const f of files) {
    const iso = gitFirstCommit(f);
    if (iso && (best === '' || iso < best)) best = iso;
  }
  return best;
}

const map: Record<string, string> = {};

for (const rel of listPages()) {
  if (rel.includes('[')) {
    // 嵌套双参数路由 play/[level]/[n]：发布日 = 题目页路由文件的首次提交日（不含 puzzles，避免偏早）。
    if (rel === 'play/[level]/[n].astro') {
      const d = gitPublished([`${PAGES}/${rel}`]);
      if (d) for (const lv of slugsFromData('src/data/levels.ts')) for (let nn = 1; nn <= 12; nn++) map[`/play/${lv}/${nn}/`] = d;
      continue;
    }
    // 动态路由：每个 slug 一个 URL；内容源 = 模板文件 + 数据文件，组内共用同一日期（git 按文件粒度）
    const dataFile = DYNAMIC_DATA[rel];
    if (!dataFile) {
      console.warn(`⚠ 未映射数据文件的动态路由：${rel}（已跳过，请在 DYNAMIC_DATA 补齐）`);
      continue;
    }
    const dir = rel.replace(/\/?\[[^/]+\]\.astro$/, ''); // play / guide / guide/techniques / variants
    const date = gitPublished([`${PAGES}/${rel}`, dataFile]);
    if (!date) continue;
    for (const slug of slugsFromData(dataFile)) {
      map[dir ? `/${dir}/${slug}/` : `/${slug}/`] = date;
    }
  } else {
    const date = gitPublished([`${PAGES}/${rel}`]);
    if (date) map[fileToUrl(rel)] = date;
  }
}

// 按 URL 排序输出，diff 友好
const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

console.log('════════════════════════════════════════════════════');
console.log(' Article datePublished 生成（真实 git 首次提交日，非构建日）');
console.log('════════════════════════════════════════════════════');
for (const [url, d] of Object.entries(sorted)) console.log(`  ${d.slice(0, 10)}  ${url}`);
console.log(`\n共 ${Object.keys(sorted).length} 个 URL → ${OUT}`);
