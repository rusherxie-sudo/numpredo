// 构建产物 SEO 一致性检查。
// 以 dist/ 为最终事实源，验证 sitemap、robots、canonical 与 301 目标是否同步。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const siteOrigin = 'https://numpredo.com';
const numberedPuzzlePattern = /^\/play\/(?:beginner|intermediate|advanced|hard|extreme)\/\d+\/$/;
const allowedNoindexPaths = new Set(['/stats/']);
const requiredContentMarkers: Record<string, string[]> = {
  '/practice/': ['"@type":"LearningResource"', 'data-practice', '実際の問題を論理ソルバーが解いた途中局面', 'この練習で扱う5つの手筋'],
  '/research/puzzle-analysis/': ['"@type":"Dataset"', '全4,395問の数独を分析', '集計方法と再現性', 'データの範囲と限界'],
  '/tools/generator/': ['id="quality-verification"', '唯一解検査', '実際の一問で見る生成・検証の4工程'],
};
const expectedPuzzlePaths = new Set<string>(
  JSON.parse(readFileSync(join(projectRoot, 'src/data/indexable-puzzles.json'), 'utf8')),
);

if (!existsSync(join(distDir, 'sitemap-0.xml'))) {
  console.error('❌ dist/sitemap-0.xml 不存在。请先运行 npm run build。');
  process.exit(1);
}

function walkIndexPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) return walkIndexPages(target);
    return entry.name === 'index.html' ? [target] : [];
  });
}

function pathnameOf(file: string): string {
  const rel = relative(distDir, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\/index\.html$/, '')}/`;
}

function matches(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

const errors: string[] = [];
const pages = new Map(
  walkIndexPages(distDir).map((file) => {
    const pathname = pathnameOf(file);
    const html = readFileSync(file, 'utf8');
    return [pathname, { file, html }] as const;
  }),
);

const canonicalOwners = new Map<string, string[]>();
const indexablePaths = new Set<string>();

for (const [pathname, { html }] of pages) {
  const expectedCanonical = `${siteOrigin}${pathname}`;
  const canonicals = matches(html, /<link rel="canonical" href="([^"]+)"/g);
  const robots = matches(html, /<meta name="robots" content="([^"]+)"/g);

  if (canonicals.length !== 1) {
    errors.push(`${pathname} canonical 数量为 ${canonicals.length}（应为 1）`);
  } else {
    const canonical = canonicals[0];
    if (canonical !== expectedCanonical) {
      errors.push(`${pathname} canonical 为 ${canonical}（应为 ${expectedCanonical}）`);
    }
    const owners = canonicalOwners.get(canonical) ?? [];
    owners.push(pathname);
    canonicalOwners.set(canonical, owners);
  }

  if (robots.length !== 1) {
    errors.push(`${pathname} robots meta 数量为 ${robots.length}（应为 1）`);
  } else if (robots[0].split(',').map((value) => value.trim()).includes('index')) {
    indexablePaths.add(pathname);
  }
}

for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) {
    errors.push(`canonical 重复：${canonical} 被 ${owners.join('、')} 共用`);
  }
}

for (const pathname of pages.keys()) {
  if (!indexablePaths.has(pathname) && !allowedNoindexPaths.has(pathname)) {
    errors.push(`${pathname} 是 noindex 的 200 页面，但未在允许名单中`);
  }
}

// AdSense の低価値判定に対して追加した一次データ・練習・検証証拠を、将来の改修で空洞化させない。
for (const [pathname, markers] of Object.entries(requiredContentMarkers)) {
  const page = pages.get(pathname);
  if (!page) {
    errors.push(`${pathname} の高価値コンテンツページが構築されていません`);
    continue;
  }
  for (const marker of markers) {
    if (!page.html.includes(marker)) errors.push(`${pathname} から必須コンテンツ「${marker}」が消えています`);
  }
}

const sitemapXml = readFileSync(join(distDir, 'sitemap-0.xml'), 'utf8');
const sitemapPaths = new Set(
  matches(sitemapXml, /<loc>([^<]+)<\/loc>/g).map((url) => new URL(url).pathname),
);

for (const pathname of indexablePaths) {
  if (!sitemapPaths.has(pathname)) errors.push(`${pathname} 允许索引但未进入 sitemap`);
}
for (const pathname of sitemapPaths) {
  if (!pages.has(pathname)) errors.push(`${pathname} 在 sitemap 中但构建页面不存在`);
  if (!indexablePaths.has(pathname)) errors.push(`${pathname} 在 sitemap 中但页面不是 index`);
}

// 量産型の番号ページは noindex の 200 ページとして残さない。
// 実ページ・sitemap・許可リストの三者が完全一致することを保証する。
const builtPuzzlePaths = new Set([...pages.keys()].filter((pathname) => numberedPuzzlePattern.test(pathname)));
for (const pathname of expectedPuzzlePaths) {
  if (!builtPuzzlePaths.has(pathname)) errors.push(`${pathname} 在题目页白名单中但未构建`);
  if (!sitemapPaths.has(pathname)) errors.push(`${pathname} 在题目页白名单中但未进入 sitemap`);
}
for (const pathname of builtPuzzlePaths) {
  if (!expectedPuzzlePaths.has(pathname)) errors.push(`${pathname} 未在题目页白名单中却仍被构建`);
}

const redirectsFile = join(distDir, '_redirects');
if (!existsSync(redirectsFile)) {
  errors.push('dist/_redirects 不存在');
} else {
  const redirects = readFileSync(redirectsFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));
  const exactSources = new Set(
    redirects.map(([source]) => source).filter((source) => !source.includes('*')),
  );

  for (const pathname of expectedPuzzlePaths) {
    if (exactSources.has(pathname)) errors.push(`${pathname} 同时是题目页白名单和 301 来源`);
  }

  // 内部链接不应把用户和审核爬虫先送进 301，尤其不能继续暴露已收缩的题号页。
  for (const [pathname, { html }] of pages) {
    const hrefs = matches(html, /href="([^"]+)"/g);
    for (const href of hrefs) {
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      const target = new URL(href, siteOrigin);
      if (target.origin !== siteOrigin) continue;
      if (numberedPuzzlePattern.test(target.pathname) && exactSources.has(target.pathname)) {
        errors.push(`${pathname} 内链指向已 301 的题号页 ${target.pathname}`);
      }
    }
  }

  for (const [source, target, status] of redirects) {
    if (status !== '301') errors.push(`${source} 的状态码为 ${status}（应为 301）`);
    if (!target.startsWith('/') || target.includes('*')) continue;
    if (!pages.has(target)) errors.push(`${source} 的 301 目标 ${target} 不存在`);
    if (exactSources.has(target)) errors.push(`${source} → ${target} 形成跳转链`);
  }
}

const robotsText = readFileSync(join(distDir, 'robots.txt'), 'utf8');
if (!robotsText.includes(`Sitemap: ${siteOrigin}/sitemap-index.xml`)) {
  errors.push('robots.txt 未指向正式 sitemap-index.xml');
}

if (errors.length > 0) {
  console.error(`❌ SEO 构建检查失败（${errors.length} 项）`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('✅ SEO 构建检查通过');
console.log(`  构建页面：${pages.size}`);
console.log(`  可索引页面：${indexablePaths.size}`);
console.log(`  sitemap URL：${sitemapPaths.size}`);
