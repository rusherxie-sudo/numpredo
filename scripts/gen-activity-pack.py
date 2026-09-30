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
    seen = set()
    for version, sessions in [('01',SESSIONS),('02',[('E','beginner',[67,68]),('F','beginner',[69,70]),('G','beginner',[71,72]),('H','intermediate',[63,64])])]:
        make_pack(version,sessions,seen)

def make_pack(version,sessions,seen):
    entries = []
    for session, level, numbers in sessions:
        pool = pdf.load_puzzles(level, max(numbers))
        for number in numbers:
            item = pool[number-1]
            if item['puzzle'] in seen:
                raise ValueError('Duplicate activity puzzle')
            seen.add(item['puzzle'])
            entries.append({**item, 'session':session, 'level':level, 'number':number, 'id':f'{session}-{number}'})
    for answer in [False, True]:
        name = 'answers' if answer else 'questions'
        canvas = pdf.Canvas(str(OUTPUT / f'numpredo-activity-{version}-{name}.pdf'), pagesize=pdf.A4, pageCompression=1, invariant=1)
        canvas.setTitle(f'ナンプレ配布セット{version}・' + ('職員・家族用解答' if answer else '参加者用問題'))
        canvas.setAuthor('numpredo')
        for page, (session, level, _) in enumerate(sessions):
            canvas.setFillColor(pdf.INK)
            canvas.setFont(pdf.JAPANESE_FONT, 16)
            canvas.drawString(18*pdf.mm, 280*pdf.mm, f'配布セット{version} — {session} / {NAMES[level]}' + (' 解答' if answer else ''))
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
            canvas.drawString(18*pdf.mm, 25*pdf.mm, ('Dは中級の任意チャレンジ。難しいときはA〜Cを自分のペースで楽しみましょう。' if version=='01' else 'Hは中級の任意チャレンジ。難しいときはE〜Gを自分のペースで楽しみましょう。') if level=='intermediate' else '1問ずつ、自分のペースで。途中で休んでもかまいません。')
            canvas.setFont('Helvetica',8)
            canvas.drawString(18*pdf.mm,15*pdf.mm,'numpredo.com/print/senior/#activity-pack'+('' if version=='01' else '-02'))
            canvas.drawRightString(192*pdf.mm,15*pdf.mm,f'{page+1} / 4')
            canvas.showPage()
        canvas.save()
    (OUTPUT / ('manifest.json' if version=='01' else 'manifest-02.json')).write_text(json.dumps({'version':version,'sessions':sessions,'puzzles':entries},ensure_ascii=False,indent=2)+'\n')
    if version=='02':
        record=pdf.Canvas(str(OUTPUT/'numpredo-activity-02-guide.pdf'),pagesize=pdf.A4,pageCompression=1,invariant=1)
        record.setTitle('配布セット02・使い方と記録');record.setAuthor('numpredo');record.setFillColor(pdf.INK)
        lines=[('配布セット02 — 使い方と記録',16),('セット01のA〜Dに続けて、E〜Hの四回を配布できます。',11),('問題と答えは各4ページ。答えは参加者用と分けて保管します。',11),('E〜Gは初級、Hは中級の任意チャレンジです。',11),('速さを競わず、途中で休憩しても構いません。',11),('A4・縦・倍率100％で一枚試し刷りして数字を確認します。',11)]
        y=280
        for text,size in lines:record.setFont(pdf.JAPANESE_FONT,size);record.drawString(18*pdf.mm,y*pdf.mm,text);y-=14
        for session,level,numbers in sessions:
            record.setFont(pdf.JAPANESE_FONT,12);record.drawString(18*pdf.mm,y*pdf.mm,f'{session} / {NAMES[level]} No.{numbers[0]}・{numbers[1]}');y-=13
            record.setFont(pdf.JAPANESE_FONT,10);record.drawString(18*pdf.mm,y*pdf.mm,'配布日：____________    メモ：________________________');y-=23
        record.setFont(pdf.JAPANESE_FONT,9);record.drawString(18*pdf.mm,42*pdf.mm,'セット01と問題は重複しません。再ダウンロードすると同じ問題です。')
        record.drawString(18*pdf.mm,30*pdf.mm,'学校・介護施設等の非営利・無料配布に使えます。販売やPDF再掲載はできません。')
        record.setFont('Helvetica',8);record.drawString(18*pdf.mm,15*pdf.mm,'numpredo.com/print/senior/#activity-pack-02');record.showPage();record.save()
    print(f'Activity pack {version}: 8 distinct puzzles, 4 question + 4 answer pages')

if __name__ == '__main__':
    main()
