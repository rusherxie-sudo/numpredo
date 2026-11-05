"""Verify PDF deliverables independently of the page template."""
import json,re,hashlib
from pathlib import Path
import pymupdf
from PIL import Image
root=Path(__file__).resolve().parents[1];base=root/'public/downloads/collections';packs=json.loads((base/'manifest.json').read_text())['packs']
records=[]
for pack in packs:
 for kind in ['questions','answers']:
  path=base/f"{pack['slug']}-{kind}.pdf";doc=pymupdf.open(path)
  perpage=1 if pack['kind']=='notes' else 2
  assert len(doc)==(len(pack['items'])+perpage-1)//perpage
  text='\n'.join(p.get_text() for p in doc)
  found=re.findall(r'\b(?:mini4|killer|diagonal|beginner|intermediate|advanced|hard|extreme)-\d+\b',text)
  assert found==[p['id'] for p in pack['items']],(pack['slug'],kind,found)
  for page in doc:
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   for block in page.get_text('blocks'):
    x0,y0,x1,y1=block[:4];assert x0>=0 and y0>=0 and x1<=page.rect.width+1 and y1<=page.rect.height+1,(path,block)
  preview=root/f"public/images/collections/{pack['slug']}-{kind}.png"
  pix=doc[0].get_pixmap(matrix=pymupdf.Matrix(1.25,1.25),alpha=False)
  expected=Image.frombytes('RGB',[pix.width,pix.height],pix.samples).resize((707,1000))
  actual=Image.open(preview);assert actual.size==(707,1000);assert actual.tobytes()==expected.tobytes()
  records.append({'file':path.name,'pages':len(doc),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'previewSha256':hashlib.sha256(preview.read_bytes()).hexdigest()})
print(f'✓ {len(records)} A4 PDFs: page counts, every source ID, text bounds and exact first-page previews verified')

(root/'src/data/expansion/pdf-checks.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
