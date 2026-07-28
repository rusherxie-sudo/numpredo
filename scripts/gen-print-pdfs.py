#!/usr/bin/env python3
"""从已验证题库生成可长期下载的 A4 数独问题集。"""

from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "downloads"
JAPANESE_FONT = "NumpredoJapanese"
JAPANESE_FONT_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
]
INK = HexColor("#17211d")
MUTED = HexColor("#66736d")
ACCENT = HexColor("#1d7f65")
LIGHT = HexColor("#d5ddd9")

LEVELS = [
    ("beginner", "初級", "はじめての方・子ども・毎日の脳トレに"),
    ("intermediate", "中級", "ほどよい歯ごたえの日課向け"),
    ("advanced", "上級", "候補メモを使う本格問題"),
    ("hard", "難問", "複数のテクニックを組み合わせる手強い問題"),
    ("extreme", "超難問", "最後まで論理で解ける最高難度"),
]


def load_puzzles(slug: str) -> list[dict[str, str]]:
    path = ROOT / "src" / "data" / "puzzles" / f"{slug}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    puzzles = data["puzzles"][:12]
    if len(puzzles) != 12:
        raise ValueError(f"{slug}: 12問を取得できません")
    for index, item in enumerate(puzzles, start=1):
        puzzle = item["puzzle"]
        solution = item["solution"]
        if len(puzzle) != 81 or len(solution) != 81:
            raise ValueError(f"{slug} No.{index}: 盤面文字列が81桁ではありません")
        for pos, value in enumerate(puzzle):
            if value not in {".", "0"} and value != solution[pos]:
                raise ValueError(f"{slug} No.{index}: 問題と解答が一致しません")
    return puzzles


def draw_board(
    pdf: Canvas,
    x: float,
    y: float,
    size: float,
    values: str,
    givens: str | None = None,
) -> None:
    cell = size / 9
    pdf.setFillColor(HexColor("#ffffff"))
    pdf.rect(x, y, size, size, fill=1, stroke=0)

    for i in range(10):
        width = 1.35 if i % 3 == 0 else 0.35
        color = INK if i % 3 == 0 else LIGHT
        pdf.setStrokeColor(color)
        pdf.setLineWidth(width)
        offset = i * cell
        pdf.line(x + offset, y, x + offset, y + size)
        pdf.line(x, y + offset, x + size, y + offset)

    font_size = cell * 0.47
    for index, value in enumerate(values):
        if value in {".", "0"}:
            continue
        row, col = divmod(index, 9)
        is_given = givens is None or givens[index] not in {".", "0"}
        pdf.setFillColor(INK if is_given else ACCENT)
        pdf.setFont("Helvetica-Bold" if is_given else "Helvetica", font_size)
        center_x = x + (col + 0.5) * cell
        center_y = y + size - (row + 0.68) * cell
        pdf.drawCentredString(center_x, center_y, value)


def draw_header(pdf: Canvas, level_ja: str, subtitle: str, answer: bool = False) -> None:
    width, height = A4
    pdf.setFillColor(INK)
    pdf.setFont(JAPANESE_FONT, 16)
    label = f"{level_ja} ナンプレ12問 - {'解答' if answer else '無料プリント'}"
    pdf.drawString(18 * mm, height - 17 * mm, label)
    pdf.setFillColor(MUTED)
    pdf.setFont(JAPANESE_FONT, 8.5)
    pdf.drawRightString(width - 18 * mm, height - 16.5 * mm, subtitle)
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(1.2)
    pdf.line(18 * mm, height - 21 * mm, width - 18 * mm, height - 21 * mm)


def draw_footer(pdf: Canvas, page: int, total: int) -> None:
    width, _ = A4
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(18 * mm, 10 * mm, "numpredo.com/print/")
    pdf.drawRightString(width - 18 * mm, 10 * mm, f"{page} / {total}")


def build_pdf(slug: str, level_ja: str, subtitle: str) -> Path:
    puzzles = load_puzzles(slug)
    output = OUTPUT_DIR / f"numpredo-{slug}-12.pdf"
    total_pages = 8
    pdf = Canvas(str(output), pagesize=A4, pageCompression=1)
    pdf.setTitle(f"{level_ja}の数独・ナンプレ無料プリント12問（答え付き）")
    pdf.setAuthor("numpredo")
    pdf.setSubject("唯一解・論理だけで解ける数独問題集")

    problem_size = 90 * mm
    problem_x = (A4[0] - problem_size) / 2
    problem_y = [161 * mm, 53 * mm]
    for page_index in range(6):
        draw_header(pdf, level_ja, subtitle)
        for slot in range(2):
            number = page_index * 2 + slot
            item = puzzles[number]
            label_y = problem_y[slot] + problem_size + 3.5 * mm
            pdf.setFillColor(MUTED)
            pdf.setFont(JAPANESE_FONT, 9)
            pdf.drawString(problem_x, label_y, f"第 {number + 1} 問")
            draw_board(pdf, problem_x, problem_y[slot], problem_size, item["puzzle"])
        draw_footer(pdf, page_index + 1, total_pages)
        pdf.showPage()

    answer_size = 50 * mm
    answer_x = [20 * mm, 110 * mm]
    answer_y = [202 * mm, 137 * mm, 72 * mm]
    for answer_page in range(2):
        draw_header(pdf, level_ja, "緑の数字が空きマスの答えです", answer=True)
        for slot in range(6):
            number = answer_page * 6 + slot
            item = puzzles[number]
            row, col = divmod(slot, 2)
            x, y = answer_x[col], answer_y[row]
            pdf.setFillColor(MUTED)
            pdf.setFont(JAPANESE_FONT, 7.5)
            pdf.drawString(x, y + answer_size + 2.5 * mm, f"第 {number + 1} 問")
            draw_board(pdf, x, y, answer_size, item["solution"], item["puzzle"])
        draw_footer(pdf, 7 + answer_page, total_pages)
        pdf.showPage()

    pdf.save()
    return output


def register_japanese_font() -> None:
    font_path = next((path for path in JAPANESE_FONT_CANDIDATES if path.exists()), None)
    if font_path is None:
        candidates = "\n".join(f"- {path}" for path in JAPANESE_FONT_CANDIDATES)
        raise FileNotFoundError(f"PDF生成に必要な日本語フォントが見つかりません:\n{candidates}")
    pdfmetrics.registerFont(TTFont(JAPANESE_FONT, str(font_path)))


def main() -> None:
    register_japanese_font()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    expected = set()
    for slug, level_ja, subtitle in LEVELS:
        path = build_pdf(slug, level_ja, subtitle)
        expected.add(path.name)
        print(f"生成: {path.relative_to(ROOT)}")

    for stale in OUTPUT_DIR.glob("numpredo-*-12.pdf"):
        if stale.name not in expected:
            stale.unlink()


if __name__ == "__main__":
    main()
