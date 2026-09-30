"""Four 4x4 + four 6x6 source-matched lessons, separate answers and organizer log."""
import importlib.util,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('pdf',Path(__file__).with_name('gen-print-pdfs.py'))
pdf=importlib.util.module_from_spec(spec);spec.loader.exec_module(pdf)
pdf.register_japanese_font()
OUT=pdf.OUTPUT_DIR/'progression'
packs=json.loads((OUT/'manifest.json').read_text())['packs']
def board(c,x,y,width,pack,item,answer):
    n=pack['size'];cell=width/n
    c.setStrokeColor(pdf.INK)
    for i in range(n+1):
        c.setLineWidth(1.4 if i%pack['blockCols']==0 else .4);c.line(x+i*cell,y,x+i*cell,y+width)
        c.setLineWidth(1.4 if i%pack['blockRows']==0 else .4);c.line(x,y+i*cell,x+width,y+i*cell)
    for i,v in enumerate(item['solution'] if answer else item['puzzle']):
        if v=='.':continue
        c.setFont('Helvetica-Bold' if item['puzzle'][i]!='.' else 'Helvetica',cell*.46)
        c.drawCentredString(x+(i%n+.5)*cell,y+(n-i//n-.67)*cell,v)
for answer in [False,True]:
    name='answers' if answer else 'questions';c=pdf.Canvas(str(OUT/f'numpredo-progression-01-{name}.pdf'),pagesize=pdf.A4,invariant=1)
    c.setTitle('4×4から6×6へ・'+('解答' if answer else '入門8問'));c.setAuthor('numpredo')
    page=0
    for pack in packs:
        for offset in [0,2]:
            page+=1;c.setFillColor(pdf.INK);c.setFont(pdf.JAPANESE_FONT,16)
            c.drawString(18*pdf.mm,280*pdf.mm,f"4×4から6×6へ — {pack['size']}×{pack['size']}"+(' 解答' if answer else ''))
            c.setFont(pdf.JAPANESE_FONT,10);c.drawString(18*pdf.mm,269*pdf.mm,'問題IDで答えを照合してください。' if answer else '日付：____________   名前：________________')
            for slot,item in enumerate(pack['puzzles'][offset:offset+2]):
                width=94*pdf.mm;x=(pdf.A4[0]-width)/2;y=[148,34][slot]*pdf.mm
                c.setFont('Helvetica',10);c.drawString(x,y+width+4*pdf.mm,item['id']);board(c,x,y,width,pack,item,answer)
            c.setFont(pdf.JAPANESE_FONT,9)
            rule=f"1〜{pack['size']}を横・縦・太枠に一つずつ。太枠は{pack['blockRows']}行×{pack['blockCols']}列です。"
            c.drawString(18*pdf.mm,23*pdf.mm,rule);c.setFont('Helvetica',8)
            c.drawString(18*pdf.mm,15*pdf.mm,'numpredo.com/print/progression/ | Set 01');c.drawRightString(192*pdf.mm,15*pdf.mm,f'{page} / 4');c.showPage()
    c.save()
c=pdf.Canvas(str(OUT/'numpredo-progression-01-guide.pdf'),pagesize=pdf.A4,invariant=1)
c.setTitle('4×4から6×6へ・使い方と記録');c.setAuthor('numpredo');c.setFillColor(pdf.INK)
lines=[('4×4から6×6へ — 使い方と記録',17),('問題・答えは各4ページ。この用紙は配布者用1ページです。',11),('1. 最初は4×4。横、縦、2行×2列の枠を指で確認します。',11),('2. 数字の理由を説明できたら、6×6の2行×3列の枠を確認します。',11),('3. 速さを比べず、一問ずつ。疲れたら途中でも休みます。',11),('4. 覚えた答えではなく、行・列・枠を見比べた理由を尋ねます。',11),('配布日・問題ID・できたこと・次回のメモを残してください。',11)]
y=278
for text,size in lines:c.setFont(pdf.JAPANESE_FONT,size);c.drawString(18*pdf.mm,y*pdf.mm,text);y-=14
for pack in packs:
    for item in pack['puzzles']:
        c.setFont('Helvetica',10);c.drawString(18*pdf.mm,y*pdf.mm,f"[ ] {item['id']}   Date: __________");c.setFont(pdf.JAPANESE_FONT,10);c.drawString(100*pdf.mm,y*pdf.mm,'メモ：________________');y-=15
c.setFont(pdf.JAPANESE_FONT,9);c.drawString(18*pdf.mm,30*pdf.mm,'問題は既存のオンライン題と共通です。6×6セット01とも重複します。')
c.drawString(18*pdf.mm,23*pdf.mm,'学校等の非営利・無料配布に使用できます。販売やPDF再掲載はできません。')
c.setFont('Helvetica',8);c.drawString(18*pdf.mm,15*pdf.mm,'numpredo.com/print/progression/ | Set 01');c.showPage();c.save()
print('Progression pack: 8 source-matched puzzles, 4+4 pages, organizer guide 1 page')
