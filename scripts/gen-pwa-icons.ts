import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

// Reuse the site's actual Sudoku mark; keep all essential artwork in the
// central safe area of the maskable icon rather than inventing a new brand.
await mkdir('public/icons', { recursive: true });
const svg = await readFile('public/favicon.svg', 'utf8');
for (const size of [192, 512, 180]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png`);
}
const mark = await sharp(Buffer.from(svg)).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#f7f5f0' } })
  .composite([{ input: mark, left: 76, top: 76 }]).png().toFile('public/icons/maskable-512.png');
