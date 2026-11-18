#!/usr/bin/env python3
"""从网页同源的43步逻辑数据生成题目与完整讲解PDF；不改题库。"""
from __future__ import annotations

import hashlib
import json
import runpy
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/downloads/beginner-tutorial"
PRINT = runpy.run_path(str(ROOT / "scripts/gen-print-pdfs.py"))
FONT = PRINT["JAPANESE_FONT"]
GUIDE_URL = "https://numpredo.com/guide/how-to-solve/"
INK, ACCENT, MUTED = (HexColor(v) for v in ("#17211d", "#1d7f65", "#52645c"))
STYLE = ParagraphStyle("proof", fontName=FONT, fontSize=9.5, leading=14, textColor=INK, wordWrap="CJK")


def paragraph(pdf, text, x, top, width, max_height):
    block = Paragraph(escape(text).replace("\n", "<br/>"), STYLE)
    _, height = block.wrap(width, max_height)
    if height > max_height:
        raise ValueError(f"PDF段落超过版面: {height:.1f} > {max_height:.1f}")
    block.drawOn(pdf, x, top - height)
    return height


def header(pdf, subtitle):
    pdf.setFillColor(INK)
    pdf.setFont(FONT, 16)
    pdf.drawString(18 * mm, 279 * mm, "初級No.1 ナンプレの解き方")
    pdf.setFont(FONT, 10)
    pdf.drawString(18 * mm, 268 * mm, subtitle)
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(1)
    pdf.line(18 * mm, 263 * mm, 192 * mm, 263 * mm)


def footer(pdf, number, total):
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(18 * mm, 10 * mm, GUIDE_URL.removeprefix("https://"))
    pdf.linkURL(GUIDE_URL, (18 * mm, 8 * mm, 155 * mm, 14 * mm), relative=0, thickness=0)
    pdf.drawRightString(192 * mm, 10 * mm, f"{number} / {total}")


def board(pdf, values, x, y, size, puzzle, highlight=None):
    PRINT["draw_board"](pdf, x, y, size, values, puzzle)
    if highlight is not None:
        row, col = divmod(highlight, 9)
        cell = size / 9
        pdf.setStrokeColor(ACCENT)
        pdf.setLineWidth(2)
        pdf.rect(x + col * cell + 1, y + (8 - row) * cell + 1, cell - 2, cell - 2, fill=0, stroke=1)


def new_pdf(name, title):
    pdf = Canvas(str(OUT / name), pagesize=A4, pageCompression=1, invariant=1)
    pdf.setTitle(title)
    pdf.setAuthor("numpredo")
    return pdf


