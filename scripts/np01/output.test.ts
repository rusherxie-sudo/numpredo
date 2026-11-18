import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {pdfMeta,previewMeta} from '../../src/client/pdf-measurement.ts';
const walk=(d:string):string[]=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
function graph(html:string,optional=false):string[] {
 const seen=new Set<string>();
 const visit=(f:string):void=>{if(seen.has(f)||!existsSync(f))return;seen.add(f);for(const m of readFileSync(f,'utf8').matchAll(optional?/(?:from\s*|import\s*\(?)["'`](\.\/[^"'`]+)["'`]/g:/(?:from\s*|import\s*)["'`](\.\/[^"'`]+)["'`]/g))visit(join(dirname(f),m[1]));};
 for(const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g))visit(join('dist',m[1]));
 return [...seen];
}
function assertTutorialObservation(html:string,pdfs:string[]):void {
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(code=>code.includes('pdf_link_click'));
 assert.equal(scripts.length,1,'tutorial has one inline observer');
 assert.equal(pdfs.length,3,'three real tutorial download anchors');
 const origin='https://test.invalid',events:unknown[][]=[],handlers=new Map<string,(event:unknown)=>void>();
 class Link {
  href:string;download:boolean;inside:boolean;
  constructor(href:string,download=true,inside=true){this.href=href;this.download=download;this.inside=inside;}
  closest(selector:string){assert.equal(selector,'.walkthrough a[download]');return this.download&&this.inside?this:null;}
 }
 const root={addEventListener:(name:string,fn:(event:unknown)=>void)=>{assert(!handlers.has(name),'one listener per event');handlers.set(name,fn);}};
 runInNewContext(scripts[0],{document:{getElementById:(id:string)=>{assert.equal(id,'beginner-walkthrough');return root;}},window:{gtag:(...args:unknown[])=>events.push(args)},Element:Link,URL,location:{origin,href:origin+'/guide/how-to-solve/'}},{timeout:1000});
 const expected:unknown[][]=[];
 for(const path of pdfs)for(const [type,button] of [['click',0],['auxclick',1]] as const){
  assert.equal(pdfMeta(path)?.pdf_kind,'tutorial');
  let prevented=false;
  handlers.get(type)!({type,button,target:new Link(origin+path),preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,false,'download navigation remains native');
  expected.push(['event','pdf_link_click',{measurement_version:'np01',...pdfMeta(path),pdf_entry:'download'}]);
 }
 assert.deepEqual(JSON.parse(JSON.stringify(events)),expected,'actual inline code emits six finite events');
 for(const target of [new Link(origin+'/downloads/beginner-tutorial/unknown.pdf'),new Link('https://outside.invalid'+pdfs[0]),new Link(origin+pdfs[0],false),new Link(origin+pdfs[0],true,false)])handlers.get('click')!({type:'click',button:0,target});
 handlers.get('auxclick')!({type:'auxclick',button:2,target:new Link(origin+pdfs[0])});
 assert.equal(events.length,expected.length,'unrelated links and buttons do not emit');
}
test('every PDF-bearing output observes actual links; all PDF and preview mappings known',()=>{
 let pages=0,links=0,images=0;
 for(const f of walk('dist').filter(x=>x.endsWith('.html'))){const html=readFileSync(f,'utf8');
  const pdfs=[...html.matchAll(/href="(\/downloads\/[^"?#]+\.pdf)(?:[?#][^"]*)?"/g)];
  if(!pdfs.length)continue;pages++;
  if(f===join('dist','guide','how-to-solve','index.html'))assertTutorialObservation(html,pdfs.map(m=>m[1]));
  else assert(graph(html,true).some(x=>readFileSync(x,'utf8').includes('pdf_link_click')),f+' observes actual PDF links');
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
