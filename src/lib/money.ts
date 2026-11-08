/** Parse "$1,234.56", "($107.90)", "-$5.00", "+$612.12" into a number. */
export function parseMoney(s: string): number {
  const t = s.trim();
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-') || t.startsWith('−');
  const n = parseFloat(t.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) throw new Error(`Not a money value: "${s}"`);
  return neg ? -n : n;
}

export const MONEY_RE = /[+\-−]?\(?[+\-−]?\$[\d,]+(?:\.\d+)?\)?/g;

export function parsePercent(s: string | undefined | null): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t || /^(n\/?a|exited|-)$/i.test(t)) return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-') || t.startsWith('−');
  const n = parseFloat(t.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const usd = (n: number | null | undefined) => (n == null ? '—' : fmt.format(n));
export const usd0 = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const pct = (n: number | null | undefined, dp = 2) => (n == null || !isFinite(n) ? '—' : `${n.toFixed(dp)}%`);
export const signedUsd = (n: number | null | undefined) => (n == null ? '—' : (n > 0 ? '+' : '') + fmt.format(n));
