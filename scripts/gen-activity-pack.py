#!/usr/bin/env python3
"""Reproducible, separately printable four-session pack using stable pool IDs."""
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('print_pdfs', Path(__file__).with_name('gen-print-pdfs.py'))
pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf)
OUTPUT = pdf.OUTPUT_DIR / 'activity'
SESSIONS = [('A', 'beginner', [61, 62]), ('B', 'beginner', [63, 64]), ('C', 'beginner', [65, 66]), ('D', 'intermediate', [61, 62])]
NAMES = {'beginner': '初級', 'intermediate': '中級'}


def main():
    pdf.register_japanese_font()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries = []
    seen = set()
    for session, level, numbers in SESSIONS:
        pool = pdf.load_puzzles(level, max(numbers))
        for number in numbers:
            item = pool[number-1]
            if item['puzzle'] in seen:
                raise ValueError('Duplicate activity puzzle')
            seen.add(item['puzzle'])
            entries.append({**item, 'session':session, 'level':level, 'number':number, 'id':f'{session}-{number}'})
    for answer in [False, True]:
        name = 'answers' if answer else 'questions'
        canvas = pdf.Canvas(str(OUTPUT / f'numpredo-activity-01-{name}.pdf'), pagesize=pdf.A4, pageCompression=1, invariant=1)
        canvas.setTitle('ナンプレ配布セット01・' + ('職員・家族用解答' if answer else '参加者用問題'))
        canvas.setAuthor('numpredo')
        for page, (session, level, _) in enumerate(SESSIONS):
            canvas.setFillColor(pdf.INK)
            canvas.setFont(pdf.JAPANESE_FONT, 16)
            canvas.drawString(18*pdf.mm, 280*pdf.mm, f'配布セット01 — {session} / {NAMES[level]}' + (' 解答' if answer else ''))
            canvas.setFont(pdf.JAPANESE_FONT, 10)
            canvas.drawString(18*pdf.mm, 270*pdf.mm, '答え合わせ用。参加者用の問題とは分けて保管してください。' if answer else '日付：________________    お名前：________________')
            for slot, item in enumerate(entries[page*2:page*2+2]):
                y = [158, 43][slot]*pdf.mm
                size = 95*pdf.mm
                x = (pdf.A4[0]-size)/2
                canvas.setFont(pdf.JAPANESE_FONT, 10)
                canvas.setFillColor(pdf.INK)
                canvas.drawString(x, y+size+4*pdf.mm, f"{item['id']} ／ {NAMES[level]} No.{item['number']}")
                pdf.draw_board(canvas,x,y,size,item['solution'] if answer else item['puzzle'],item['puzzle'] if answer else None)
            canvas.setFont(pdf.JAPANESE_FONT, 8)
            canvas.drawString(18*pdf.mm, 25*pdf.mm, 'Dは中級の任意チャレンジ。難しいときはA〜Cを自分のペースで楽しみましょう。' if session=='D' else '1問ずつ、自分のペースで。途中で休んでもかまいません。')
            canvas.setFont('Helvetica',8)
            canvas.drawString(18*pdf.mm,15*pdf.mm,'numpredo.com/print/senior/#activity-pack')
            canvas.drawRightString(192*pdf.mm,15*pdf.mm,f'{page+1} / 4')
            canvas.showPage()
        canvas.save()
    (OUTPUT / 'manifest.json').write_text(json.dumps({'version':'01','sessions':SESSIONS,'puzzles':entries},ensure_ascii=False,indent=2)+'\n')
    print('Activity pack 01: 8 distinct puzzles, 4 question + 4 answer pages')

if __name__ == '__main__':
    main()
