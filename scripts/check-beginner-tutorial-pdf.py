#!/usr/bin/env python3
"""只读校验实际PDF的数字坐标、完整理由、标题、高亮与字体；不重生成文件。"""
from __future__ import annotations
import argparse
import json
import re
import subprocess
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[1]

def verify_actual_pdf(lesson, directory):
    mm = 72 / 25.4
    original = lesson["initial"]
    records, rectangles = {}, {}
    for name, expected_pages in (("questions", 1), ("answers", 24)):
        reader = PdfReader(directory / (name + ".pdf"))
        assert len(reader.pages) == expected_pages, (name, "page count")
        for page_index, page in enumerate(reader.pages):
            assert abs(float(page.mediabox.width) - 210 * mm) < .01
            assert abs(float(page.mediabox.height) - 297 * mm) < .01
            rec = []
            def visitor(text, cm, tm, font, size):
                if text.strip():
                    rec.append({"text": text.strip(), "x": tm[4]*cm[0]+tm[5]*cm[2]+cm[4], "y": tm[4]*cm[1]+tm[5]*cm[3]+cm[5], "size": float(size), "font": str(font.get("/BaseFont", "")) if font else ""})
            assert page.extract_text(visitor_text=visitor).strip(), (name, page_index, "blank page")
            records[name, page_index] = rec
            rectangles[name, page_index] = [[float(v) for v in args] for args, op in ContentStream(page.get_contents(), reader).operations if op == b"re"]
            assert all(0 <= t["x"] < 210*mm and 0 <= t["y"] < 297*mm for t in rec), (name, page_index, "text outside page")
            japanese = [f.get_object() for f in page["/Resources"]["/Font"].get_object().values() if "ArialUnicode" in str(f.get_object().get("/BaseFont", ""))]
            assert japanese and all("/FontFile2" in f["/FontDescriptor"].get_object() for f in japanese), (name, page_index, "Japanese font not embedded")

    def board_values(name, page_index, x, y, size):
        cell, actual = size / 9, [0] * 81
        for t in records[name, page_index]:
            if not re.fullmatch("[1-9]", t["text"]) or not (x < t["x"] < x+size and y < t["y"] < y+size):
                continue
            col = int((t["x"] - x) / cell)
            row = int((y + size - t["y"]) / cell)
            i = row * 9 + col
            assert actual[i] == 0, (name, page_index, "duplicate cell", i)
            actual[i] = int(t["text"])
            assert t["font"] == ("/Helvetica-Bold" if original[i] else "/Helvetica"), (name, page_index, "given font", i)
        return actual

    assert board_values("questions", 0, 27.5*mm, 91*mm, 155*mm) == original, "actual question board"
    assert board_values("answers", 0, 55*mm, 150*mm, 100*mm) == original, "actual answer cover board"
    assert board_values("answers", 23, 27.5*mm, 91*mm, 155*mm) == [int(v) for v in lesson["solution"]], "actual completed board"
    for step in lesson["steps"]:
        number = step["number"]
        page_index, slot = (number - 1) // 2 + 1, (number - 1) % 2
        top = (254 - slot * 122) * mm
        x, y, size = 18*mm, top-92*mm, 82*mm
        assert board_values("answers", page_index, x, y, size) == step["after"], (number, "actual PDF board")
        rec = records["answers", page_index]
        title = str(number) + "手目：" + step["location"] + "に" + str(step["digit"]) + "を入れる"
        assert [t["text"] for t in rec if abs(t["x"]-x) < .01 and abs(t["y"]-top) < .01] == [title], (number, "actual heading")
        proof = "".join(t["text"] for t in rec if t["x"] > 300 and y < t["y"] < top-9*mm and t["size"] == 9.5)
        assert re.sub(r"\s+", "", proof) == re.sub(r"\s+", "", "".join(step["reasoning"])), (number, "actual full proof")
        assert any(t["text"] == "今回のマスは枠付き。残り" + str(step["remaining"]) + "マス。" for t in rec), (number, "remaining")
        cell = size / 9
        row, col = divmod(step["cell"], 9)
        expected = [x+col*cell+1, y+(8-row)*cell+1, cell-2, cell-2]
        matches = [r for r in rectangles["answers", page_index] if all(abs(a-b) < .001 for a,b in zip(r, expected))]
        assert len(matches) == 1, (number, "actual highlight")
    return {"steps":len(lesson["steps"]),"stepDigits":sum(sum(bool(v) for v in s["after"]) for s in lesson["steps"]),"proofSentences":sum(len(s["reasoning"]) for s in lesson["steps"]),"pdfPages":25}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory",type=Path,default=ROOT/"public/downloads/beginner-tutorial")
    parser.add_argument("--built",action="store_true",help="同时读取dist副本并核对与public逐字节一致")
    args=parser.parse_args()
    lesson=json.loads(subprocess.check_output(["node","--input-type=module","-e","import {beginnerWalkthrough} from './src/data/beginner-walkthrough.ts'; console.log(JSON.stringify(beginnerWalkthrough()));"],cwd=ROOT,text=True))
    result={"public":verify_actual_pdf(lesson,args.directory)}
    if args.built:
        built=ROOT/"dist/downloads/beginner-tutorial"
        result["dist"]=verify_actual_pdf(lesson,built)
        for name in ("questions.pdf","answers.pdf"):
            assert (args.directory/name).read_bytes()==(built/name).read_bytes(), (name,"public/dist mismatch")
    print(json.dumps(result,ensure_ascii=False))

if __name__=="__main__":
    main()
