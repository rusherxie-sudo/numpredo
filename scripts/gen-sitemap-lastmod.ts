// 生成 sitemap 的真实 lastmod 数据：每个 URL 的「最后修改日」= 该页内容源文件的 git 提交日期。
//
// 为什么不在构建时现算：
//   ① 不能用「构建日」——那等于每次部署都向 Google 谎称所有页都变了，Google 会判定 lastmod
//      不可信而整体忽略它，白白浪费这个新鲜度信号。
//   ② Cloudflare Pages 构建环境可能 shallow clone（git 历史被截断），构建时 `git log` 会把所有
//      文件日期塌缩成最近一次提交日 ≈ 构建日，正好踩中 ①。本地有完整历史，离线算才准。
//   → 与本项目题库「预生成进 git、构建时不生成」同一套防御性思路：结果提交进 git，可复现。
//
// lastmod 取值范围：只算「这一页自己的内容源」（页面文件 + 它驱动的数据文件），
//   故意排除共享布局 Base.astro——否则改一次页脚就会让全站 lastmod 同时跳，反而被 Google 当噪声。
//
// 运行：node scripts/gen-sitemap-lastmod.ts　（改了 src/pages 或 src/data 的内容后重跑并提交）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const PAGES = 'src/pages';
const OUT = 'src/data/sitemap-lastmod.json';

// 动态路由模板 → 其内容数据文件。改路由时同步维护（对应 CLAUDE.md 的「内容即数据」表）。
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

// 从数据文件抽 slug 列表（纯正则——避免 import 数据模块触发 levels.ts 透传的 JSON import attributes 坑）
function slugsFromData(file: string): string[] {
  const src = readFileSync(file, 'utf-8');
  const slugs: string[] = [];
  const re = /\bslug:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) slugs.push(m[1]);
  return slugs;
}

// 一组源文件 → 最新 git 提交日（ISO 8601，取最大）；都无提交记录则返回 ''
function gitLastmod(files: string[]): string {
  let best = '';
  for (const f of files) {
    if (!existsSync(f)) continue;
    let iso = '';
    try {
      iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', f], { encoding: 'utf-8' }).trim();
    } catch {
      iso = '';
    }
    if (iso && iso > best) best = iso;
  }
  return best;
}

const map: Record<string, string> = {};

for (const rel of listPages()) {
  if (rel.includes('[')) {
    // 嵌套双参数路由 play/[level]/[n]：level × (1..题库题数)。slugsFromData 只提单层 slug，特判处理。
    if (rel === 'play/[level]/[n].astro') {
      for (const lv of slugsFromData('src/data/levels.ts')) {
        const pf = `src/data/puzzles/${lv}.json`;
        const d = gitLastmod([`${PAGES}/${rel}`, pf]);
        if (!d) continue;
        const count = JSON.parse(readFileSync(pf, 'utf-8')).puzzles.length; // = [n].astro 的「题库每题一页」
        for (let nn = 1; nn <= count; nn++) map[`/play/${lv}/${nn}/`] = d;
      }
      continue;
    }
    // 动态路由：每个 slug 一个 URL；内容源 = 模板文件 + 数据文件，组内共用同一日期（git 按文件粒度）
    const dataFile = DYNAMIC_DATA[rel];
    if (!dataFile) {
      console.warn(`⚠ 未映射数据文件的动态路由：${rel}（已跳过，请在 DYNAMIC_DATA 补齐）`);
      continue;
    }
    const dir = rel.replace(/\/?\[[^/]+\]\.astro$/, ''); // play / guide / guide/techniques / variants
    const date = gitLastmod([`${PAGES}/${rel}`, dataFile]);
    if (!date) continue;
    for (const slug of slugsFromData(dataFile)) {
      map[dir ? `/${dir}/${slug}/` : `/${slug}/`] = date;
    }
  } else {
    const date = gitLastmod([`${PAGES}/${rel}`]);
    if (date) map[fileToUrl(rel)] = date;
  }
}

// 按 URL 排序输出，diff 友好
const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

console.log('════════════════════════════════════════════════════');
console.log(' sitemap lastmod 生成（真实 git 提交日，非构建日）');
console.log('════════════════════════════════════════════════════');
for (const [url, d] of Object.entries(sorted)) console.log(`  ${d.slice(0, 10)}  ${url}`);
console.log(`\n共 ${Object.keys(sorted).length} 个 URL → ${OUT}`);
