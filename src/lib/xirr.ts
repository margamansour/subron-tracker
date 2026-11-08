export interface CashFlow { date: string; amount: number } // from the investor's view: deposits negative

const DAY = 86400000;
const t = (d: string) => Date.parse(d + 'T00:00:00Z');

/** Annualised internal rate of return (%), or null if it can't be solved. */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return null;
  const t0 = Math.min(...flows.map((f) => t(f.date)));
  const npv = (r: number) => flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (t(f.date) - t0) / DAY / 365), 0);
  let lo = -0.9999, hi = 1000;
  let flo = npv(lo), fhi = npv(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid * 100;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * 100;
}
