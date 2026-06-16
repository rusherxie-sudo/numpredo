// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

// 每个 URL 的真实修改日（git 提交日，非构建日）。由 `node scripts/gen-sitemap-lastmod.ts`
// 离线生成并提交进 git——构建时只读它，不现算（CF Pages 可能 shallow clone，现算会失真）。
const lastmod = JSON.parse(
  readFileSync(new URL('./src/data/sitemap-lastmod.json', import.meta.url), 'utf-8'),
);

export default defineConfig({
  site: 'https://numpredo.com',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // 给每个 URL 注入真实 <lastmod>；映射表里没有的页（理论上不会有）则不写，绝不用构建日兜底。
      serialize(item) {
        const date = lastmod[new URL(item.url).pathname];
        if (date) item.lastmod = date;
        return item;
      },
    }),
    // GA4 跑在 web worker（主线程零负担，保 CWV）。forward 让 worker 内的 dataLayer.push 同步回主线程。
    partytown({ config: { forward: ['dataLayer.push'] } }),
  ],
});
