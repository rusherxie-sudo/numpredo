// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

export default defineConfig({
  site: 'https://numpredo.com',
  build: { format: 'directory' },
  integrations: [
    sitemap(),
    // GA4 跑在 web worker（主线程零负担，保 CWV）。forward 让 worker 内的 dataLayer.push 同步回主线程。
    partytown({ config: { forward: ['dataLayer.push'] } }),
  ],
});
