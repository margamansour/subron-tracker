import { describe, expect, it } from 'vitest';
import { computeWeeks, grossBase, median } from '../src/lib/rates';
import { project } from '../src/lib/analysis';
import { xirr } from '../src/lib/xirr';
import type { InvestorSnapshot, WeekReport } from '../src/lib/types';

const inv = (name: string, invested: number, pnl: number): InvestorSnapshot => ({
  name, invested, pnl, available: invested + pnl, roi: null, xirr: null, weeklyAvailChange: null, weeklyPnlChange: null, exited: false, accounts: [],
});
const rep = (date: string, investors: InvestorSnapshot[], ledger: WeekReport['ledger'] = []): WeekReport => ({ date, source: 'report', investors, ledger, importedAt: '' });

describe('true weekly rate', () => {
  it('gross base = invested + P&L ÷ 0.45', () => expect(grossBase(1000, 450)).toBe(2000));

  it('is identical for investors with different time in the fund', () => {
    // A: base 2000, B: base 10000. A 1% week adds 20 and 100 of reported P&L.
    const w = computeWeeks([rep('2026-01-04', [inv('A', 1000, 450), inv('B', 9000, 450)]), rep('2026-01-11', [inv('A', 1000, 470), inv('B', 9000, 550)])]);
    expect(w[0].groupRate).toBeCloseTo(1, 10);
    expect(w[0].investors.map((x) => x.rate)).toEqual([expect.closeTo(1, 10), expect.closeTo(1, 10)]);
    // naive % differs: 20/1450 vs 100/9450
    expect(w[0].investors[0].naive).not.toBeCloseTo(w[0].investors[1].naive!, 2);
  });

  it('adds in-week deposits to the base (they earn the full week)', () => {
    const w = computeWeeks([
      rep('2026-01-04', [inv('A', 1000, 450)]),
      rep('2026-01-11', [inv('A', 2000, 480)], [{ date: '2026-01-07', investor: 'A', account: '#', type: 'Deposit', amount: 1000 }]),
    ]);
    expect(w[0].investors[0].prevBase).toBe(3000);
    expect(w[0].investors[0].rate).toBeCloseTo(1, 10);
  });

  it('infers deposits from Invested when there is no ledger (CSV weeks)', () => {
    const w = computeWeeks([rep('2026-01-04', [inv('A', 1000, 450)]), rep('2026-01-11', [inv('A', 2000, 480)])]);
    expect(w[0].investors[0].rate).toBeCloseTo(1, 10);
    expect(w[0].investors[0].depositFlows[0].inferred).toBe(true);
  });

  it('uses the median as the group rate and reports ratios', () => {
    const w = computeWeeks([
      rep('2026-01-04', [inv('A', 1000, 450), inv('B', 1000, 450), inv('H', 1000, 450)]),
      rep('2026-01-11', [inv('A', 1000, 470), inv('B', 1000, 470), inv('H', 1000, 459)]),
    ]);
    expect(w[0].groupRate).toBeCloseTo(1, 10);
    expect(w[0].investors.find((x) => x.name === 'H')!.ratio).toBeCloseTo(0.45, 10);
  });

  it('median works for even counts', () => expect(median([1, 2, 3, 4])).toBe(2.5));
});

describe('projection', () => {
  it('compounds the gross base and applies top-ups', () => {
    const p = project({ start: { date: '2026-01-04', invested: 1000, pnl: 450 }, weeklyRatePct: 1, weeks: 2, topUp: 1000, topUpDate: '2026-01-15' });
    expect(p[1].gain).toBeCloseTo(20, 10); // 1% of 2000
    // base after week 1 = 2000 + 20/0.45; plus 1000 top-up in week 2
    expect(p[2].gain).toBeCloseTo(0.01 * (2000 + 20 / 0.45 + 1000), 8);
    expect(p[2].invested).toBe(2000);
  });
});

describe('xirr', () => {
  it('returns ~10% for a one-year 10% gain', () => {
    expect(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }])!).toBeCloseTo(10, 2);
  });
});
