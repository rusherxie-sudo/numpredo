"""Build actual PDF first-page previews and social cards, with source hashes."""
import hashlib,json
from pathlib import Path
import pymupdf
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/images/print'
OUT.mkdir(parents=True,exist_ok=True)
font='/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
def drawtext(draw,xy,text,size,color='#17211d'):
    draw.text(xy,text,font=ImageFont.truetype(font,size),fill=color)
records=[]
for item in json.loads((ROOT/'src/data/print-resources.json').read_text()):
    pdf=ROOT/'public'/item['pdf'].lstrip('/')
    doc=pymupdf.open(pdf);page=doc[0]
    pix=page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25),alpha=False)
    preview=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    preview.save(OUT/f"{item['slug']}-preview.png",optimize=True)
    card=Image.new('RGB',(1200,630),'#f4f6f1');draw=ImageDraw.Draw(card)
    draw.rectangle((0,0,18,630),fill='#1d7f65')
    drawtext(draw,(60,48),'numpredo  |  無料プリント',25,'#1d7f65')
    # Explicit line breaks keep every title inside the left column.
    titles={'6x6':['6×6ナンプレ','入門6問'], 'activity':['ナンプレ配布セット','4回分・8問'], 'inequality':['不等号ナンプレ','入門6問'], '16x16':['16×16ナンプレ','大型4問']}
    for i,line in enumerate(titles[item['slug']]):drawtext(draw,(60,140+i*74),line,48)
    drawtext(draw,(60,334),'問題と答えを別々にダウンロード',27)
    drawtext(draw,(60,390),item['detail'],22)
    drawtext(draw,(60,475),'A4・登録不要',27,'#1d7f65')
    drawtext(draw,(60,551),'numpredo.com'+item['href'].split('#')[0],22)
    thumb=preview.copy();thumb.thumbnail((392,554))
    card.paste(thumb,(755,38))
    card.save(OUT/f"{item['slug']}-share.png",optimize=True)
    records.append({'slug':item['slug'],'pdf':item['pdf'],'pdfSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'previewWidth':preview.width,'previewHeight':preview.height,'shareWidth':1200,'shareHeight':630})
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('Four actual PDF previews + four 1200×630 social cards generated')
