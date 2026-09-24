"""Render verified variant catalog; deterministic A4 questions and separate answers."""
import importlib.util
import json
from pathlib import Path
spec = importlib.util.spec_from_file_location('pdf', Path(__file__).with_name('gen-print-pdfs.py'))
pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf)
OUT = pdf.OUTPUT_DIR / 'variants'
pdf.register_japanese_font()
manifest = json.loads((OUT / 'manifest.json').read_text())

def board(c, x, y, width, pack, item, answer):
    n, br, bc = pack['size'], pack['blockRows'], pack['blockCols']
    cell = width / n
    c.setStrokeColor(pdf.INK)
    for i in range(n+1):
        c.setLineWidth(1.4 if i % bc == 0 else .35)
        c.line(x+i*cell, y, x+i*cell, y+width)
        c.setLineWidth(1.4 if i % br == 0 else .35)
        c.line(x, y+i*cell, x+width, y+i*cell)
    values = item['solution'] if answer else item['puzzle']
    for i, v in enumerate(values):
        if v in '.0': continue
        c.setFillColor(pdf.INK)
        c.setFont('Helvetica-Bold' if item['puzzle'][i] not in '.0' else 'Helvetica', cell*.48)
        c.drawCentredString(x+(i%n+.5)*cell, y+(n-i//n-.67)*cell, v)
    # Vector signs avoid font substitution for vertical inequality symbols.
    for a, b, op in item.get('signs', []):
        horizontal = b == a+1
        cx=x+(a%n+(1 if horizontal else .5))*cell
        cy=y+(n-a//n-(.5 if horizontal else 1))*cell
        d=cell*.11
        c.setFillColorRGB(1,1,1)
        c.rect(cx-d*1.6,cy-d*1.6,d*3.2,d*3.2,fill=1,stroke=0)
        c.setStrokeColor(pdf.INK)
        c.setLineWidth(.9)
        path=c.beginPath()
        if horizontal:
            sign=1 if op=='<' else -1
            path.moveTo(cx+sign*d,cy+d);path.lineTo(cx-sign*d,cy);path.lineTo(cx+sign*d,cy-d)
        else:
            sign=1 if op=='<' else -1
            path.moveTo(cx-d,cy-sign*d);path.lineTo(cx,cy+sign*d);path.lineTo(cx+d,cy-sign*d)
        c.drawPath(path)

for pack in manifest['packs']:
    count=pack['perPage']
    for answer in [False,True]:
        name='answers' if answer else 'questions'
        c=pdf.Canvas(str(OUT/f"numpredo-{pack['slug']}-01-{name}.pdf"),pagesize=pdf.A4,pageCompression=1,invariant=1)
        c.setTitle(pack['name']+' セット01・'+('解答' if answer else '問題'))
        c.setAuthor('numpredo')
        pages=(len(pack['puzzles'])+count-1)//count
        for page in range(pages):
            c.setFillColor(pdf.INK);c.setFont(pdf.JAPANESE_FONT,16)
            c.drawString(18*pdf.mm,280*pdf.mm,pack['name']+' セット01 — '+('解答' if answer else '問題'))
            c.setFont(pdf.JAPANESE_FONT,10)
            c.drawString(18*pdf.mm,269*pdf.mm,'問題のIDと同じ解答を確認してください。' if answer else '日付：____________    お名前：________________')
            if pack['size']==16: rule='1〜9とA〜Gを各行・列・4×4の枠に一つずつ。A〜Gは別々の記号です。'
            elif pack['size']==6: rule='1〜6を各行・列・太枠の2行×3列に一つずつ入れます。'
            else: rule='1〜9を各行・列・3×3に一つずつ。不等号の尖った側が小さい数です。'
            c.setFont(pdf.JAPANESE_FONT,9);c.drawString(18*pdf.mm,258*pdf.mm,rule)
            for slot,item in enumerate(pack['puzzles'][page*count:(page+1)*count]):
                width=(94 if count==2 else 172)*pdf.mm
                x=(pdf.A4[0]-width)/2
                y=([148,34][slot] if count==2 else 63)*pdf.mm
                c.setFillColor(pdf.INK);c.setFont('Helvetica',10)
                c.drawString(x,y+width+4*pdf.mm,item['id'])
                board(c,x,y,width,pack,item,answer)
            c.setFillColor(pdf.INK);c.setFont(pdf.JAPANESE_FONT,8)
            c.drawString(18*pdf.mm,24*pdf.mm,'A4・縦・実際のサイズで印刷。問題と解答は別ファイルです。')
            c.setFont('Helvetica',8)
            c.drawString(18*pdf.mm,15*pdf.mm,f"numpredo.com/print/{pack['slug']}/ | Set 01")
            c.drawRightString(192*pdf.mm,15*pdf.mm,f'{page+1} / {pages}')
            c.showPage()
        c.save()
print('Variant PDFs: 13 question pages + 13 answer pages, 6 files')
