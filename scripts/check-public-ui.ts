// 无浏览器 DOM 替身：验证事件与请求合同，不代替实际布局验收。
import assert from 'node:assert/strict';
import { readReceipts, setupReceipts, RECEIPT_KEY } from '../src/client/public-receipts.ts';
import { SOLVER_SAMPLE } from '../src/data/solver-sample.ts';
import { parseDoubleCells, resetPublicSource } from '../src/client/public-submission.ts';
import { solveOne } from '../src/engine/countSolver.ts';
assert.equal(parseDoubleCells(['', '', '', '']), null);
assert.deepEqual(parseDoubleCells(['1', '1', '9', '9']), [0, 80]);
for (const invalid of [['1', '', '9', '9'], ['0', '1', '9', '9'], ['1', '1', '1', '1'], ['10', '1', '9', '9'], ['1.2', '1', '9', '9']]) assert.equal(parseDoubleCells(invalid), undefined);
const oldSource = ["newspaper", "asahi", "2026-11-14", "朝刊", "123", "1", "1", "9", "9"].map(value => ({ value }));
const confirmation = { checked: true };
resetPublicSource(oldSource, confirmation); assert.ok(oldSource.every(field => field.value === "")); assert.equal(confirmation.checked, false);
class Element {
  children: (Element | string)[] = []; textContent = ''; hidden = false; disabled = false; value = ''; href = ''; className = ''; type = ''; inputMode = ''; maxLength = 0;
  handlers: Record<string, (() => unknown)[]> = {};
  dataset: Record<string, string> = {}; checked = false; validity = { valid: true }; innerHTML = '';
  classList = { add: (..._names: string[]) => {} };
  after(..._nodes: Element[]) {}
  append(...nodes: (Element | string)[]) { this.children.push(...nodes); }
  prepend(...nodes: (Element | string)[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: (Element | string)[]) { this.children = nodes; this.textContent = ''; }
  setAttribute() {}
  removeAttribute() {}
  addEventListener(event: string, handler: () => unknown) { (this.handlers[event] ??= []).push(handler); }
  async click() { for (const handler of this.handlers.click ?? []) await handler(); }
}
const all = (root: Element): Element[] => [root, ...root.children.flatMap(child => typeof child === 'string' ? [] : all(child))];
const button = (root: Element, text: string): Element => { const result = all(root).find(e => e.textContent === text); assert.ok(result, text); return result; };
let root = new Element();
Object.defineProperty(globalThis, 'document', { value: { createElement: () => new Element(), getElementById: () => root }, configurable: true });
const data = new Map<string, string>();
const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
const receipt = { puzzleId: 'a'.repeat(64), submissionId: 'submission-1', withdrawToken: 'secret-1', grid: SOLVER_SAMPLE.replace(/\./g, '0') };
const panel = new Element(); const state = setupReceipts(panel as unknown as HTMLElement);
assert.equal(state.add(receipt), true); assert.equal(state.has(receipt.grid), true);
assert.equal(readReceipts(storage).length, 1);
const restoredPanel = new Element(); const restored = setupReceipts(restoredPanel as unknown as HTMLElement); assert.equal(restored.has(receipt.grid), true);
let requestBody = '';
Object.defineProperty(globalThis, 'fetch', { value: async (_url: string, init?: RequestInit) => { requestBody = String(init?.body); return { ok: true }; }, configurable: true });
await button(restoredPanel, 'この投稿を取り下げる').click();
assert.deepEqual(JSON.parse(requestBody), { submissionId: receipt.submissionId, withdrawToken: receipt.withdrawToken });
assert.equal(readReceipts(storage).length, 0);
data.set(RECEIPT_KEY, 'invalid json'); assert.deepEqual(readReceipts(storage), []);
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, configurable: true });
assert.equal(setupReceipts(new Element() as unknown as HTMLElement).add(receipt), false);
let calls: string[] = [];
Object.defineProperty(globalThis, 'location', { value: { search: '', origin: 'https://numpredo.com', pathname: '/public-puzzles/' }, configurable: true });
Object.defineProperty(globalThis, 'fetch', { value: async (url: string) => { calls.push(url); return { ok: true, json: async () => ({ items: [{ id: receipt.puzzleId, status: 'public', createdAt: '2026-11-15T00:00:00Z' }], nextCursor: calls.length === 1 ? 'date~hash' : null }) }; }, configurable: true });
const listModule = '../src/client/public-puzzles.ts?list';
await import(listModule);
await new Promise(resolve => setImmediate(resolve));
assert.ok(all(root).some(e => e.textContent.includes('2026-11-15 · aaaaaaaa')));
await button(root, 'もっと見る').click(); await new Promise(resolve => setImmediate(resolve));
assert.equal(calls[1], '/api/public-puzzles?cursor=date%7Ehash');
root = new Element();
Object.defineProperty(globalThis, 'location', { value: { search: '?id=' + receipt.puzzleId, origin: 'https://numpredo.com', pathname: '/public-puzzles/' }, configurable: true });
Object.defineProperty(globalThis, 'fetch', { value: async () => ({ ok: true, json: async () => ({ status: 'public', grid: receipt.grid, sources: [{ newspaper: 'asahi', publicationDate: '2026-11-14', edition: '<script>', verification: 'unverified', doubleCells: [0, 80] }] }) }), configurable: true });
const events: IArguments[] = [];
Object.defineProperty(globalThis, 'window', { value: { dataLayer: events }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
const detailModule = '../src/client/public-puzzles.ts?detail';
await import(detailModule); await new Promise(resolve => setImmediate(resolve));
assert.ok(all(root).some(e => e.textContent.includes('投稿者申告・未確認')));
const stepLink = all(root).find(e => e.textContent.includes('この問題をソルバーで解き'));
assert.equal(stepLink?.href, '/tools/solver/#grid=' + receipt.grid);
assert.ok(all(root).some(e => e.href === '/guide/how-to-solve/'));
const expectedAnswer = solveOne([...receipt.grid].map(Number)); assert.ok(expectedAnswer);
const challengeInputs = all(root).filter(e => e.type === 'text');
const solutionValues = solveOne([...receipt.grid].map(Number)); assert.ok(solutionValues);
for (let i = 0; i < 81; i++) if (!challengeInputs[i].disabled) { challengeInputs[i].value = String(solutionValues[i]); for (const handler of challengeInputs[i].handlers.input ?? []) handler(); }
await button(root, '答えを確認').click(); await button(root, '答えを確認').click();
await button(root, 'この問題のリンクをコピー').click();
assert.deepEqual(events.map(e => e[1]), ['public_challenge_start', 'public_challenge_complete', 'public_share']);
assert.ok(events.every(e => JSON.stringify(Array.from(e)).includes(receipt.puzzleId) === false));
await button(root, '二重枠の数字と合計を見る').click();
assert.ok(all(root).some(e => e.textContent.includes(String(expectedAnswer[0]) + ' + ' + String(expectedAnswer[80]) + ' = ' + String(expectedAnswer[0] + expectedAnswer[80])) && e.textContent.includes('公式発表ではありません')));
const inputs = all(root).filter(e => e.type === 'text'); assert.equal(inputs.length, 81);
const original = inputs.map(e => e.value); const solution = all(root).find(e => e.hidden); assert.ok(solution);
await button(root, '答えを表示する').click(); assert.equal(solution.hidden, false); assert.deepEqual(inputs.map(e => e.value), original);
await button(root, '答えを隠す').click(); assert.equal(solution.hidden, true);
// 新页面先主动查看答案，再完成，不能计为独立完成。
root = new Element();
const revealedModule = '../src/client/public-puzzles.ts?revealed';
await import(revealedModule); await new Promise(resolve => setImmediate(resolve));
await button(root, '答えを表示する').click(); await button(root, '答えを隠す').click();
const assistedInputs = all(root).filter(e => e.type === 'text');
for (let i = 0; i < 81; i++) if (!assistedInputs[i].disabled) { assistedInputs[i].value = String(solutionValues[i]); for (const handler of assistedInputs[i].handlers.input ?? []) handler(); }
await button(root, '答えを確認').click();
assert.equal(events.filter(e => e[1] === 'public_challenge_complete').length, 1);
Object.defineProperty(globalThis, 'document', { value: { createElement: () => new Element(), getElementById: () => null }, configurable: true });
const { showRecentPublic } = await import('../src/client/recent-public.ts');
const recent = new Element();
Object.defineProperty(globalThis, 'fetch', { value: async () => ({ ok: true, json: async () => ({ items: [{ id: receipt.puzzleId, grid: receipt.grid, status: 'public' }, { id: 'b'.repeat(64), grid: receipt.grid, status: 'candidate' }] }) }), configurable: true });
await showRecentPublic(recent as unknown as HTMLElement);
assert.equal(all(recent).filter(e => e.href.startsWith('/public-puzzles/?id=')).length, 1);
assert.ok(all(recent).some(e => e.textContent.includes('・') && e.textContent.includes('\n')));
Object.defineProperty(globalThis, 'fetch', { value: async () => { throw new Error('offline'); }, configurable: true });
await showRecentPublic(recent as unknown as HTMLElement); assert.ok(recent.textContent.includes('読み込めませんでした'));
// 求解器真实事件处理器：只截获本地 fetch 和 dataLayer，不发送请求。
const submissionGrid = solutionValues.map((v, i) => i === 0 ? 0 : v).join('');
for (const outcome of ['accepted', 'duplicate', 'failed'] as const) {
  root = new Element();
  const fields = new Map<string, Element>();
  for (const key of ['sv-public', 'sv-confirm', 'sv-public-status', 'sv-source', 'sv-paper', 'sv-date', 'sv-edition', 'sv-issue', 'sv-double-r1', 'sv-double-c1', 'sv-double-r2', 'sv-double-c2']) fields.set(key, new Element());
  Object.defineProperty(globalThis, 'document', { value: { createElement: () => new Element(), getElementById: (id: string) => id === 'sv-app' ? root : fields.get(id) ?? null, querySelectorAll: () => [], addEventListener() {} }, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { search: '', hash: '#grid=' + submissionGrid, origin: 'https://numpredo.com', pathname: '/tools/solver/' }, configurable: true });
  Object.defineProperty(globalThis, 'fetch', { value: async () => ({ ok: outcome !== 'failed', json: async () => ({ puzzleId: receipt.puzzleId, submissionId: receipt.submissionId, withdrawToken: receipt.withdrawToken, duplicate: outcome === 'duplicate' }) }), configurable: true });
  const solverModule = '../src/client/ocr-solve.ts?' + outcome; await import(solverModule);
  fields.get('sv-public')!.checked = true; fields.get('sv-confirm')!.checked = true; if (outcome !== 'failed') { fields.get('sv-source')!.value = 'other'; fields.get('sv-edition')!.value = 'private source text'; }
  await button(root, '解く').click(); await new Promise(resolve => setImmediate(resolve));
  const event = events.filter(e => e[1] === 'public_submission').at(-1);
  assert.ok(event); assert.deepEqual(event[2], { result: outcome, source_filled: outcome === 'failed' ? 'no' : 'yes' });
  if (outcome !== 'failed') { await button(root, '解く').click(); assert.equal(events.at(-1)?.[2].result, 'local_duplicate'); }
}
const serialized = JSON.stringify(events.map(e => Array.from(e)));
for (const secret of [submissionGrid, receipt.puzzleId, receipt.submissionId, receipt.withdrawToken, 'private source text']) assert.ok(!serialized.includes(secret), secret);
console.log('公共前端行为与统计通过：投稿成功/失败/去重/来源填写、挑战/首次完成/分享、看答案后不计完成、无敏感字段');
