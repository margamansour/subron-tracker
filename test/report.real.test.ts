// Tests against the real Nov 8 report. ./data is not in git, so these skip when it is missing.
import { existsSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { parseReport } from '../src/lib/parseReport';
import { parseHistoryCsv } from '../src/lib/parseCsv';
import { buildDataset } from '../src/lib/analysis';
import { diffReports } from '../src/lib/importer';

const TXT = 'data/2026-11-08.txt';
const CSV = 'data/subron-group-pnl.csv';

describe.skipIf(!existsSync(TXT))('parser: real Nov 8 report', () => {
  const r = parseReport(readFileSync(TXT, 'utf8'));
  const by = (n: string) => r.investors.find((x) => x.name === n)!;

  it('reads the date from the header', () => expect(r.date).toBe('2026-11-08'));
  it('finds all 17 investors, including names with spaces', () => {
    expect(r.investors).toHaveLength(17);
    expect(by('Peter Strugar')).toMatchObject({ invested: 4000, pnl: 63.64, available: 4063.64, xirr: 259.8 });
  });
  it('reads my figures', () => {
    expect(by('Osama')).toMatchObject({ invested: 24748.66, pnl: 6787.69, available: 31536.35, weeklyAvailChange: 612.12, weeklyPnlChange: 612.12, xirr: 87.1 });
  });
  it('reads bracketed negatives', () => expect(by('Hans').invested).toBe(-107.9));
  it('recognises a fully exited investor', () => {
    expect(by('Amreen')).toMatchObject({ invested: -6080.3, pnl: 6080.3, available: 0, exited: true, roiLabel: 'EXITED' });
  });
  it('reads per-account lines and spots $0.00 placeholders', () => {
    const kim = by('Kim').accounts;
    expect(kim).toHaveLength(2);
    expect(kim[0].amounts.slice(0, 3)).toEqual([10562.18, 3740.39, 14302.57]);
    expect(kim[1].placeholder).toBe(true);
  });
  it('reads the group ledger (29 entries) with withdrawals negative', () => {
    expect(r.ledger).toHaveLength(29);
    expect(r.ledger.find((e) => e.type === 'Withdraw')).toMatchObject({ date: '2026-08-25', investor: 'Hans', amount: -13800 });
    expect(r.ledger.filter((e) => e.investor === 'Peter Strugar')).toEqual([
      { date: '2026-11-04', investor: 'Peter Strugar', account: '#######', type: 'Deposit', amount: 4000 },
    ]);
  });
  it('every investor adds up (Invested + P&L = Available)', () => {
    for (const x of r.investors) expect(x.invested + x.pnl).toBeCloseTo(x.available, 2);
  });
});

describe.skipIf(!existsSync(TXT) || !existsSync(CSV))('real report on top of the CSV history', () => {
  const csv = parseHistoryCsv(readFileSync(CSV, 'utf8'));
  const rep = parseReport(readFileSync(TXT, 'utf8'));
  const ds = buildDataset([...csv.filter((w) => w.date !== rep.date), rep]);
  const wc = ds.checks[ds.checks.length - 1];
  const check = (id: number) => wc.checks.find((c) => c.id === id)!;

  it('the report has the same figures as the CSV row for Nov 8', () => {
    const d = diffReports(csv.find((w) => w.date === rep.date)!, rep);
    expect(d.changed).toEqual([]);
    expect(d.added).toEqual([]);
  });
  it('acceptance figures still hold: Nov 8 group 1.5911%, Hans 0.778%', () => {
    const w = ds.weeks[ds.weeks.length - 1];
    expect(w.groupRate!).toBeCloseTo(1.5911, 4);
    expect(w.investors.find((x) => x.name === 'Hans')!.rate!).toBeCloseTo(0.778, 3);
  });
  it('deposits now carry their real dates from the ledger', () => {
    const osama = ds.weeks.find((w) => w.date === '2026-07-26')!.investors.find((x) => x.name === 'Osama')!;
    expect(osama.depositFlows).toEqual([expect.objectContaining({ date: '2026-07-21', amount: 14999.99, inferred: false })]);
  });
  it('checks 1 and 2 pass (Amreen exit shown amber, not red)', () => {
    expect(check(1).level).toBe('ok');
    expect(check(2).items.filter((i) => i.level === 'fail')).toEqual([]);
    expect(check(2).items.map((i) => [i.investor, i.level])).toEqual([['Amreen', 'warn']]);
  });
  it('the new joiners match the ledger', () => {
    const c3 = check(3);
    expect(c3.items.find((i) => i.investor === 'Pacific')!.level).toBe('ok');
    expect(c3.items.find((i) => i.investor === 'Peter Strugar')!.level).toBe('ok');
  });
});

describe.skipIf(!existsSync(TXT) || !existsSync(CSV))('ledger reconciliation across all weeks', () => {
  const csv = parseHistoryCsv(readFileSync(CSV, 'utf8'));
  const rep = parseReport(readFileSync(TXT, 'utf8'));
  const ds = buildDataset([...csv.filter((w) => w.date !== rep.date), rep]);
  it('every movement matches the ledger, except entries removed for exited investors (amber)', () => {
    const c3 = ds.checks.flatMap((wc) => wc.checks.filter((c) => c.id === 3).flatMap((c) => c.items.map((i) => ({ date: wc.date, ...i }))));
    expect(c3.filter((i) => i.level === 'fail')).toEqual([]);
    expect(c3.filter((i) => i.level === 'warn').map((i) => [i.date, i.investor])).toEqual([['2026-05-10', 'Amreen'], ['2026-11-08', 'Amreen']]);
  });
});
