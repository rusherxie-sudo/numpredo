"""Render selected puzzle sets as deterministic A4 questions/answers plus actual previews."""
import importlib.util,json
import pymupdf
from PIL import Image
from pathlib import Path
spec=importlib.util.spec_from_file_location('pdf',Path(__file__).with_name('gen-print-pdfs.py'))
pdf=importlib.util.module_from_spec(spec);spec.loader.exec_module(pdf);pdf.register_japanese_font()
out=pdf.ROOT/'public/downloads/collections';images=pdf.ROOT/'public/images/collections';images.mkdir(parents=True,exist_ok=True)
manifest=json.loads((out/'manifest.json').read_text())
def board(c,x,y,width,pack,item,answer):
 n=pack['size'];cell=width/n;b=2 if n==4 else 3
 c.setFillColorRGB(1,1,1);c.rect(x,y,width,width,fill=1,stroke=0)
 if pack['kind']=='diagonal':
  c.setStrokeColorRGB(.55,.55,.55);c.setLineWidth(.7);c.setDash(2,2)
  c.line(x,y,x+width,y+width);c.line(x,y+width,x+width,y);c.setDash()
 for i in range(n+1):
  c.setStrokeColor(pdf.INK if i%b==0 else pdf.LIGHT);c.setLineWidth(1.2 if i%b==0 else .4)
  c.line(x+i*cell,y,x+i*cell,y+width);c.line(x,y+i*cell,x+width,y+i*cell)
 if pack['kind']=='notes' and not answer:
  c.setStrokeColorRGB(.8,.8,.8);c.setLineWidth(.25)
  for i,v in enumerate(item['puzzle']):
   if v not in '.0':continue
   cx=x+(i%n)*cell;cy=y+(n-1-i//n)*cell
   for j in [1,2]:c.line(cx+j*cell/3,cy,cx+j*cell/3,cy+cell);c.line(cx,cy+j*cell/3,cx+cell,cy+j*cell/3)
 if pack['kind']=='killer':
  inset=cell*.09
  for cage in item['cages']:
   cells=set(cage['cells']);c.setStrokeColor(pdf.INK);c.setLineWidth(.65);c.setDash(1.5,1.5)
   for i in cells:
    r,col=divmod(i,9);cx=x+col*cell;cy=y+(8-r)*cell
    if r==0 or i-9 not in cells:c.line(cx+inset,cy+cell-inset,cx+cell-inset,cy+cell-inset)
    if r==8 or i+9 not in cells:c.line(cx+inset,cy+inset,cx+cell-inset,cy+inset)
    if col==0 or i-1 not in cells:c.line(cx+inset,cy+inset,cx+inset,cy+cell-inset)
    if col==8 or i+1 not in cells:c.line(cx+cell-inset,cy+inset,cx+cell-inset,cy+cell-inset)
   c.setDash();i=min(cells);cx=x+(i%9)*cell+inset*1.5;cy=y+(9-i//9)*cell-inset*1.5
   c.setFillColorRGB(1,1,1);c.rect(cx-1,cy-cell*.16,cell*.43,cell*.21,stroke=0,fill=1)
   c.setFillColor(pdf.INK);c.setFont('Helvetica',max(6,cell*.19));c.drawString(cx,cy-cell*.14,str(cage['sum']))
 values=item['solution'] if answer else item['puzzle']
 for i,v in enumerate(values):
  if v in '.0':continue
  c.setFillColor(pdf.INK);c.setFont('Helvetica-Bold' if item['puzzle'][i] not in '.0' else 'Helvetica',cell*(.43 if pack['kind']=='killer' else .48))
  c.drawCentredString(x+(i%n+.5)*cell,y+(n-i//n-.70)*cell,v)
for pack in manifest['packs']:
 perpage=1 if pack['kind']=='notes' else 2
 for answer in [False,True]:
  label='answers' if answer else 'questions';dest=out/f"{pack['slug']}-{label}.pdf"
  c=pdf.Canvas(str(dest),pagesize=pdf.A4,pageCompression=1,invariant=1)
  c.setTitle(pack['name']+' — '+('解答' if answer else '問題'));c.setAuthor('numpredo')
  pages=(len(pack['items'])+perpage-1)//perpage
  for page in range(pages):
   c.setFillColor(pdf.INK);c.setFont(pdf.JAPANESE_FONT,13);c.drawString(16*pdf.mm,281*pdf.mm,pack['name'])
   c.setFont(pdf.JAPANESE_FONT,9);c.drawString(16*pdf.mm,273*pdf.mm,'解答：問題IDが一致することを確認してください。' if answer else '日付：_______________  名前：__________________')
   # Wrap Japanese rules by character count to stay within A4 margins.
   for j in range(0,len(pack['rule']),54):c.drawString(16*pdf.mm,(266-j//54*5)*pdf.mm,pack['rule'][j:j+54])
   for slot,item in enumerate(pack['items'][page*perpage:(page+1)*perpage]):
    width=(164 if perpage==1 else 94)*pdf.mm;x=(pdf.A4[0]-width)/2;y=(65 if perpage==1 else [148,35][slot])*pdf.mm
    c.setFont('Helvetica',9);c.drawString(x,y+width+4*pdf.mm,f"{page*perpage+slot+1}. {item['id']}")
    board(c,x,y,width,pack,item,answer)
   c.setFillColor(pdf.INK);c.setFont(pdf.JAPANESE_FONT,8);c.drawString(16*pdf.mm,23*pdf.mm,'A4・縦・100%で印刷。利用条件はサイトの利用規約をご確認ください。')
   c.setFont('Helvetica',8);c.drawString(16*pdf.mm,15*pdf.mm,'numpredo.com'+pack['path']);c.drawRightString(194*pdf.mm,15*pdf.mm,f'{page+1}/{pages}');c.showPage()
  c.save()
  doc=pymupdf.open(dest);pix=doc[0].get_pixmap(matrix=pymupdf.Matrix(1.25,1.25),alpha=False)
  image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);image=image.resize((707,1000));image.save(images/f"{pack['slug']}-{label}.png",optimize=True);doc.close()
print('Generated 20 PDFs and 20 previews from the actual first PDF pages')
