import type { LedgerEntry, WeekReport } from './types';

export const INVESTOR_SHARE = 0.45;

/** A deposit or withdrawal, either from a report's ledger or inferred from a change in "Invested". */
export interface Flow extends LedgerEntry {
  inferred: boolean;
}

export interface InvestorWeek {
  name: string;
  prevBase: number; // gross base used for the week (previous week's base + in-week deposits)
  deposits: number; // deposits during the week (positive)
  withdrawals: number; // withdrawals during the week (negative)
  depositFlows: Flow[]; // the in-week deposits (part-week money)
  pnlChange: number;
  availChange: number;
  rate: number | null; // true weekly rate, %
  naive: number | null; // weekly gain / previous available, %
  ratio: number | null; // rate / group rate
}

export interface WeekCalc {
  date: string;
  prevDate: string;
  groupRate: number | null; // median of investor true rates, %
  investors: InvestorWeek[];
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Gross base = Invested + Reported P&L ÷ 0.45 (the reported P&L is the investor's 45% share). */
export const grossBase = (invested: number, pnl: number) => invested + pnl / INVESTOR_SHARE;

export const sortReports = (reports: WeekReport[]) => [...reports].sort((a, b) => a.date.localeCompare(b.date));

/** Every ledger entry across all imported reports, de-duplicated. */
export function mergedLedger(reports: WeekReport[]): LedgerEntry[] {
  const seen = new Map<string, LedgerEntry>();
  for (const r of reports)
    for (const e of r.ledger) seen.set(`${e.date}|${e.investor}|${e.account}|${e.type}|${e.amount.toFixed(2)}`, e);
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date) || a.investor.localeCompare(b.investor));
}

/**
 * All cash movements, week by week. Where a report's ledger has entries for an investor in a week, those
 * are used. Otherwise (e.g. weeks that only exist in the CSV history) the change in "Invested" is recorded
 * as one inferred movement dated on the report date.
 */
export function buildFlows(reports: WeekReport[], ledger = mergedLedger(reports)): Flow[] {
  const sorted = sortReports(reports);
  const out: Flow[] = ledger.map((e) => ({ ...e, inferred: false }));
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    const prevBy = new Map(prev?.investors.map((x) => [x.name, x]) ?? []);
    for (const c of cur.investors) {
      const p = prevBy.get(c.name);
      if (!prev && !p) continue; // first snapshot: opening balances, not movements
      const dInv = c.invested - (p?.invested ?? 0);
      const after = prev?.date ?? '0000-00-00';
      const inLedger = ledger.some((e) => e.investor === c.name && e.date > after && e.date <= cur.date);
      if (inLedger || Math.abs(dInv) < 0.005) continue;
      out.push({
        date: cur.date, investor: c.name, account: '(inferred)', inferred: true,
        type: dInv > 0 ? 'Deposit' : 'Withdraw', amount: Math.round(dInv * 100) / 100,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.investor.localeCompare(b.investor));
}

export const flowsIn = (flows: Flow[], investor: string, after: string, upTo: string) =>
  flows.filter((e) => e.investor === investor && e.date > after && e.date <= upTo);

/** True weekly rates for every consecutive pair of reports. */
export function computeWeeks(reports: WeekReport[], flows = buildFlows(reports)): WeekCalc[] {
  const sorted = sortReports(reports);
  const out: WeekCalc[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    const prevBy = new Map(prev.investors.map((x) => [x.name, x]));
    const invs: InvestorWeek[] = [];
    for (const c of cur.investors) {
      const p = prevBy.get(c.name);
      if (!p || p.exited || c.exited || p.available <= 0) continue;
      const f = flowsIn(flows, c.name, prev.date, cur.date);
      const depositFlows = f.filter((x) => x.amount > 0);
      const deposits = depositFlows.reduce((s, x) => s + x.amount, 0);
      const withdrawals = f.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
      // In-week deposits earn the full week, so they join the base.
      const base = grossBase(p.invested, p.pnl) + deposits;
      const pnlChange = c.pnl - p.pnl;
      invs.push({
        name: c.name, prevBase: base, deposits, withdrawals, depositFlows, pnlChange,
        availChange: c.available - p.available,
        rate: base > 0 ? (pnlChange / base) * 100 : null,
        naive: p.available > 0 ? (pnlChange / p.available) * 100 : null,
        ratio: null,
      });
    }
    const groupRate = median(invs.map((x) => x.rate).filter((r): r is number => r != null));
    for (const x of invs) x.ratio = groupRate && x.rate != null ? x.rate / groupRate : null;
    out.push({ date: cur.date, prevDate: prev.date, groupRate, investors: invs });
  }
  return out;
}
