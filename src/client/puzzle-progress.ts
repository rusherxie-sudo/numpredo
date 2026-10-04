import type { LibraryProgress } from '../data/puzzle-techniques.ts';
export function readLibraryProgress(level: string): LibraryProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`numpredo.library.${level}`) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([n, status]) => /^[1-9]\d*$/.test(n) && (status === 'started' || status === 'done'))) as LibraryProgress;
  } catch { return {}; }
}
