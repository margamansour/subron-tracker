import type { WeekReport } from './types';
import type { Flow, WeekCalc } from './rates';
import { flowsIn } from './rates';
import { HISTORY_NOTES, KNOWN_RATE_ISSUES, STREAK_INVESTOR } from './notes';
import { usd, signedUsd } from './money';

export type Level = 'ok' | 'warn' | 'fail' | 'info';
export const LEVEL_ORDER: Level[] = ['info', 'ok', 'warn', 'fail'];
export const worst = (ls: Level[]): Level => ls.reduce<Level>((a, b) => (LEVEL_ORDER.indexOf(b) > LEVEL_ORDER.indexOf(a) ? b : a), 'ok');

export interface CheckItem { level: Level; text: string; investor?: string }
export interface CheckResult { id: number; title: string; level: Level; summary: string; items: CheckItem[] }
export interface WeekChecks { date: string; level: Level; checks: CheckResult[]; anomalyNote?: string }

const CENT = 0.011;
const RATE_TOLERANCE = 0.01; // 1% relative

function finish(id: number, title: string, items: CheckItem[], okSummary: string, summary?: string): CheckResult {
  const level = items.length ? worst(items.map((i) => i.level)) : 'ok';
  return { id, title, level, items, summary: summary ?? (items.filter((i) => i.level === 'fail' || i.level === 'warn').length ? `${items.filter((i) => i.level !== 'info' && i.level !== 'ok').length} issue(s)` : okSummary) };
}

/** Hans-style streak: consecutive weeks (ending at `uptoIdx`) where the investor earned < 99% of the group rate. */
export function lowRatioStreak(weeks: WeekCalc[], investor: string, uptoIdx: number) {
  let n = 0;
  const ratios: number[] = [];
  for (let i = uptoIdx; i >= 0; i--) {
    const r = weeks[i].investors.find((x) => x.name === investor)?.ratio;
    if (r == null || r >= 1 - RATE_TOLERANCE) break;
    n++;
    ratios.push(r);
  }
  return { weeks: n, since: n ? weeks[uptoIdx - n + 1].date : null, min: ratios.length ? Math.min(...ratios) : null, max: ratios.length ? Math.max(...ratios) : null, current: ratios[0] ?? null };
}

