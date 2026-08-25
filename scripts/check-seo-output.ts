// 构建产物 SEO 一致性检查。
// 以 dist/ 为最终事实源，验证 sitemap、robots、canonical 与 301 目标是否同步。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const siteOrigin = 'https://numpredo.com';
const adsensePublisherId = 'ca-pub-1382715204285550';
const adsenseRecord = 'google.com, pub-1382715204285550, DIRECT, f08c47fec0942fa0';
const numberedPuzzlePattern = /^\/play\/(?:beginner|intermediate|advanced|hard|extreme)\/\d+\/$/;
const allowedNoindexPaths = new Set(['/stats/']);
const thinContentExemptPaths = new Set(['/about/', '/contact/', '/privacy/', '/terms/']);
const minimumMainTextLength = 700;
const maximumContentSimilarity = 0.45;
const maximumInitialJsBytes = 64 * 1024;
const requiredContentMarkers: Record<string, string[]> = {
  '/practice/': ['"@type":"LearningResource"', 'data-practice', '実際の問題を論理ソルバーが解いた途中局面', 'この練習で扱う5つの手筋'],
  '/research/puzzle-analysis/': [
    '"@type":"Dataset"',
    '全4,395問の数独を分析',
    '集計方法と再現性',
    '公開CSVの列と検算方法',
    '引用用PNGをダウンロード',
    '<meta property="og:image" content="https://numpredo.com/data/numpredo-puzzle-analysis.png">',
    '<meta name="twitter:image" content="https://numpredo.com/data/numpredo-puzzle-analysis.png">',
  ],
  '/tools/generator/': ['id="quality-verification"', '唯一解検査', '実際の一問で見る生成・検証の4工程'],
  '/about/': ['id="editorial-policy"', 'id="operator"', '個人開発者', '広告主が問題の難易度判定や記事内容に関与することはありません'],
  '/contact/': ['問題・記事の訂正依頼', '運営・プライバシーに関する窓口', 'contact@numpredo.com'],
  '/privacy/': [
    'Google AdSense',
    '第三者配信事業者および広告ネットワーク',
    'Cookie、ウェブビーコン、端末識別子',
    'Google が認定した同意管理プラットフォーム',
    '全年齢向けサイト',
    '外部サービスと送信先',
  ],
  '/terms/': ['印刷問題集の非営利利用', '著作権', '免責事項'],
  '/daily/archive/': ['日付ごとに5段階を残す理由', 'アーカイブ問題の品質', '全4,395問の分析データ'],
  '/guide/solving-examples/': ['5問の比較表', '初級の例題', '超難問の例題', '題庫から構築時に再計算'],
  '/tools/candidate-checker/': ['data-candidate-checker', '候補数字の調べ方', '答えを見ずに「なぜ入らないか」を確認', 'EducationalApplication'],
};
const expectedPuzzlePaths = new Set<string>(
  JSON.parse(readFileSync(join(projectRoot, 'src/data/indexable-puzzles.json'), 'utf8')),
);
const analysisCsvPath = join(projectRoot, 'public/data/numpredo-puzzle-analysis.csv');
const analysisImagePath = join(projectRoot, 'public/data/numpredo-puzzle-analysis.png');

if (!existsSync(join(distDir, 'sitemap-0.xml'))) {
  console.error('❌ dist/sitemap-0.xml 不存在。请先运行 npm run build。');
  process.exit(1);
}

if (!existsSync(analysisCsvPath)) {
  console.error('❌ 缺少逐题分析数据 public/data/numpredo-puzzle-analysis.csv');
  process.exit(1);
}
const analysisRows = readFileSync(analysisCsvPath, 'utf8').trim().split('\n');
if (analysisRows.length !== 4396) {
  console.error(`❌ 逐题分析 CSV 应为 4,395 题，实际 ${analysisRows.length - 1} 题`);
  process.exit(1);
}
if (!existsSync(analysisImagePath)) {
  console.error('❌ 缺少研究图表 public/data/numpredo-puzzle-analysis.png');
  process.exit(1);
}
const analysisImage = await sharp(analysisImagePath).metadata();
if (analysisImage.format !== 'png' || analysisImage.width !== 1200 || analysisImage.height !== 630) {
  console.error(`❌ 研究图表应为 1200×630 PNG，实际 ${analysisImage.width}×${analysisImage.height} ${analysisImage.format}`);
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

function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[a-z]+|#\d+);/gi, ' ')
    .replace(/\s/g, '');
}

