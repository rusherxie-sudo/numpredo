const SYMBOLS = '123456789ABCDEFG';
export function variantSymbol(value: number): string { return value ? SYMBOLS[value-1] : ''; }
export function decodeVariant(value: string): number[] { return [...value].map(c => c==='.'||c==='0' ? 0 : SYMBOLS.indexOf(c)+1); }
