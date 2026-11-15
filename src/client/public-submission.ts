// 求解前的题面才可进入候选；服务器必须再次独立校验。
export function eligibleForPublic(grid: number[], solutions: number, uncertain: number, confirmed: boolean, sample: string): boolean {
  const value = grid.join('');
  return confirmed && uncertain === 0 && solutions === 1 && grid.length === 81 && grid.every(v => Number.isInteger(v) && v >= 0 && v <= 9) && grid.some(v => v === 0) && grid.some(v => v !== 0) && value !== sample.replace(/\./g, '0');
}
