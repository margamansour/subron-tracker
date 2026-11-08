import { describe, expect, it } from 'vitest';
import { parseReport } from '../src/lib/parseReport';
import { parseShortDate } from '../src/lib/parseCsv';

const SAMPLE = `PnL — Group: Subron Group — 2026-11-08
━━ Osama ━━
- Total invested: $24,748.66
- Total P&L: $6,787.69
- Available to withdraw: $31,536.35
- Weekly change (available to withdraw), 2026-11-01 → 2026-11-08: +$612.12
- Weekly change (P&L), 2026-11-01 → 2026-11-08: +$612.12
- XIRR (annualized, same as Investors tab): 87.10%
Per-account breakdown:
— PnL Ledger (deposits / withdrawals)
  2026-05-07  Osama  #######  Deposit  $9,748.67
━━ Jane Doe ━━
- Total invested: ($107.90)
- Total P&L: $107.90
- Available to withdraw: $0.00
(No assigned accounts)
━━ Ledger: Deposits / Withdrawals (group members only) ━━
  2026-05-07  Osama  #######  Deposit  $9,748.67
  2026-08-25  Jane Doe  #######  Withdraw  ($13,800.00)
`;

describe('report parser (spec sample)', () => {
  const r = parseReport(SAMPLE);
  it('reads header date', () => expect(r.date).toBe('2026-11-08'));
  it('reads investor figures', () => {
    const o = r.investors[0];
    expect(o).toMatchObject({ name: 'Osama', invested: 24748.66, pnl: 6787.69, available: 31536.35, xirr: 87.1, weeklyPnlChange: 612.12 });
  });
  it('handles spaced names, brackets and exits', () => {
    const p = r.investors[1];
    expect(p.name).toBe('Jane Doe');
    expect(p.invested).toBe(-107.9);
    expect(p.exited).toBe(true);
  });
  it('reads the group ledger with signed amounts', () => {
    expect(r.ledger).toHaveLength(2);
    expect(r.ledger[1]).toMatchObject({ investor: 'Jane Doe', type: 'Withdraw', amount: -13800 });
  });
  it('parses short CSV dates as 2026', () => {
    expect(parseShortDate('Apr 3')).toBe('2026-04-03');
    expect(parseShortDate('Nov 8')).toBe('2026-11-08');
  });
});
