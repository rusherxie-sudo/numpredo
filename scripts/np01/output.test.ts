import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pdfMeta,previewMeta} from '../../src/client/pdf-measurement.ts';
const walk=(d:string):string[]=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
function graph(html:string,optional=false):string[] {
 const seen=new Set<string>();
 const visit=(f:string):void=>{if(seen.has(f)||!existsSync(f))return;seen.add(f);for(const m of readFileSync(f,'utf8').matchAll(optional?/(?:from\s*|import\s*\(?)["'`](\.\/[^"'`]+)["'`]/g:/(?:from\s*|import\s*)["'`](\.\/[^"'`]+)["'`]/g))visit(join(dirname(f),m[1]));};
 for(const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g))visit(join('dist',m[1]));
 return [...seen];
}
test('every PDF-bearing output has shared observation; all PDF and preview mappings known',()=>{
 let pages=0,links=0,images=0;
 for(const f of walk('dist').filter(x=>x.endsWith('.html'))){const html=readFileSync(f,'utf8');
  const pdfs=[...html.matchAll(/href="(\/downloads\/[^"?#]+\.pdf)(?:[?#][^"]*)?"/g)];
  if(!pdfs.length)continue;pages++;
  assert(graph(html,true).some(x=>readFileSync(x,'utf8').includes('pdf_link_click')),'PDF page observes actual links');
  for(const m of pdfs){assert(pdfMeta(m[1]),'finite mapping');links++;}
  for(const m of html.matchAll(/src="(\/images\/(?:print\/[^"/]+-preview|collections\/[^"/]+-(?:questions|answers))\.png)"/g)){assert(previewMeta(m[1]));images++;}
 }
 console.log(JSON.stringify({pdfPages:pages,pdfLinks:links,previewElements:images}));assert(pages>0&&links>0&&images>0);
});
// 源码、静态资源与最终产物都不能重新引入已移除的百度统计。
test('production sources and shipped output contain no Baidu analytics',()=>{
 const forbidden= /hm\.baidu\.com|_hmt\b|loadBaiduAnalytics|sensitiveBaiduPage|百度統計|百度统计/i;
 let checked=0;
 for(const root of ['src','public','dist'])for(const f of walk(root).filter(x=>/\.(?:astro|[cm]?js|ts|html|css|json|txt|xml|svg|webmanifest)$/.test(x))){
  assert(!forbidden.test(readFileSync(f,'utf8')),f+' must not ship Baidu analytics');checked++;
 }
 assert(checked>0);console.log(JSON.stringify({baiduFreeFiles:checked}));
});
test('all initial script graphs remain within unchanged 64 KiB budget',()=>{
 let max=0;for(const f of walk('dist').filter(x=>x.endsWith('.html'))){const bytes=graph(readFileSync(f,'utf8')).reduce((n,x)=>n+statSync(x).size,0);max=Math.max(max,bytes);assert(bytes<=65536,'original initial script budget');}
 console.log(JSON.stringify({maximumInitialBytes:max,limit:65536}));
});
