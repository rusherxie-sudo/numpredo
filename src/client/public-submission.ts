// 空值表示未填写，undefined 表示输入不完整或非法。坐标以 1 为起点，接口索引以 0 为起点。
export function parseDoubleCells(values: string[]): [number, number] | null | undefined {
  if (values.length !== 4) return undefined;
  if (values.every(value => value.trim() === '')) return null;
  if (!values.every(value => /^[1-9]$/.test(value.trim()))) return undefined;
  const [r1, c1, r2, c2] = values.map(Number);
  const a = (r1 - 1) * 9 + c1 - 1, b = (r2 - 1) * 9 + c2 - 1;
  return a === b ? undefined : [a, b];
}

// 原题切换时清除上题来源；普通格子修正不调用此函数。
export function resetPublicSource(fields: { value: string }[], confirmation: { checked: boolean }): void {
  for (const field of fields) field.value = "";
  confirmation.checked = false;
}

// 求解前的题面才可进入候选；服务器必须再次独立校验。
export function eligibleForPublic(grid: number[], solutions: number, uncertain: number, confirmed: boolean, sample: string): boolean {
  const value = grid.join('');
  return confirmed && uncertain === 0 && solutions === 1 && grid.length === 81 && grid.every(v => Number.isInteger(v) && v >= 0 && v <= 9) && grid.some(v => v === 0) && grid.some(v => v !== 0) && value !== sample.replace(/\./g, '0');
}