export function runChecks(
  cur: WeekReport, prev: WeekReport | undefined, week: WeekCalc | undefined, weeks: WeekCalc[],
  flows: Flow[], ledgerCoversDate: boolean,
): WeekChecks {
  const checks: CheckResult[] = [];
  const prevBy = new Map(prev?.investors.map((x) => [x.name, x]) ?? []);
  const note = HISTORY_NOTES.find((n) => n.date === cur.date && n.anomaly);

  // 1. Invested + P&L = Available
  {
    const items: CheckItem[] = [];
    for (const c of cur.investors) {
      const gap = c.invested + c.pnl - c.available;
      if (Math.abs(gap) > CENT) items.push({ level: 'fail', investor: c.name, text: `${c.name}: ${usd(c.invested)} + ${usd(c.pnl)} = ${usd(c.invested + c.pnl)}, but Available is ${usd(c.available)} (gap ${signedUsd(gap)})` });
    }
    checks.push(finish(1, 'Invested + P&L = Available', items, `All ${cur.investors.length} investors add up`));
  }

  // 2. Reported weekly change = computed change
  {
    const items: CheckItem[] = [];
    let compared = 0;
    if (prev) for (const c of cur.investors) {
      const p = prevBy.get(c.name);
      if (!p) continue;
      if (c.weeklyPnlChange != null) {
        compared++;
        const calc = c.pnl - p.pnl;
        if (Math.abs(calc - c.weeklyPnlChange) > CENT) items.push({ level: 'fail', investor: c.name, text: `${c.name}: report says P&L changed ${signedUsd(c.weeklyPnlChange)}, but ${usd(c.pnl)} − ${usd(p.pnl)} = ${signedUsd(calc)}` });
      }
      if (c.weeklyAvailChange != null) {
        const calc = c.available - p.available;
        if (Math.abs(calc - c.weeklyAvailChange) > CENT) items.push({ level: 'fail', investor: c.name, text: `${c.name}: report says Available changed ${signedUsd(c.weeklyAvailChange)}, but the difference from last week is ${signedUsd(calc)}` });
      }
    }
    const r = finish(2, 'Reported weekly change = this week − last week', items, `Matches for all ${compared} investors`);
    if (!compared && !items.length) { r.level = 'info'; r.summary = prev ? 'Not available (this week came from the CSV history, which has no weekly-change column)' : 'First week on record'; }
    checks.push(r);
  }

  // 3. Available change − P&L change = net ledger movements
  {
    const items: CheckItem[] = [];
    if (prev) {
      const names = new Set([...cur.investors.map((x) => x.name), ...prevBy.keys()]);
      for (const name of names) {
        const c = cur.investors.find((x) => x.name === name);
        const p = prevBy.get(name);
        const moved = (c ? c.available - c.pnl : 0) - (p ? p.available - p.pnl : 0);
        const f = flowsIn(flows, name, prev.date, cur.date);
        const ledgerNet = f.filter((x) => !x.inferred).reduce((s, x) => s + x.amount, 0);
        if (!c) { items.push({ level: 'info', investor: name, text: `${name} is no longer in the report (had ${usd(p!.available)} available last week)` }); continue; }
        if (!ledgerCoversDate) {
          if (Math.abs(moved) > CENT) items.push({ level: 'info', investor: name, text: `${name}: net movement ${signedUsd(moved)} (no ledger for this week; inferred from the change in Invested)` });
          continue;
        }
        const gap = moved - ledgerNet;
        if (Math.abs(gap) > CENT) {
          const exited = c.exited;
          items.push({
            level: exited || !p ? 'warn' : 'fail', investor: name,
            text: `${name}: Available − P&L moved ${signedUsd(moved)}, ledger shows ${signedUsd(ledgerNet)} (gap ${signedUsd(gap)})${exited ? ' — exited investors have their ledger entries removed' : ''}`,
          });
        } else if (Math.abs(moved) > CENT) items.push({ level: 'ok', investor: name, text: `${name}: ${signedUsd(moved)} matches the ledger` });
      }
    }
    const r = finish(3, 'Balance movements match the ledger', items, ledgerCoversDate ? 'No unexplained movements' : 'No ledger for this week');
    if (!prev) { r.level = 'info'; r.summary = 'First week on record'; }
    else if (!ledgerCoversDate && r.level === 'ok') { r.level = 'info'; r.summary = items.length ? `No ledger for this week; ${items.length} movement(s) inferred from Invested` : 'No ledger for this week; no movements'; }
    checks.push(r);
  }

  // 4. Every investor's true rate = group rate
  {
    const items: CheckItem[] = [];
    if (week?.groupRate != null) {
      for (const x of week.investors) {
        if (x.rate == null || x.ratio == null) continue;
        if (Math.abs(x.ratio - 1) > RATE_TOLERANCE) {
          const known = KNOWN_RATE_ISSUES.find((k) => k.investor === x.name && cur.date >= k.from);
          items.push({ level: known || note ? 'warn' : 'fail', investor: x.name, text: `${x.name}: ${x.rate.toFixed(4)}% vs group ${week.groupRate.toFixed(4)}% → ${x.ratio.toFixed(3)}× the group${known ? ' (known issue)' : note ? ' (known historic anomaly week)' : ''}` });
        }
        for (const d of x.depositFlows) items.push({ level: 'info', investor: x.name, text: `${x.name}: part-week deposit ${usd(d.amount)}${d.inferred ? ' (date unknown — CSV week)' : ` on ${d.date}`} earned the full week` });
      }
    }
    const r = finish(4, 'Everyone earns the group rate', items, week?.groupRate != null ? `All ${week.investors.length} within 1% of ${week.groupRate.toFixed(4)}%` : 'No previous week');
    if (!week) r.level = 'info';
    checks.push(r);
  }

  // 5. Changes since last week
  {
    const items: CheckItem[] = [];
    if (prev) {
      for (const c of cur.investors) {
        const p = prevBy.get(c.name);
        if (!p) items.push({ level: 'info', investor: c.name, text: `New investor: ${c.name} (${usd(c.invested)} invested)` });
        else if (c.exited && !p.exited) items.push({ level: 'info', investor: c.name, text: `Exited: ${c.name}` });
      }
      for (const name of prevBy.keys()) if (!cur.investors.some((c) => c.name === name)) items.push({ level: 'info', investor: name, text: `Left the report: ${name}` });
      for (const f of flows.filter((x) => x.date > prev.date && x.date <= cur.date))
        items.push({ level: 'info', investor: f.investor, text: `${f.type === 'Deposit' ? 'Deposit' : 'Withdrawal'}: ${f.investor} ${usd(Math.abs(f.amount))}${f.inferred ? ' (inferred from Invested)' : ` on ${f.date}`}` });
    }
    const r = finish(5, 'Joiners, exits, deposits and withdrawals', items, 'No changes');
    r.level = 'info';
    r.summary = prev ? (items.length ? `${items.length} change(s)` : 'No changes') : 'First week on record';
    checks.push(r);
  }

  // 6. Known ongoing issue: Hans streak
  {
    const idx = weeks.findIndex((w) => w.date === cur.date);
    const s = idx >= 0 ? lowRatioStreak(weeks, STREAK_INVESTOR, idx) : null;
    const inWeek = week?.investors.find((x) => x.name === STREAK_INVESTOR);
    let r: CheckResult;
    if (!s || !inWeek) r = { id: 6, title: `${STREAK_INVESTOR} below-group streak`, level: 'info', summary: `${STREAK_INVESTOR} not in this week`, items: [] };
    else if (s.weeks === 0) r = { id: 6, title: `${STREAK_INVESTOR} below-group streak`, level: 'ok', summary: `${STREAK_INVESTOR} earned the group rate this week`, items: [] };
    else r = {
      id: 6, title: `${STREAK_INVESTOR} below-group streak`, level: 'warn',
      summary: `${s.weeks} week${s.weeks === 1 ? '' : 's'} in a row (since week to ${s.since}); this week ${s.current!.toFixed(3)}×`,
      items: [{ level: 'warn', investor: STREAK_INVESTOR, text: `Ratio to group across the streak: ${s.min!.toFixed(3)}× – ${s.max!.toFixed(3)}×` }],
    };
    checks.push(r);
  }

  return { date: cur.date, level: worst(checks.map((c) => c.level)), checks, anomalyNote: note?.detail };
}
