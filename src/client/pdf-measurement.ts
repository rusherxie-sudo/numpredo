import { npTrack as track } from './np01-track.ts';
const collections = ['4x4','diagonal','killer','candidate-notes','practice-hidden-single','practice-pointing','practice-naked-pair','practice-naked-triple','practice-x-wing','practice-skyscraper'];
export function pdfMeta(path:string):{pdf_kind:string;pdf_role:string}|null {
 if(/^\/downloads\/numpredo-(beginner|intermediate|advanced|hard|extreme|senior)-(12|60)\.pdf$/.test(path))return {pdf_kind:'standard',pdf_role:'combined'};
 let m=path.match(/^\/downloads\/(variants|activity|progression)\/numpredo-([^/]+)-(questions|answers|guide)\.pdf$/);
 if(m){const valid=m[1]==='variants'?['6x6-01','inequality-01','16x16-01'].includes(m[2])&&m[3]!=='guide':m[1]==='activity'?['activity-01','activity-02'].includes(m[2])&&(m[2]!=='activity-01'||m[3]!=='guide'):m[2]==='progression-01';return valid?{pdf_kind:m[1]==='variants'?'variant':m[1],pdf_role:m[3]}:null;}
 m=path.match(/^\/downloads\/collections\/([a-z0-9-]+)-(questions|answers)\.pdf$/);
 return m&&collections.includes(m[1])?{pdf_kind:'collection',pdf_role:m[2]}:null;
}
export function previewMeta(path:string):{pdf_kind:string;pdf_role:string}|null {
 const c=path.match(/^\/images\/collections\/([a-z0-9-]+)-(questions|answers)\.png$/);
 if(c&&collections.includes(c[1]))return {pdf_kind:'collection',pdf_role:c[2]};
 const m=path.match(/^\/images\/print\/(6x6|inequality|16x16|activity|activity02|progression)-preview\.png$/);
 return m?{pdf_kind:m[1].startsWith('activity')?'activity':m[1]==='progression'?'progression':'variant',pdf_role:'questions'}:null;
}
const initialized=Symbol.for('numpredo.np01.pdf');
export function initPdfMeasurement(doc:Document=document):void {
 const state=doc as Document & {[key:symbol]:boolean};
 if(state[initialized])return;state[initialized]=true;
 const activate=(event:MouseEvent)=>{
  if(event.type==='auxclick'?event.button!==1:event.button!==0)return;
  const target=event.target;if(!(target instanceof Element))return;
  const a=target.closest<HTMLAnchorElement>('a[href]');if(!a)return;
  try{const u=new URL(a.href,location.href);if(u.origin!==location.origin)return;
   const meta=pdfMeta(u.pathname);if(!meta)return;
   track('pdf_link_click',{...meta,pdf_entry:a.querySelector('img')?'preview':a.hasAttribute('download')||a.matches('[data-expansion-download]')?'download':'related'});
  }catch{/* navigation must work even without analytics */}
 };
 doc.addEventListener('click',activate);doc.addEventListener('auxclick',activate);
 if(!('IntersectionObserver' in window))return;
 const seen=new WeakSet<Element>(),ratios=new WeakMap<Element,number>();
 const report=(img:HTMLImageElement)=>{
  if(seen.has(img)||!img.complete||img.naturalWidth===0||img.naturalHeight===0||(ratios.get(img)??0)<0.5||img.getClientRects().length===0)return;
  const meta=previewMeta(new URL(img.src,location.href).pathname);if(!meta)return;
  seen.add(img);observer.unobserve(img);track('pdf_preview_view',meta);
 };
 const observer=new IntersectionObserver(entries=>{for(const e of entries){ratios.set(e.target,e.intersectionRatio);report(e.target as HTMLImageElement);}},{threshold:[0,0.5]});
 doc.querySelectorAll<HTMLImageElement>('img').forEach(img=>{if(!previewMeta(new URL(img.src,location.href).pathname))return;img.addEventListener('load',()=>report(img));observer.observe(img);});
}
