// 构建产物 SEO 一致性检查。
// 以 dist/ 为最终事实源，验证 sitemap、robots、canonical 与 301 目标是否同步。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const siteOrigin = 'https://numpredo.com';

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