function contentShingles(text: string, size = 5): Set<string> {
  const out = new Set<string>();
  for (let index = 0; index <= text.length - size; index++) out.add(text.slice(index, index + size));
  return out;
}

function isContentOnlyPath(pathname: string): boolean {
  return pathname.startsWith('/guide/')
    || pathname.startsWith('/research/')
    || ['/about/', '/contact/', '/privacy/', '/terms/', '/variants/', '/variants/6x6/', '/variants/inequality/'].includes(pathname);
}

// 递归统计入口脚本的静态 import 图；动态 import（OCR 等）不属于首屏下载，不计入预算。
function initialScriptGraphBytes(sources: string[]): number {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)["'`](\.\/[^"'`]+)["'`]/g)) {
      visit(join(dirname(file), match[1]));
    }
  };
  for (const source of sources) {
    const pathname = new URL(source, siteOrigin).pathname;
    if (pathname.startsWith('/_astro/')) visit(join(distDir, pathname.slice(1)));
  }
  return [...seen].reduce((sum, file) => sum + statSync(file).size, 0);
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
const titleOwners = new Map<string, string[]>();
const descriptionOwners = new Map<string, string[]>();

for (const [pathname, { html }] of pages) {
  const expectedCanonical = `${siteOrigin}${pathname}`;
  const headHtml = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const canonicals = matches(headHtml, /<link rel="canonical" href="([^"]+)"/g);
  const robots = matches(headHtml, /<meta name="robots" content="([^"]+)"/g);
  const titles = matches(headHtml, /<title>([^<]+)<\/title>/g);
  const descriptions = matches(headHtml, /<meta name="description" content="([^"]+)"/g);
  const adsenseAccounts = matches(headHtml, /<meta name="google-adsense-account" content="([^"]+)"/g);
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const externalScripts = matches(html, /<script\b[^>]*\bsrc="([^"]+)"/g);

  if (isContentOnlyPath(pathname) && externalScripts.length > 0) {
    errors.push(`${pathname} 是纯内容页，却加载了外部脚本：${externalScripts.join('、')}`);
  }
  const initialJsBytes = initialScriptGraphBytes(externalScripts);
  if (initialJsBytes > maximumInitialJsBytes) {
    errors.push(`${pathname} 的首屏 JS 依赖图为 ${initialJsBytes} 字节（上限 ${maximumInitialJsBytes}）`);
  }

  if (titles.length !== 1) {
    errors.push(`${pathname} title 数量为 ${titles.length}（应为 1）`);
  } else {
    const owners = titleOwners.get(titles[0]) ?? [];
    owners.push(pathname);
    titleOwners.set(titles[0], owners);
  }
  if (descriptions.length !== 1) {
    errors.push(`${pathname} description 数量为 ${descriptions.length}（应为 1）`);
  } else {
    const owners = descriptionOwners.get(descriptions[0]) ?? [];
    owners.push(pathname);
    descriptionOwners.set(descriptions[0], owners);
  }
  if (adsenseAccounts.length !== 1 || adsenseAccounts[0] !== adsensePublisherId) {
    errors.push(`${pathname} 的 AdSense 所有权标记缺失或错误`);
  }
  const h1Count = (mainHtml.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) errors.push(`${pathname} 主内容 H1 数量为 ${h1Count}（应为 1）`);
  for (const image of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt="[^"]*"/i.test(image)) errors.push(`${pathname} 存在没有 alt 的图片`);
    if (!/\bwidth="[^"]+"/i.test(image) || !/\bheight="[^"]+"/i.test(image)) {
      errors.push(`${pathname} 存在没有固定 width/height 的图片（会产生布局偏移）`);
    }
  }
  for (const jsonLd of matches(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(jsonLd);
    } catch {
      errors.push(`${pathname} 存在无法解析的 JSON-LD`);
    }
  }

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

for (const [title, owners] of titleOwners) {
  if (owners.length > 1) errors.push(`title 重复：${title} 被 ${owners.join('、')} 共用`);
}
for (const [description, owners] of descriptionOwners) {
  if (owners.length > 1) errors.push(`description 重复：${description} 被 ${owners.join('、')} 共用`);
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

// 个人运营站必须明确回答“谁制作”。同时禁止已停用的 HowTo 标记和与实际运营
// 形态矛盾的“编辑部”署名，避免页面向审核系统传递虚构团队或过期富结果信号。
for (const pathname of indexablePaths) {
  const html = pages.get(pathname)?.html ?? '';
  if (!html.includes('"@id":"https://numpredo.com/#operator"')) {
    errors.push(`${pathname} 缺少个人运营责任者实体`);
  }
  if (html.includes('"@type":"HowTo"')) {
    errors.push(`${pathname} 仍使用 Google 已停用的 HowTo 结构化数据`);
  }
  if (html.includes('numpredo 編集部')) {
    errors.push(`${pathname} 仍使用与个人运营不一致的“编辑部”署名`);
  }
  if (html.includes('"@type":"Article"')) {
    if (!html.includes('"author":{"@id":"https://numpredo.com/#operator"}')) {
      errors.push(`${pathname} 的 Article 未关联个人运营责任者`);
    }
    if (!html.includes('numpredo 運営責任者')) {
      errors.push(`${pathname} 缺少可见的个人运营责任者署名`);
    }
  }
}

// AdSense の「低価値コンテンツ」を再発させないため、信頼情報ページ以外の
// index ページには、ナビ・フッター・スクリプトを除いた独自本文量を要求する。
for (const pathname of indexablePaths) {
  if (thinContentExemptPaths.has(pathname)) continue;
  const html = pages.get(pathname)?.html ?? '';
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const textLength = visibleText(mainHtml).length;
  if (textLength < minimumMainTextLength) {
    errors.push(`${pathname} 的主内容仅 ${textLength} 字符（最低 ${minimumMainTextLength}）`);
  }
}

// 字数无法识别“换题号、换少量参数”的模板页。使用正文 5 字片段 Jaccard 相似度，
// 直接阻止高度雷同的 index 页面再次进入站点（本轮整改前编号页最高 0.772）。
const indexableContent = [...indexablePaths].map((pathname) => {
  const html = pages.get(pathname)?.html ?? '';
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const text = visibleText(mainHtml);
  return { pathname, shingles: contentShingles(text) };
});
for (let left = 0; left < indexableContent.length; left++) {
  for (let right = left + 1; right < indexableContent.length; right++) {
    const a = indexableContent[left];
    const b = indexableContent[right];
    let intersection = 0;
    for (const shingle of a.shingles) if (b.shingles.has(shingle)) intersection++;
    const union = a.shingles.size + b.shingles.size - intersection;
    const similarity = union ? intersection / union : 0;
    if (similarity >= maximumContentSimilarity) {
      errors.push(`${a.pathname} 与 ${b.pathname} 正文相似度 ${(similarity * 100).toFixed(1)}%（上限 ${(maximumContentSimilarity * 100).toFixed(0)}%）`);
    }
  }
}

// 審査クローラが主要導線で 404 に当たらないよう、全ページの内部リンクと画像を確認する。
for (const [pathname, { html }] of pages) {
  const references = [
    ...matches(html, /href="([^"]+)"/g),
    ...matches(html, /<img\b[^>]*\bsrc="([^"]+)"/g),
  ];
  for (const reference of references) {
    // Cloudflare Email Address Obfuscation 会把静态 mailto: 改写成
    // /cdn-cgi/l/email-protection；该路径对审核爬虫返回 404。邮箱链接必须像 contact 页一样点击时组装。
    if (/^mailto:/i.test(reference)) {
      errors.push(`${pathname} 包含静态邮箱链接 ${reference}（会被 Cloudflare 改写成 404）`);
      continue;
    }
    if (/^(?:#|tel:|javascript:|data:)/i.test(reference)) continue;
    let target: URL;
    try {
      target = new URL(reference, `${siteOrigin}${pathname}`);
    } catch {
      errors.push(`${pathname} 包含无效链接 ${reference}`);
      continue;
    }
    if (target.origin !== siteOrigin) continue;
    let targetPath = target.pathname;
    if (!targetPath.endsWith('/') && !/\.[a-z0-9]+$/i.test(targetPath)) targetPath += '/';
    if (pages.has(targetPath)) continue;
    const assetPath = join(distDir, decodeURIComponent(target.pathname).replace(/^\//, ''));
    if (!existsSync(assetPath)) errors.push(`${pathname} 的内部资源不存在：${reference}`);
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
const sitemapModifiedAt = new Map(
  [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)]
    .map((match) => [new URL(match[1]).pathname, match[2]] as const),
);

// sitemap 与结构化数据是修改日期的双消费者。时区表示可以不同，但必须是同一时刻；
// Article 还必须公开初次发布日期，并在正文显示与 JSON-LD 一致的更新时间。
let checkedModifiedSchemas = 0;
let checkedArticles = 0;
for (const [pathname, { html }] of pages) {
  for (const raw of matches(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue; // 无法解析的 JSON-LD 已在上方统一报错。
    }
    const type = schema['@type'];
    const modified = typeof schema.dateModified === 'string' ? schema.dateModified : undefined;
    const published = typeof schema.datePublished === 'string' ? schema.datePublished : undefined;
    if (modified) {
      checkedModifiedSchemas++;
      const sitemapModified = sitemapModifiedAt.get(pathname);
      if (!sitemapModified) {
        errors.push(`${pathname} 的 JSON-LD 有 dateModified，但 sitemap 缺少 lastmod`);
      } else if (!Number.isFinite(Date.parse(modified)) || Date.parse(modified) !== Date.parse(sitemapModified)) {
        errors.push(`${pathname} 的 JSON-LD dateModified（${modified}）与 sitemap lastmod（${sitemapModified}）不一致`);
      }
    }
    if (type === 'Article') {
      checkedArticles++;
      if (!published || !modified) {
        errors.push(`${pathname} 的 Article 必须同时包含 datePublished 与 dateModified`);
        continue;
      }
      const publishedAt = Date.parse(published);
      const modifiedAt = Date.parse(modified);
      if (!Number.isFinite(publishedAt) || !Number.isFinite(modifiedAt) || publishedAt > modifiedAt) {
        errors.push(`${pathname} 的 Article 日期顺序无效：published=${published} modified=${modified}`);
      }
      if (!html.includes(`<time datetime="${modified}">`)) {
        errors.push(`${pathname} 的可见更新时间与 Article dateModified 不一致`);
      }
    }
  }
}

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
if (expectedPuzzlePaths.size > 0) errors.push('AdSense 低价值整改期间不得重新启用独立编号题页');
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
if (!/User-agent:\s*Mediapartners-Google[\s\S]*?Allow:\s*\//i.test(robotsText)) {
  errors.push('robots.txt 未明确允许 Mediapartners-Google 审核爬虫');
}

const adsTextPath = join(distDir, 'ads.txt');
if (!existsSync(adsTextPath)) {
  errors.push('dist/ads.txt 不存在');
} else {
  const adsRecords = readFileSync(adsTextPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (!adsRecords.includes(adsenseRecord)) errors.push('ads.txt 缺少正确的 Google AdSense 发布商记录');
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
console.log(`  日期一致性：Article ${checkedArticles} / 含 dateModified schema ${checkedModifiedSchemas}`);
