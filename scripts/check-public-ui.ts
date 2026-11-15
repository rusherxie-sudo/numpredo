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
  append(...nodes: (Element | string)[]) { this.children.push(...nodes); }
  prepend(...nodes: (Element | string)[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: (Element | string)[]) { this.children = nodes; this.textContent = ''; }
  setAttribute() {}
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
const detailModule = '../src/client/public-puzzles.ts?detail';
await import(detailModule); await new Promise(resolve => setImmediate(resolve));
assert.ok(all(root).some(e => e.textContent.includes('投稿者申告・未確認')));
const stepLink = all(root).find(e => e.textContent.includes('この問題をソルバーで解き'));
assert.equal(stepLink?.href, '/tools/solver/#grid=' + receipt.grid);
assert.ok(all(root).some(e => e.href === '/guide/how-to-solve/'));
const expectedAnswer = solveOne([...receipt.grid].map(Number)); assert.ok(expectedAnswer);
await button(root, '二重枠の数字と合計を見る').click();
assert.ok(all(root).some(e => e.textContent.includes(String(expectedAnswer[0]) + ' + ' + String(expectedAnswer[80]) + ' = ' + String(expectedAnswer[0] + expectedAnswer[80])) && e.textContent.includes('公式発表ではありません')));
const inputs = all(root).filter(e => e.type === 'text'); assert.equal(inputs.length, 81);
const original = inputs.map(e => e.value); const solution = all(root).find(e => e.hidden); assert.ok(solution);
await button(root, '答えを表示する').click(); assert.equal(solution.hidden, false); assert.deepEqual(inputs.map(e => e.value), original);
await button(root, '答えを隠す').click(); assert.equal(solution.hidden, true);
Object.defineProperty(globalThis, 'document', { value: { createElement: () => new Element(), getElementById: () => null }, configurable: true });
const { showRecentPublic } = await import('../src/client/recent-public.ts');
const recent = new Element();
Object.defineProperty(globalThis, 'fetch', { value: async () => ({ ok: true, json: async () => ({ items: [{ id: receipt.puzzleId, grid: receipt.grid, status: 'public' }, { id: 'b'.repeat(64), grid: receipt.grid, status: 'candidate' }] }) }), configurable: true });
await showRecentPublic(recent as unknown as HTMLElement);
assert.equal(all(recent).filter(e => e.href.startsWith('/public-puzzles/?id=')).length, 1);
assert.ok(all(recent).some(e => e.textContent.includes('・') && e.textContent.includes('\n')));
Object.defineProperty(globalThis, 'fetch', { value: async () => { throw new Error('offline'); }, configurable: true });
await showRecentPublic(recent as unknown as HTMLElement); assert.ok(recent.textContent.includes('読み込めませんでした'));
console.log('公共前端行为通过：坐标校验、二重框计算、解法链接、最近题面与失败降级、撤回和默认隐藏答案');
