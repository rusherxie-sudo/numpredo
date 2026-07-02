// 数独ソルバー（写真・画像から読み取り → 可視盤面で確認・修正 → 自動求解）。
// 求解は既存エンジンを完全再利用（純客户端・大模型不要）。識別は Tesseract.js を
// 必要時のみ CDN から動的 import。識別が不完全でも盤面で手修正できるのが肝。
import { solveOne, countSolutions, logicalSolve, traceKeySteps, renderStepFigures, levelOf, LEVEL_META, TECH_INFO } from '../engine/index.ts';
import { track } from './track.ts';

const app = document.getElementById('sv-app');
if (app) setup(app);

function setup(app: HTMLElement): void {
  const msgEl = document.getElementById('sv-msg') as HTMLElement | null;
  const stepsEl = document.getElementById('sv-steps') as HTMLElement | null;
  const photoInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-photo]'));

  const SAMPLE = '..42.....3......6.5..3...71..5.72.43..39.65..21.53.6..15...3..4.8......5.....17..';
  let grid: number[] = new Array(81).fill(0); // ユーザー入力（0=空）
  let sel = -1;
  let solved: number[] | null = null; // 解答盤（表示中は同じ盤面に直接反映）
  let givenMask: boolean[] = []; // 解答時に「どのマスが元の入力か」を記録

  // ---- DOM 構築：盤面 + キーボード（role=grid > row > gridcell 合规层级，行容器 display:contents）----
  app.innerHTML = '';
  const board = el('div', 'sv-board');
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', '数独の盤面（9×9）入力');
  const cells: HTMLButtonElement[] = [];
  for (let r = 0; r < 9; r++) {
    const rowEl = el('div', 'sv-rowg');
    rowEl.setAttribute('role', 'row');
    for (let cc = 0; cc < 9; cc++) {
      const i = r * 9 + cc;
      const c = el('button', 'sv-cell') as HTMLButtonElement;
      c.type = 'button';
      c.setAttribute('role', 'gridcell');
      if (cc === 2 || cc === 5) c.classList.add('sv-br');
      if (r === 2 || r === 5) c.classList.add('sv-bb');
      c.addEventListener('click', () => {
        if (solved) { solved = null; clearSteps(); } // 解答表示中なら入力モードに戻す
        sel = i;
        render();
      });
      cells.push(c);
      rowEl.append(c);
    }
    board.append(rowEl);
  }

  const pad = el('div', 'sv-pad');
  for (let n = 1; n <= 9; n++) {
    const k = el('button', 'sv-key');
    k.textContent = String(n);
    k.addEventListener('click', () => input(n));
    pad.append(k);
  }
  const del = el('button', 'sv-key sv-del');
  del.textContent = '消す';
  del.addEventListener('click', () => input(0));
  pad.append(del);

  const ctrl = el('div', 'sv-ctrl');
  const btnSolve = el('button', 'sv-go');
  btnSolve.textContent = '解く';
  btnSolve.addEventListener('click', solve);
  const btnSample = el('button', 'sv-sub');
  btnSample.textContent = 'サンプル';
  btnSample.addEventListener('click', () => {
    grid = strToGrid(SAMPLE);
    sel = -1;
    clearOut();
    setMsg('サンプルを入力しました。「解く」を押してください。', '');
    render();
  });
  const btnClear = el('button', 'sv-sub');
  btnClear.textContent = '全部消す';
  btnClear.addEventListener('click', () => {
    grid = new Array(81).fill(0);
    sel = -1;
    clearOut();
    setMsg('', '');
    render();
  });
  ctrl.append(btnSolve, btnSample, btnClear);

  const layout = el('div', 'sv-layout');
  const left = el('div', 'sv-left');
  left.append(board);
  const right = el('div', 'sv-right');
  right.append(pad, ctrl);
  layout.append(left, right);
  app.append(layout);

  // 物理キーボード（矢印は preventDefault：ページスクロールさせない。焦点も選択セルに追従）
  document.addEventListener('keydown', (e) => {
    if (sel < 0) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if (e.key >= '1' && e.key <= '9') {
      input(Number(e.key));
      e.preventDefault();
      return;
    }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
      input(0);
      e.preventDefault();
      return;
    }
    const mv: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 9, ArrowUp: -9 };
    if (e.key in mv) {
      e.preventDefault();
      sel = Math.max(0, Math.min(80, sel + mv[e.key]));
      render();
      cells[sel].focus();
    }
  });

  // 81 文字（数字と . / 0）の貼り付けで盤面一括入力（愛好者向け：文字列形式の問題を直接ペースト）
  document.addEventListener('paste', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    const cleaned = (e.clipboardData?.getData('text') ?? '').replace(/[^0-9.]/g, '');
    if (cleaned.length < 81) return;
    e.preventDefault();
    grid = strToGrid(cleaned);
    sel = -1;
    clearOut();
    setMsg('貼り付けから盤面を読み込みました。「解く」を押してください。', 'ok');
    render();
  });

  // 画像入力
  for (const inp of photoInputs) {
    inp.addEventListener('change', () => {
      const f = inp.files?.[0];
      if (f) void onImage(f);
      inp.value = '';
    });
  }

  function input(n: number): void {
    if (sel < 0) return;
    solved = null; // 編集したら解答表示を解除
    clearSteps();
    grid[sel] = n;
    if (n !== 0 && sel < 80) sel++; // 数字入力で次のマスへ自動前進（25個前後の手入力が半分の操作で済む）
    render();
  }

  function render(): void {
    const conf = solved ? null : conflicts(grid);
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      c.className = 'sv-cell' + ((i % 9 === 2 || i % 9 === 5) ? ' sv-br' : '') + (((i / 9) | 0) === 2 || ((i / 9) | 0) === 5 ? ' sv-bb' : '');
      if (solved) {
        // 解答表示：元の入力＝黒（given）、解いて埋めたマス＝緑（solved）
        c.textContent = String(solved[i]);
        c.classList.add(givenMask[i] ? 'sv-given' : 'sv-solved');
      } else {
        c.textContent = grid[i] === 0 ? '' : String(grid[i]);
        if (grid[i] !== 0) c.classList.add('sv-given');
        if (conf && conf.has(i)) c.classList.add('sv-err');
        if (i === sel) c.classList.add('sv-sel');
      }
      // スクリーンリーダー向け：位置＋内容＋状態
      const pos = `${((i / 9) | 0) + 1}行${(i % 9) + 1}列`;
      if (solved) {
        c.setAttribute('aria-label', `${pos} ${solved[i]}${givenMask[i] ? '（入力）' : '（解答）'}`);
        c.setAttribute('aria-selected', 'false');
        c.removeAttribute('aria-invalid');
      } else {
        const dup = !!(conf && conf.has(i));
        c.setAttribute('aria-label', grid[i] === 0 ? `${pos} 空き` : `${pos} ${grid[i]}${dup ? '（重複）' : ''}`);
        c.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        if (dup) c.setAttribute('aria-invalid', 'true');
        else c.removeAttribute('aria-invalid');
      }
      // roving tabindex：Tab は選択セル（未選択時は左上）だけに止まる
      c.tabIndex = i === sel || (sel < 0 && i === 0) ? 0 : -1;
    }
  }

  function solve(): void {
    solved = null;
    if (grid.every((v) => v === 0)) {
      setMsg('数字を入力するか、写真を読み込んでください。', 'warn');
      render();
      return;
    }
    if (conflicts(grid).size > 0) {
      setMsg('同じ行・列・3×3に数字の重複があります。赤いマスを直してください。', 'err');
      render();
      return;
    }
    const n = countSolutions(grid, 2);
    if (n === 0) {
      setMsg('この問題には解がありません（入力を確認してください）。', 'err');
      render();
      return;
    }
    const sol = solveOne(grid);
    if (!sol) {
      setMsg('解けませんでした。', 'err');
      render();
      return;
    }
    // 解答を同じ盤面に直接反映（元の入力＝黒、解いたマス＝緑）
    givenMask = grid.map((v) => v !== 0);
    solved = sol;
    setMsg(n > 1 ? '※ 解が複数あります。一例を表示しています（緑が答え）。' : '解けました！緑の数字が答えです。盤面をタップすると再入力できます。', n > 1 ? 'warn' : 'ok');
    render();
    renderSteps(grid.slice()); // 「解き方の手順」を図解表示（grid は元の問題＝題面）
    track('solver_solve', { result: n > 1 ? 'multiple' : 'unique' });
  }

  async function onImage(file: File): Promise<void> {
    clearOut();
    photoInputs.forEach((i) => (i.disabled = true));
    setMsg('写真を読み取っています…（初回はエンジンの読み込みに時間がかかります）', 'warn');
    try {
      const str = await recognizeImage(file, (n) => setMsg(`写真を読み取り中… ${Math.round((n / 81) * 100)}%`, 'warn'));
      grid = strToGrid(str);
      sel = -1;
      render();
      const filled = grid.filter((v) => v !== 0).length;
      setMsg(`写真から ${filled} マスを読み取りました。間違いを盤面で直してから「解く」を押してください。`, 'ok');
      track('solver_ocr', { cells: filled });
    } catch (e) {
      setMsg('画像の読み取りに失敗しました。明るく正面から撮り直すか、盤面に手入力してください。', 'err');
    } finally {
      photoInputs.forEach((i) => (i.disabled = false));
    }
  }

  function clearOut(): void {
    solved = null;
    clearSteps();
  }
  function clearSteps(): void {
    if (!stepsEl) return;
    stepsEl.innerHTML = '';
    stepsEl.hidden = true;
  }
  // 「解き方の手順」：論理ソルバーで解析し要所を一手ずつ図解。
  // 動的生成のためクローラーは見えないが、実ユーザーの理解・滞在・回遊（技巧ページ内リンク）を高める。
  function renderSteps(puzzle: number[]): void {
    if (!stepsEl) return;
    const given = puzzle.map((v) => v !== 0);
    const res = logicalSolve(puzzle.slice());
    const keySteps = traceKeySteps(puzzle.slice());
    if (!keySteps.length) {
      clearSteps();
      return;
    }
    const figs = renderStepFigures(keySteps, given, 30);
    const level = LEVEL_META[levelOf(res)];
    const hardestJa = res.hardest ? (TECH_INFO[res.hardest]?.ja ?? res.hardest) : '基本の手筋';
    const badge = `<p class="sv-steps-badge">難易度の目安：<strong>${level.ja}</strong>（最難テクニック：${hardestJa}）</p>`;
    const intro = res.solved
      ? '<p class="sv-steps-intro">この問題を論理だけで解く手順を、要所だけ図解します。枠つきのマス・色つきの候補が注目点です。</p>'
      : '<p class="sv-steps-intro">この問題は当サイトの論理ソルバーの手筋（X-Wingまで）では最後まで解けませんでした。<strong>ここまでは論理で解ける手順</strong>を図解します（答え自体は上の盤面に表示済みです）。</p>';
    const steps = figs
      .map((f) => `<figure class="sv-step">${f.svg}<figcaption>${f.label}${f.slug ? ` ・ <a href="/guide/techniques/${f.slug}/">くわしい解き方</a>` : ''}</figcaption><p>${f.text}</p></figure>`)
      .join('');
    // 解答後の次の一歩（用完即走の受け皿：練習・学習への回遊導線）
    const next =
      `<p class="sv-next">答え合わせができたら：<a href="/play/${levelOf(res)}/">同じ難易度（${level.ja}）を自分で解いてみる</a>` +
      ` ・ <a href="/guide/how-to-solve/">解き方を基礎から学ぶ</a> ・ <a href="/print/">問題集を印刷する</a></p>`;
    stepsEl.innerHTML = `<h2>解き方の手順（自動）</h2>${badge}${intro}<div class="sv-steps-grid">${steps}</div>${next}`;
    stepsEl.hidden = false;
    track('solver_steps_view', { level: level.ja, solved: res.solved });
  }
  function setMsg(text: string, type: string): void {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'sv-msg' + (type ? ' ' + type : '');
  }

  // 初期表示：空盤面から（サンプルを預填すると、自分の問題を打ち込む際に混ざる罠になる。
  // 動作を試したい人は「サンプル」ボタンで読み込める）
  render();
  setMsg('写真を読み込むか、盤面に直接入力して「解く」を押してください。', '');
}