def main():
    lesson = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {beginnerWalkthrough} from './src/data/beginner-walkthrough.ts'; console.log(JSON.stringify(beginnerWalkthrough()));",
    ], cwd=ROOT, text=True))
    PRINT["register_japanese_font"]()
    OUT.mkdir(parents=True, exist_ok=True)
    puzzle, steps = lesson["puzzle"], lesson["steps"]
    pdf = new_pdf("questions.pdf", "初級No.1 ナンプレ問題｜完全図解と同じ1問")
    header(pdf, "問題用紙：空いている43マスを、自分で埋めてみましょう。")
    board(pdf, puzzle, 27.5 * mm, 91 * mm, 155 * mm, puzzle)
    paragraph(pdf, "各行・各列・各3×3ブロックに、1〜9を一度ずつ入れます。行は上から、列は左から数えます。太い枠で囲まれた3×3が一つのブロックです。", 18 * mm, 76 * mm, 174 * mm, 30 * mm)
    paragraph(pdf, "行き詰まったら、同じ初級No.1の全手順の解説PDFを見てください。Web版の全43手と、問題・解説PDFは同じ原題です。", 18 * mm, 49 * mm, 174 * mm, 24 * mm)
    footer(pdf, 1, lesson["questionPages"])
    pdf.showPage()
    pdf.save()

    pdf = new_pdf("answers.pdf", "初級No.1 ナンプレ全43手の解説・答え")
    total = lesson["answerPages"]
    header(pdf, "読み方：一つのマスを確定し、周囲の候補を見直す43手。")
    board(pdf, puzzle, 55 * mm, 150 * mm, 100 * mm, puzzle)
    paragraph(pdf, "太字は最初からある38個の数字です。各手の盤面は数字を入れた後、右側の理由は入れる前を説明しています。緑の枠が今回のマス、緑の数字がここまでに入れた答えです。", 18 * mm, 139 * mm, 174 * mm, 30 * mm)
    paragraph(pdf, "この1問は、候補が一つだけのマス（唯一候補・裸の単数）を43回見つけると解けます。行・列・ブロックにある数字を候補から外し、残る数字を確かめましょう。", 18 * mm, 105 * mm, 174 * mm, 30 * mm)
    paragraph(pdf, "別の見つけ方：" + lesson["hidden"]["reasoning"] + " 下の正式な手順では4手目に5を入れます。このように、数字の置き場所が一つだけと考える方法が唯一位置（隠れた単数）です。", 18 * mm, 71 * mm, 174 * mm, 45 * mm)
    footer(pdf, 1, total)
    pdf.showPage()

    for offset in range(0, len(steps), 2):
        header(pdf, f"手順 {offset + 1}〜{min(offset + 2, len(steps))} ／ 全{len(steps)}手")
        for slot, step in enumerate(steps[offset:offset + 2]):
            top = (254 - slot * 122) * mm
            pdf.setFillColor(INK)
            pdf.setFont(FONT, 12)
            pdf.drawString(18 * mm, top, f'{step["number"]}手目：{step["location"]}に{step["digit"]}を入れる')
            y = top - 92 * mm
            values = "".join(str(v) if v else "." for v in step["after"])
            board(pdf, values, 18 * mm, y, 82 * mm, puzzle, step["cell"])
            proof = "\n".join(step["reasoning"])
            paragraph(pdf, proof, 107 * mm, top - 10 * mm, 85 * mm, 82 * mm)
            pdf.setFont(FONT, 9)
            pdf.setFillColor(MUTED)
            pdf.drawString(18 * mm, y - 6 * mm, f'今回のマスは枠付き。残り{step["remaining"]}マス。')
        footer(pdf, offset // 2 + 2, total)
        pdf.showPage()

    header(pdf, "完成盤面：行・列・3×3ブロックを最後に確認します。")
    board(pdf, lesson["solution"], 27.5 * mm, 91 * mm, 155 * mm, puzzle)
    paragraph(pdf, "すべての行・列・3×3ブロックに1〜9が一度ずつ入りました。最初からあった38個の数字は動かしていません。わからなかった手に戻り、使えない数字の理由を自分の言葉で確かめてください。", 18 * mm, 75 * mm, 174 * mm, 32 * mm)
    paragraph(pdf, "同じ問題を画面で解く：初級ゲームのNo.1。保存した続きが開いた場合は「最初から」で同じ問題を解き直せます。", 18 * mm, 41 * mm, 174 * mm, 23 * mm)
    footer(pdf, total, total)
    pdf.showPage()
    pdf.save()

    files = []
    for name, expected in (("questions.pdf", lesson["questionPages"]), ("answers.pdf", total)):
        path = OUT / name
        reader = PdfReader(path)
        if len(reader.pages) != expected:
            raise ValueError(f"{name}: 页数 {len(reader.pages)} != {expected}")
        for page in reader.pages:
            if abs(float(page.mediabox.width) - A4[0]) > 1 or abs(float(page.mediabox.height) - A4[1]) > 1:
                raise ValueError(f"{name}: 不是A4")
            if not page.extract_text().strip():
                raise ValueError(f"{name}: 空白页")
        data = path.read_bytes()
        files.append({"name": name, "pages": expected, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    # 清单只能锁定经过实际内容核验的PDF；独立命令可直接检查既有文件，不重生成。
    verify_pdf = runpy.run_path(str(ROOT / "scripts/check-beginner-tutorial-pdf.py"))["verify_actual_pdf"]
    verify_pdf(lesson, OUT)
    manifest = {"number": lesson["number"], "puzzle": puzzle, "solution": lesson["solution"], "steps": len(steps), "files": files}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
