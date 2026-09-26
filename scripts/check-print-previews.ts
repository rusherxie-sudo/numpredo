import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const resources=JSON.parse(readFileSync('src/data/print-resources.json','utf8'));
const manifest=JSON.parse(readFileSync('public/images/print/manifest.json','utf8'));
for(const r of resources){
 const m=manifest.find((p:{slug:string})=>p.slug===r.slug);assert.ok(m);
 assert.equal(m.pdfSha256,createHash('sha256').update(readFileSync(`public${r.pdf}`)).digest('hex'),'Regenerate previews after changing PDF');
 const image=await sharp(`public/images/print/${r.slug}-preview.png`).metadata();assert.equal(image.width,m.previewWidth);assert.equal(image.height,m.previewHeight);
 const card=await sharp(`public/images/print/${r.slug}-share.png`).metadata();assert.equal(card.width,1200);assert.equal(card.height,630);
 const html=readFileSync(`dist${r.href.split('#')[0]}index.html`,'utf8');
 assert.ok(html.includes(`https://numpredo.com/images/print/${r.slug}-share.png`));
 assert.ok(html.includes(`/images/print/${r.slug}-preview.png`));
 assert.ok(html.includes(r.pdf));
}
const home=readFileSync('dist/index.html','utf8');assert.ok(home.includes('data-level="home-beginner"'));assert.ok(home.includes('href="#home-game"'));
console.log('✓ Actual PDF preview hashes, image dimensions, printable metadata and isolated homepage game verified');