// ---- ユーティリティ ----
function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
function strToGrid(s: string): number[] {
  const cleaned = s.replace(/[^0-9.]/g, '').padEnd(81, '.').slice(0, 81);
  return [...cleaned].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
}
function conflicts(g: number[]): Set<number> {
  const bad = new Set<number>();
  const mark = (idxs: number[]) => {
    const seen: Record<number, number> = {};
    for (const i of idxs) {
      const v = g[i];
      if (v === 0) continue;
      if (seen[v] != null) {
        bad.add(i);
        bad.add(seen[v]);
      } else seen[v] = i;
    }
  };
  for (let r = 0; r < 9; r++) mark(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) mark(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const u: number[] = [];
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) u.push((br * 3 + dr) * 9 + (bc * 3 + dc));
      mark(u);
    }
  return bad;
}

// ---- 画像 → 81 文字（OCR）----
// 規整な盤面画像（スクショ・正面撮影）を前提：画像全体を盤面とみなして 9×9 に等分し、
// 各マス中央をトリミング → 空白判定 → 非空マスのみ Tesseract で 1 文字認識。
async function recognizeImage(file: File, onProgress?: (done: number) => void): Promise<string> {
  const img = await fileToImage(file);
  const S = 450;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no ctx');
  // 正方形にクロップして描画
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);

  // 暗色スクショ（黒背景・白文字＝ダークモードのアプリ画面など）対策：
  // 平均輝度が低ければ全体を反転してから認識（isBlank と Tesseract は「明るい紙面」前提）
  const full = ctx.getImageData(0, 0, S, S);
  const fd = full.data;
  let lumSum = 0;
  for (let i = 0; i < fd.length; i += 4) lumSum += (fd[i] + fd[i + 1] + fd[i + 2]) / 3;
  if (lumSum / (fd.length / 4) < 100) {
    for (let i = 0; i < fd.length; i += 4) {
      fd[i] = 255 - fd[i];
      fd[i + 1] = 255 - fd[i + 1];
      fd[i + 2] = 255 - fd[i + 2];
    }
    ctx.putImageData(full, 0, 0);
  }

  const cellPx = S / 9;
  const tess = await loadTesseract();
  const worker = await tess.createWorker('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '123456789',
    tessedit_pageseg_mode: '10', // single char
  });

  const out: string[] = [];
  try {
    for (let i = 0; i < 81; i++) {
      const r = (i / 9) | 0;
      const c = i % 9;
      // マス中央 70% をトリミング（グリッド線を避ける）
      const pad = cellPx * 0.15;
      const x = c * cellPx + pad;
      const y = r * cellPx + pad;
      const w = cellPx - pad * 2;
      const sub = ctx.getImageData(x, y, w, w);
      if (isBlank(sub)) {
        out.push('.');
        onProgress?.(i + 1);
        continue;
      }
      const cell = document.createElement('canvas');
      cell.width = w;
      cell.height = w;
      cell.getContext('2d')?.putImageData(sub, 0, 0);
      const { data } = await worker.recognize(cell);
      const m = (data.text || '').match(/[1-9]/);
      out.push(m ? m[0] : '.');
      onProgress?.(i + 1);
    }
  } finally {
    // 識別中に例外が出ても worker を必ず解放（リーク防止）
    await worker.terminate();
  }
  return out.join('');
}

function isBlank(img: ImageData): boolean {
  // 暗いピクセル（数字）が一定割合未満なら空白とみなす
  const d = img.data;
  let dark = 0;
  const total = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 110) dark++;
  }
  return dark / total < 0.03;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

// Tesseract.js を必要時のみ CDN から動的ロード（本体バンドルに含めない）。
// バージョンは**厳密固定**：範囲指定（@5）だと esm.sh 側の解決が変わった日に挙動が変わる。
async function loadTesseract(): Promise<any> {
  // @ts-expect-error -- リモート URL import には型定義がない（実行時は Vite が素通しする）
  const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/tesseract.js@5.1.1');
  return mod.default ?? mod;
}
