export function returnPath(value: string | null): string | null {
  if (!value || !/^\/(play|daily)(\/|$)/.test(value) || value.startsWith('//')) return null;
  try { const u = new URL(value, 'https://numpredo.com'); return u.origin === 'https://numpredo.com' && /^\/(play|daily)(\/|$)/.test(u.pathname) && !value.includes('\\') ? u.pathname + u.search + u.hash : null; } catch { return null; }
}
export function carriedParam(key: string): string | null {
  return new URLSearchParams(location.hash.slice(1)).get(key) ?? new URLSearchParams(location.search).get(key);
}
export function carriedReturn(): string | null { return returnPath(carriedParam('return')); }
export function toolLink(path: string, grid: number[], back = carriedReturn()): string {
  const params = new URLSearchParams({ grid: grid.map(v => v || '.').join('') });
  if (back) params.set('return', back);
  return `${path}#${params}`;
}
export function addReturnLink(parent: HTMLElement): void {
  const back = carriedReturn();
  if (!back) return;
  const p = document.createElement('p'), a = document.createElement('a');
  a.href = back; a.textContent = '元のゲームに戻って続きを解く →'; a.dataset.learningReturn = '';
  p.append(a); parent.append(p);
}
