// Build-time serialization keeps the exact shared validator in a tiny inline script.
// No external module on content-only guide pages; pending is local, finite and expires.
import {returnPath} from './learning-transfer.ts';
export const guideReturnScript=`(()=>{const safe=${returnPath.toString()};try{
 const t=JSON.parse(sessionStorage.getItem('numpredo.learning.np01')||'null');
 const back=safe(new URLSearchParams(location.search).get('return'));
 if(!t||t.v!==1||t.state!=='outbound'||!back||t.back!==back||t.destination!==location.pathname||!Number.isFinite(t.at)||Date.now()<t.at||Date.now()-t.at>7200000)return;
 t.visited=true;sessionStorage.setItem('numpredo.learning.np01',JSON.stringify(t));
 const p=document.createElement('p'),a=document.createElement('a');a.href=back;a.dataset.learningReturn='';a.textContent='元のゲームに戻って続きを解く →';p.append(a);document.querySelector('main')?.append(p);
}catch{}})();`;
