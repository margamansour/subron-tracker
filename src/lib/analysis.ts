import type { InvestorSnapshot, WeekReport } from './types';
import { buildFlows, computeWeeks, grossBase, mean, median, mergedLedger, percentile, sortReports, INVESTOR_SHARE } from './rates';
import type { Flow, WeekCalc } from './rates';
import { runChecks } from './checks';
import type { WeekChecks } from './checks';
import { xirr } from './xirr';

export interface Dataset {
  reports: WeekReport[]; // sorted by date
  flows: Flow[];
  weeks: WeekCalc[];
  checks: WeekChecks[]; // one per report, same order
  investors: string[]; // everyone ever seen
  latest: WeekReport | null;
}

export function buildDataset(reportsIn: WeekReport[]): Dataset {
  const reports = sortReports(reportsIn);
  const ledger = mergedLedger(reports);
  const flows = buildFlows(reports, ledger);
  const weeks = computeWeeks(reports, flows);
  const ledgerRep = [...reports].reverse().find((r) => r.ledger.length);
  const lastLedgerReport = ledgerRep?.date ?? '';
  // Investors whose ledger entries the latest report leaves out: anyone exited or no longer listed.
  const everyone = new Set(reports.flatMap((r) => r.investors.map((x) => x.name)));
  const ledgerOmits = new Set([...everyone].filter((n) => { const x = ledgerRep?.investors.find((y) => y.name === n); return !x || x.exited; }));
  const checks = reports.map((r, i) => runChecks(r, reports[i - 1], weeks.find((w) => w.date === r.date), weeks, flows, r.date <= lastLedgerReport, ledgerOmits));
  const names = new Set<string>();
  reports.forEach((r) => r.investors.forEach((x) => names.add(x.name)));
  return { reports, flows, weeks, checks, investors: [...names].sort(), latest: reports[reports.length - 1] ?? null };
}

export interface HistoryRow extends InvestorSnapshot {
  date: string;
  gain: number | null; // P&L change this week
  rate: number | null;
  ratio: number | null;
  groupRate: number | null;
}

export function investorHistory(ds: Dataset, name: string): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const r of ds.reports) {
    const s = r.investors.find((x) => x.name === name);
    if (!s) continue;
    const w = ds.weeks.find((x) => x.date === r.date);
    const iw = w?.investors.find((x) => x.name === name);
    const prev = rows[rows.length - 1];
    rows.push({ ...s, date: r.date, gain: iw?.pnlChange ?? (prev ? s.pnl - prev.pnl : null), rate: iw?.rate ?? null, ratio: iw?.ratio ?? null, groupRate: w?.groupRate ?? null });
  }
  return rows;
}

/** Combined history for a group of accounts (e.g. Subron + Subron2). */
export function combinedHistory(ds: Dataset, members: string[]) {
  return ds.reports.map((r) => {
    const parts = r.investors.filter((x) => members.includes(x.name));
    const sum = (k: 'invested' | 'pnl' | 'available') => parts.reduce((s, x) => s + x[k], 0);
    const byMember = Object.fromEntries(members.map((m) => [m, r.investors.find((x) => x.name === m)?.available ?? 0]));
    return { date: r.date, present: parts.length > 0, invested: sum('invested'), pnl: sum('pnl'), available: sum('available'), byMember };
  }).filter((x) => x.present).map((x, i, a) => ({ ...x, gain: i ? x.pnl - a[i - 1].pnl : null }));
}

export function groupTotals(r: WeekReport) {
  const active = r.investors.filter((x) => !x.exited && x.available > 0);
  return {
    invested: active.reduce((s, x) => s + x.invested, 0),
    pnl: active.reduce((s, x) => s + x.pnl, 0),
    available: active.reduce((s, x) => s + x.available, 0),
    active: active.length,
  };
}

/** XIRR computed from the cash flows we know about, plus the current balance as if withdrawn today. */
export function ledgerXirr(ds: Dataset, name: string): { value: number | null; inferred: boolean } {
  const first = ds.reports.find((r) => r.investors.some((x) => x.name === name));
  const last = [...ds.reports].reverse().find((r) => r.investors.some((x) => x.name === name));
  if (!first || !last) return { value: null, inferred: false };
  const own = ds.flows.filter((f) => f.investor === name);
  const cfs = own.map((f) => ({ date: f.date, amount: -f.amount }));
  // Money already in the fund at the first snapshot, if no ledger entry explains it.
  const opening = first.investors.find((x) => x.name === name)!;
  const explained = own.filter((f) => f.date <= first.date).reduce((s, f) => s + f.amount, 0);
  if (opening.invested - explained > 0.01 && first === ds.reports[0]) cfs.push({ date: first.date, amount: -(opening.invested - explained) });
  const lastSnap = last.investors.find((x) => x.name === name)!;
  if (lastSnap.available > 0) cfs.push({ date: last.date, amount: lastSnap.available });
  return { value: xirr(cfs), inferred: own.some((f) => f.inferred) || first === ds.reports[0] };
}

export function rateStats(rates: number[]) {
  return {
    count: rates.length,
    min: rates.length ? Math.min(...rates) : null,
    max: rates.length ? Math.max(...rates) : null,
    mean: mean(rates),
    median: median(rates),
    p25: percentile(rates, 0.25),
    p75: percentile(rates, 0.75),
    stdev: rates.length > 1 ? Math.sqrt(rates.reduce((s, r) => s + (r - mean(rates)!) ** 2, 0) / (rates.length - 1)) : null,
  };
}

export interface ProjectionPoint { date: string; available: number; pnl: number; invested: number; gain: number }

/**
 * Project an account forward week by week. Each week P&L grows by rate × gross base, and the gross base grows
 * by that gain ÷ 0.45 (exactly how the reports behave). A top-up joins the base for the whole week it lands in.
 */
export function project(opts: {
  start: { date: string; invested: number; pnl: number };
  weeklyRatePct: number; weeks: number; topUp?: number; topUpDate?: string;
}): ProjectionPoint[] {
  let { invested, pnl } = opts.start;
  let base = grossBase(invested, pnl);
  const r = opts.weeklyRatePct / 100;
  let d = new Date(opts.start.date + 'T00:00:00Z');
  let prevIso = opts.start.date;
  const out: ProjectionPoint[] = [{ date: opts.start.date, available: invested + pnl, pnl, invested, gain: 0 }];
  for (let i = 0; i < opts.weeks; i++) {
    d = new Date(d.getTime() + 7 * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (opts.topUp && opts.topUpDate && opts.topUpDate > prevIso && opts.topUpDate <= iso) { invested += opts.topUp; base += opts.topUp; }
    const gain = r * base;
    pnl += gain;
    base += gain / INVESTOR_SHARE;
    out.push({ date: iso, available: invested + pnl, pnl, invested, gain });
    prevIso = iso;
  }
  return out;
}
