export function readDailyLog(): Record<string, number> {
  try {
    const p = JSON.parse(localStorage.getItem('numpredo.daily.log') ?? '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, number>) : {};
  } catch { return {}; }
}
export function readDailyLog5(): Record<string, string[]> {
  try {
    const p = JSON.parse(localStorage.getItem('numpredo.daily.log5') ?? '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, string[]>) : {};
  } catch { return {}; }
}
