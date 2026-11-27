"""Generate the English A4 worksheets from the same manifest as online play."""
import json
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / 'public/downloads'
MANIFEST = json.loads((DOWNLOADS / 'variants/manifest.json').read_text())
PACK = next(pack for pack in MANIFEST['packs'] if pack['slug'] == '16x16')
OUTPUT = DOWNLOADS / 'en'


def draw_board(canvas, item, values):
    width = 172 * mm
    left, bottom = (A4[0] - width) / 2, 60 * mm
    cell = width / 16
    for index in range(17):
        canvas.setLineWidth(1.4 if index % 4 == 0 else .35)
        canvas.line(left + index * cell, bottom, left + index * cell, bottom + width)
        canvas.line(left, bottom + index * cell, left + width, bottom + index * cell)
    for index, symbol in enumerate(values):
        if symbol in '.0':
            continue
        font = 'Helvetica-Bold' if item['puzzle'][index] not in '.0' else 'Helvetica'
        canvas.setFont(font, 13)
        canvas.drawCentredString(left + (index % 16 + .5) * cell, bottom + (16 - index // 16 - .64) * cell, symbol)


def generate(kind):
    label = 'Puzzles' if kind == 'questions' else 'Answer Key'
    canvas = Canvas(str(OUTPUT / f'16x16-sudoku-{kind}.pdf'), pagesize=A4, pageCompression=1, invariant=1)
    canvas.setTitle(f'16x16 Sudoku {label} | numpredo')
    canvas.setAuthor('numpredo')
    for number, item in enumerate(PACK['puzzles'], start=1):
        canvas.setFont('Helvetica-Bold', 20)
        canvas.drawString(19 * mm, 275 * mm, f'16x16 Sudoku {label}')
        canvas.setFont('Helvetica', 11)
        canvas.drawString(19 * mm, 260 * mm, f"Puzzle {number}  |  {item['id']}")
        canvas.drawString(19 * mm, 250 * mm, 'Use 1-9 and A-G once in each row, column and 4x4 box.')
        draw_board(canvas, item, item['puzzle' if kind == 'questions' else 'solution'])
        url = f'https://numpredo.com/en/16x16-sudoku/?n={number}#variant-game'
        canvas.setFont('Helvetica', 9)
        canvas.drawString(19 * mm, 43 * mm, f'Play Puzzle {number} online: {url}')
        canvas.linkURL(url, (19 * mm, 40 * mm, 191 * mm, 47 * mm))
        canvas.drawString(19 * mm, 26 * mm, 'Print on A4 at actual size or select Fit on US Letter.')
        canvas.drawRightString(191 * mm, 26 * mm, f"{number} / {len(PACK['puzzles'])}")
        canvas.showPage()
    canvas.save()


if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for document in ('questions', 'answers'):
        generate(document)
