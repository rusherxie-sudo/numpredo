// 独立首页练习，不读写正式游戏进度、统计状态或题库。
for(const root of Array.from(document.querySelectorAll<HTMLElement>('[data-first-move]'))){
 const controls=root.querySelector<HTMLElement>('[data-first-controls]')!;
 const status=root.querySelector<HTMLElement>('[data-first-feedback]')!;
 const cell=root.querySelector<HTMLElement>('[data-first-target]')!;
 const reason=root.querySelector<HTMLDetailsElement>('[data-first-reason]')!;
 const answer=Number(root.dataset.answer);
 const rejections:Record<string,string>=JSON.parse(root.dataset.rejections!);
 const buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-first-digit]'));
 controls.hidden=false;
 for(const button of buttons) button.addEventListener('click',()=>{
   for(const other of buttons)other.setAttribute('aria-pressed',String(other===button));
   const digit=Number(button.dataset.firstDigit);
   cell.textContent=digit===answer?String(answer):'？';
   status.textContent=digit===answer?'正解です。'+answer+'だけが残ります。「答えと、数字をしぼる理由を見る」で確かめましょう。':digit+'は置けません。'+rejections[String(digit)]+'行・列・ブロックをもう一度見てみましょう。';
 });
 root.querySelector<HTMLButtonElement>('[data-first-reset]')!.addEventListener('click',()=>{
  cell.textContent='？';status.textContent='最初の状態に戻しました。';reason.open=false;
  for(const button of buttons)button.setAttribute('aria-pressed','false');
 });
}
