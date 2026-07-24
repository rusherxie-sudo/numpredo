// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 每个 URL 的真实修改日（git 提交日，非构建日）。由 `node scripts/gen-sitemap-lastmod.ts`
// 离线生成并提交进 git——构建时只读它，不现算（CF Pages 可能 shallow clone，现算会失真）。
const lastmod = JSON.parse(
  readFileSync(new URL('./src/data/sitemap-lastmod.json', import.meta.url), 'utf-8'),
);
const indexablePuzzles = new Set(
  JSON.parse(readFileSync(new URL('./src/data/indexable-puzzles.json', import.meta.url), 'utf-8')),
);
const numberedPuzzlePattern = /^\/play\/(?:beginner|intermediate|advanced|hard|extreme)\/\d+\/$/;

export default defineConfig({
  site: 'https://numpredo.com',
  // CSS 内联进 HTML:消除 render-blocking 的 <link> 请求 + 断开关键请求链(网络依赖树)。
  // 内容站每页 CSS 仅 ~13KB(gzip 后更小)、零 JS,内联换来的首屏提速远超失去的跨页缓存。
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    sitemap({
      // 個人データページと、検索需要を確認できていない量産型の問題詳細は sitemap から除外する。
      // 問題自体は各難易度ページで引き続き全90問を遊べる。
      filter: (page) => {
        const pathname = new URL(page).pathname;
        if (pathname === '/stats/') return false;
        if (numberedPuzzlePattern.test(pathname)) return indexablePuzzles.has(pathname);
        return true;
      },
      // 给每个 URL 注入真实 <lastmod>；映射表里没有的页（理论上不会有）则不写，绝不用构建日兜底。
      serialize(item) {
        const date = lastmod[new URL(item.url).pathname];
        if (date) item.lastmod = date;
        return item;
      },
    }),
    // GA4 已改回主线程 async 加载(Partytown forward 实测失效——主线程自定义事件永远到不了 worker,
    // 详见 Base.astro 注释)。若未来重新引入 worker 化方案,先在线上实测 forward 通道再上。
  ],
});
