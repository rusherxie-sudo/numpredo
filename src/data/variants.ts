// 变体数独内容页数据（驱动 /variants/[slug]）。内容页（规则+攻略+示意），不可玩。
// svg = 手写和风示意图（用页面 CSS 变量，自动明暗适配）。
export interface Variant {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  svg: string;
  svgCaption: string;
  sections: Array<{ h: string; body: string[] }>;
  faq: Array<{ q: string; a: string }>;
}

const G = 'stroke="var(--thick)"';
const L = 'stroke="var(--line)"';

export const VARIANTS: Variant[] = [
  {
    slug: 'killer',
    name: 'キラー数独',
    title: 'キラー数独（キラーナンプレ）のルールと解き方 - numpredo',
    description: 'キラー数独（キラーナンプレ）のルールと解き方を解説。点線で囲まれた「ケージ」の合計から数字を絞り込む、足し算が加わった人気の変種数独。基本ルールとの違いやコツを図解で。',
    h1: 'キラー数独のルールと解き方',
    lead: '点線で囲まれた「ケージ」の合計を手がかりに解く、足し算が加わった人気の変種数独です。',
    svg: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img"><title>キラー数独のケージ例</title>
      <g ${L} stroke-width="0.7" fill="none">
        ${Array.from({ length: 4 }, (_, i) => `<line x1="${20 + i * 40}" y1="20" x2="${20 + i * 40}" y2="140"/>`).join('')}
        ${Array.from({ length: 4 }, (_, i) => `<line x1="20" y1="${20 + i * 40}" x2="140" y2="${20 + i * 40}"/>`).join('')}
      </g>
      <rect x="22" y="22" width="76" height="36" rx="3" fill="none" stroke="var(--shu)" stroke-width="1.3" stroke-dasharray="4 3"/>
      <text x="30" y="34" font-family="var(--sans)" font-size="11" fill="var(--shu)">12</text>
      <text x="60" y="46" font-family="var(--min)" font-size="20" fill="var(--sumi)" text-anchor="middle">7</text>
      <text x="100" y="46" font-family="var(--min)" font-size="20" fill="var(--sumi)" text-anchor="middle">5</text>
      <text x="60" y="86" font-family="var(--min)" font-size="20" fill="var(--ai)" text-anchor="middle">3</text>
      <text x="155" y="86" font-family="var(--sans)" font-size="11" fill="var(--sub)">合計が手がかり</text>
    </svg>`,
    svgCaption: '点線で囲まれたケージの合計（例：12）から、中の数字の組み合わせを絞り込む。',
    sections: [
      { h: 'キラー数独とは', body: ['キラー数独（キラーナンプレ）は、基本の数独に「ケージ（点線で囲まれた領域）」と「その合計」が加わった変種です。各ケージ内の数字を足すと、示された合計になります。'] },
      { h: '基本ルール＋2つの追加ルール', body: ['① 通常の数独どおり、各行・列・3×3ブロックに1〜9を1回ずつ（<a href="/guide/rules/">基本ルール</a>）。', '② 各ケージ内の数字の合計が、左上に書かれた数になる。', '③ <strong>同じケージ内では数字を重複させない</strong>。', '最初は数字が一つも入っていないことが多く、合計だけが手がかりです。'] },
      { h: '解き方のコツ', body: ['<strong>合計から組み合わせを絞る。</strong> 例えば2マスのケージで合計3なら、入る数字は1と2しかありません。こうした「決まった組み合わせ」を覚えると一気に進みます。', '<strong>45の法則。</strong> 行・列・ブロックの数字の合計は必ず45。これを使うと、はみ出したケージの数字を逆算できます。', '通常の数独テクニック（<a href="/guide/how-to-solve/">解き方ガイド</a>）も併用します。'] },
      { h: '基本の数独で練習しよう', body: ['キラー数独も土台は通常の数独です。まずは<a href="/play/intermediate/">中級</a>や<a href="/play/advanced/">上級</a>で基本テクニックに慣れるのがおすすめです。'] },
    ],
    faq: [
      { q: 'キラー数独は数独より難しい？', a: '足し算の要素が加わる分、慣れるまでは難しく感じますが、組み合わせのパターンを覚えると独特の面白さがあります。' },
      { q: '計算が苦手でも解ける？', a: '使うのは簡単な足し算だけ。2〜3マスの小さなケージから絞り込めば、計算が苦手でも楽しめます。' },
    ],
  },
  {
    slug: '6x6',
    name: '6×6数独',
    title: '6×6数独（ミニ数独）のルールと解き方｜初心者・子ども向け - numpredo',
    description: '6×6数独（ミニ数独）のルールと解き方を解説。9×9より小さく、1〜6だけを使う入門向けの数独。子どもや初心者の練習に最適。基本ルールとの違いを図解で。',
    h1: '6×6数独（ミニ数独）のルールと解き方',
    lead: '1〜6だけを使う小さな数独。子どもや初心者が数独に慣れるのに最適です。',
    svg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img"><title>6×6数独の盤面</title>
      <rect x="20" y="20" width="120" height="120" fill="none" ${G} stroke-width="2"/>
      <g ${L} stroke-width="0.7" fill="none">
        ${Array.from({ length: 5 }, (_, i) => `<line x1="${40 + i * 20}" y1="20" x2="${40 + i * 20}" y2="140"/><line x1="20" y1="${40 + i * 20}" x2="140" y2="${40 + i * 20}"/>`).join('')}
      </g>
      <g ${G} stroke-width="1.6" fill="none"><line x1="80" y1="20" x2="80" y2="140"/><line x1="20" y1="60" x2="140" y2="60"/><line x1="20" y1="100" x2="140" y2="100"/></g>
      ${[[0, 0, 1], [2, 0, 4], [4, 1, 6], [1, 3, 2], [5, 4, 3], [3, 5, 5]].map(([c, r, n]) => `<text x="${30 + c * 20}" y="${36 + r * 20}" font-family="var(--min)" font-size="14" fill="var(--sumi)" text-anchor="middle">${n}</text>`).join('')}
    </svg>`,
    svgCaption: '6×6の盤面。太線で区切られた2×3のブロックに1〜6を1回ずつ。',
    sections: [
      { h: '6×6数独とは', body: ['6×6数独（ミニ数独）は、通常の9×9を小さくした入門向けの数独です。使う数字は1〜6だけ。盤面が小さいので短時間で解け、数独のルールに慣れるのにぴったりです。'] },
      { h: 'ルール', body: ['① 各行（横6マス）に1〜6を1回ずつ。', '② 各列（縦6マス）に1〜6を1回ずつ。', '③ 太線で区切られた<strong>2×3のブロック</strong>に1〜6を1回ずつ。', '考え方は<a href="/guide/rules/">通常の数独</a>とまったく同じで、規模が小さいだけです。'] },
      { h: '解き方', body: ['基本は通常の数独と同じ。<a href="/guide/beginner/">単数の見つけ方</a>（裸の単数・隠れた単数）だけで解けることがほとんどです。子どもや初心者の最初の一歩におすすめです。'] },
      { h: '慣れたら9×9へ', body: ['6×6で慣れたら、<a href="/play/beginner/">9×9の初級</a>に挑戦してみましょう。基本テクニックはそのまま使えます。'] },
    ],
    faq: [
      { q: '6×6数独は子どもでもできる？', a: 'はい。数字が1〜6と少なく盤面も小さいので、お子さんの数字・論理の練習に向いています。' },
      { q: '9×9との違いは？', a: '使う数字（1〜6）と盤面サイズ、ブロックの形（2×3）が違うだけ。ルールの考え方は同じです。' },
    ],
  },
  {
    slug: 'inequality',
    name: '不等号ナンプレ',
    title: '不等号ナンプレ（比較数独）のルールと解き方 - numpredo',
    description: '不等号ナンプレ（比較数独）のルールと解き方を解説。マスの間の「＜」「＞」の大小関係を手がかりに数字を絞り込む変種数独。基本ルールとの違いとコツを図解で。',
    h1: '不等号ナンプレのルールと解き方',
    lead: 'マスとマスの間の「＜」「＞」の大小関係を手がかりに解く、論理重視の変種数独です。',
    svg: `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" role="img"><title>不等号ナンプレの例</title>
      <g ${G} stroke-width="1.4" fill="none">
        <rect x="20" y="20" width="44" height="44"/><rect x="84" y="20" width="44" height="44"/><rect x="148" y="20" width="44" height="44"/>
      </g>
      <text x="42" y="50" font-family="var(--min)" font-size="22" fill="var(--sumi)" text-anchor="middle">2</text>
      <text x="106" y="50" font-family="var(--min)" font-size="22" fill="var(--ai)" text-anchor="middle">?</text>
      <text x="170" y="50" font-family="var(--min)" font-size="22" fill="var(--sumi)" text-anchor="middle">5</text>
      <text x="74" y="48" font-family="var(--sans)" font-size="18" fill="var(--shu)" text-anchor="middle">&lt;</text>
      <text x="138" y="48" font-family="var(--sans)" font-size="18" fill="var(--shu)" text-anchor="middle">&lt;</text>
    </svg>`,
    svgCaption: '記号は「小さい方」が開く向き。2 ＜ ? ＜ 5 なら、真ん中は3か4に絞られる。',
    sections: [
      { h: '不等号ナンプレとは', body: ['不等号ナンプレ（比較数独・大小数独）は、隣り合うマスの間に「＜」「＞」の不等号が書かれた変種数独です。記号は必ず大小関係を満たさなければなりません（記号の開いた側が大きい数）。'] },
      { h: 'ルール', body: ['① 通常の数独どおり、各行・列・ブロックに1〜9を1回ずつ（<a href="/guide/rules/">基本ルール</a>）。', '② マスの間の<strong>不等号（＜・＞）の大小関係を必ず満たす</strong>。', '数字のヒントが少なく、不等号だけが手がかりのこともあります。'] },
      { h: '解き方のコツ', body: ['<strong>不等号の連鎖に注目。</strong> 「a ＜ b ＜ c」のように記号が続くと、入る数字が大きく絞れます。例えば3つ連続で増えるなら、一番小さいマスは小さい数（1〜3あたり）に限られます。', '<strong>端の最大・最小。</strong> 不等号の連鎖の端は、その範囲の最大値・最小値になりやすいです。', '通常のテクニック（<a href="/guide/how-to-solve/">解き方ガイド</a>）も併用します。'] },
    ],
    faq: [
      { q: '不等号の向きの読み方は？', a: '記号の「開いた側」が大きい数です。「2 ＜ 5」は2より5が大きいという意味。とがった側が小さい数を指します。' },
      { q: '数独より難しい？', a: '数字ヒントが少ない分、論理の比重が高くなります。不等号の連鎖を見つけると一気に解けて爽快です。' },
    ],
  },
  {
    slug: 'diagonal',
    name: '対角線数独（X数独）',
    title: '対角線数独（X数独）のルールと解き方 - numpredo',
    description: '対角線数独（X数独・ダイアゴナル数独）のルールと解き方を解説。通常の数独に加え、2本の対角線にも1〜9を1回ずつ入れる変種。基本との違いとコツを図解で。',
    h1: '対角線数独（X数独）のルールと解き方',
    lead: '通常のルールに加え、2本の対角線にも1〜9を入れる、ひとひねりある変種数独です。',
    svg: `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img"><title>対角線数独</title>
      <rect x="20" y="20" width="120" height="120" fill="none" ${G} stroke-width="2"/>
      <g ${L} stroke-width="0.6" fill="none">
        ${Array.from({ length: 8 }, (_, i) => `<line x1="${20 + (i + 1) * (120 / 9)}" y1="20" x2="${20 + (i + 1) * (120 / 9)}" y2="140"/><line x1="20" y1="${20 + (i + 1) * (120 / 9)}" x2="140" y2="${20 + (i + 1) * (120 / 9)}"/>`).join('')}
      </g>
      <g ${G} stroke-width="1.5" fill="none">${[60, 100].map((p) => `<line x1="${p}" y1="20" x2="${p}" y2="140"/><line x1="20" y1="${p}" x2="140" y2="${p}"/>`).join('')}</g>
      <line x1="20" y1="20" x2="140" y2="140" stroke="var(--shu)" stroke-width="2" opacity="0.55"/>
      <line x1="140" y1="20" x2="20" y2="140" stroke="var(--shu)" stroke-width="2" opacity="0.55"/>
    </svg>`,
    svgCaption: '通常の制約に加え、朱色の2本の対角線にも1〜9を1回ずつ。',
    sections: [
      { h: '対角線数独とは', body: ['対角線数独（X数独・ダイアゴナル数独）は、通常の数独に「2本の対角線」の制約が加わった変種です。左上から右下、右上から左下の対角線にも、それぞれ1〜9を1回ずつ入れます。'] },
      { h: 'ルール', body: ['① 通常の数独どおり、各行・列・ブロックに1〜9を1回ずつ（<a href="/guide/rules/">基本ルール</a>）。', '② <strong>2本の対角線</strong>にも、それぞれ1〜9を1回ずつ。', '制約が一つ増える分、より少ないヒントで解けるように作られています。'] },
      { h: '解き方のコツ', body: ['<strong>対角線を「4本目の単元」として扱う。</strong> 行・列・ブロックに加えて、対角線でも消去法が使えます。対角線上のマスは手がかりが一つ多いので、優先的に攻めましょう。', '基本テクニックは<a href="/guide/how-to-solve/">解き方ガイド</a>と同じです。'] },
    ],
    faq: [
      { q: 'ナンプレの「斜め」とは何ですか？', a: '対角線（斜め）の2本のラインにも1〜9を各1回ずつ入れる、というルールを加えたナンプレです。「斜めナンプレ」「X数独」とも呼ばれ、通常のルールに斜めの制約が増える分、対角線を使った絞り込みができます。' },
      { q: '対角線数独は難しい？', a: '制約が増える分、対角線を使った絞り込みができるので、慣れれば通常の数独と同程度に楽しめます。' },
      { q: 'X数独と同じもの？', a: 'はい。対角線に×印のように線が入ることから「X数独」とも呼ばれます。同じパズルです。' },
    ],
  },
];

export const variantBySlug = (slug: string): Variant | undefined => VARIANTS.find((v) => v.slug === slug);
