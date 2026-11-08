// Acceptance tests against your real history. ./data is not in git, so these skip when it is missing.
import { existsSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { parseHistoryCsv } from '../src/lib/parseCsv';
import { buildDataset } from '../src/lib/analysis';
import { lowRatioStreak } from '../src/lib/checks';

const CSV = 'data/subron-group-pnl.csv';

describe.skipIf(!existsSync(CSV))('acceptance: real history CSV', () => {
  const ds = buildDataset(parseHistoryCsv(readFileSync(CSV, 'utf8')));
  const week = (d: string) => ds.weeks.find((w) => w.date === d)!;
  const rate = (d: string, who: string) => week(d).investors.find((x) => x.name === who)!.rate!;

  it('imports every week from Apr 3', () => {
    expect(ds.reports[0].date).toBe('2026-04-03');
    expect(ds.latest!.date).toBe('2026-11-08');
  });
  it('week to Oct 11: group 1.1490%, Hans 0.5410%', () => {
    expect(week('2026-10-11').groupRate!).toBeCloseTo(1.149, 4);
    expect(rate('2026-10-11', 'Hans')).toBeCloseTo(0.541, 4);
  });
  it('week to Oct 25: group 0.2888%', () => expect(week('2026-10-25').groupRate!).toBeCloseTo(0.2888, 4));
  it('week to Nov 8: group 1.5911%, Hans 0.778%', () => {
    expect(week('2026-11-08').groupRate!).toBeCloseTo(1.5911, 4);
    expect(rate('2026-11-08', 'Hans')).toBeCloseTo(0.778, 3);
  });
  it('week to Sep 20: ~0.099%, the record low', () => {
    expect(week('2026-09-20').groupRate!).toBeCloseTo(0.099, 3);
    const lowest = Math.min(...ds.weeks.map((w) => w.groupRate!));
    expect(lowest).toBe(week('2026-09-20').groupRate);
  });
  it('Jul 21 depositors earn the same rate as everyone (deposits earn the full week)', () => {
    const w = week('2026-07-26');
    for (const x of w.investors) expect(x.ratio!).toBeCloseTo(1, 3);
    expect(w.investors.find((x) => x.name === 'Osama')!.deposits).toBeCloseTo(14999.99, 1);
  });
  it('tracks the Hans streak', () => {
    const s = lowRatioStreak(ds.weeks, 'Hans', ds.weeks.length - 1);
    expect(s.since).toBe('2026-08-30');
    expect(s.weeks).toBeGreaterThanOrEqual(10);
  });
  it('infers Amreen exit withdrawal of $11,382.58', () => {
    const f = ds.flows.find((x) => x.investor === 'Amreen' && x.date === '2026-11-08')!;
    expect(f.amount).toBeCloseTo(-11382.58, 2);
  });
});

describe.skipIf(!existsSync(CSV))('Jun 7 anomaly covers Jun 7 – Jun 28', () => {
  const ds = buildDataset(parseHistoryCsv(readFileSync(CSV, 'utf8')));
  const level = (d: string) => ds.checks.find((c) => c.date === d)!;
  it('those four weeks are amber with the anomaly note, not red', () => {
    for (const d of ['2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28']) {
      expect(level(d).level).toBe('warn');
      expect(level(d).anomalyNote).toMatch(/Jun 28/);
    }
  });
  it('weeks either side are unaffected', () => {
    expect(level('2026-05-31').anomalyNote).toBeUndefined();
    expect(level('2026-07-05').anomalyNote).toBeUndefined();
  });
  it('no red weeks remain in the CSV history', () => {
    expect(ds.checks.filter((c) => c.level === 'fail').map((c) => c.date)).toEqual([]);
  });
});
