import type { AccountLine, InvestorSnapshot, LedgerEntry, WeekReport } from './types';
import { MONEY_RE, parseMoney, parsePercent } from './money';

const HEADER_RE = /PnL\s*[—–-]+\s*Group:\s*(.+?)\s*[—–-]+\s*(\d{4}-\d{2}-\d{2})/;
const SECTION_RE = /^\s*━+\s*(.+?)\s*━+\s*$/;
const LEDGER_LINE_RE = /^\s*(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\S*#\S*|\S+)\s+(Deposit|Withdraw(?:al)?)\s+(.+?)\s*$/i;

function moneyAfterColon(line: string): number | null {
  const after = line.slice(line.lastIndexOf(':') + 1);
  const m = after.match(MONEY_RE);
  return m ? parseMoney(m[m.length - 1]) : null;
}

export function parseLedgerLine(line: string): LedgerEntry | null {
  const m = line.match(LEDGER_LINE_RE);
  if (!m) return null;
  const amtMatch = m[5].match(MONEY_RE);
  if (!amtMatch) return null;
  const type = /^dep/i.test(m[4]) ? 'Deposit' : 'Withdraw';
  const abs = Math.abs(parseMoney(amtMatch[0]));
  return {
    date: m[1],
    investor: m[2].trim(),
    account: m[3],
    type,
    amount: type === 'Deposit' ? abs : -abs,
  };
}

export class ReportParseError extends Error {}

/** Parse one weekly plain-text P&L report. */
export function parseReport(text: string): WeekReport {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let date: string | null = null;
  for (const l of lines) {
    const m = l.match(HEADER_RE);
    if (m) { date = m[2]; break; }
  }
  if (!date) throw new ReportParseError('Could not find the header line ("PnL — Group: … — YYYY-MM-DD").');

  const investors: InvestorSnapshot[] = [];
  const groupLedger: LedgerEntry[] = [];
  let cur: InvestorSnapshot | null = null;
  let mode: 'none' | 'investor' | 'accounts' | 'investorLedger' | 'groupLedger' = 'none';

  for (const line of lines) {
    const sec = line.match(SECTION_RE);
    if (sec) {
      const title = sec[1];
      if (/^ledger/i.test(title)) { mode = 'groupLedger'; cur = null; continue; }
      cur = {
        name: title, invested: 0, pnl: 0, available: 0, roi: null, xirr: null,
        weeklyAvailChange: null, weeklyPnlChange: null, exited: false, accounts: [],
      };
      investors.push(cur);
      mode = 'investor';
      continue;
    }
    if (mode === 'groupLedger') {
      const e = parseLedgerLine(line);
      if (e) groupLedger.push(e);
      continue;
    }
    if (!cur) continue;
    const t = line.trim();
    if (!t) continue;
    const low = t.toLowerCase();

    if (/^-\s*total invested/.test(low)) { cur.invested = moneyAfterColon(t) ?? 0; mode = 'investor'; continue; }
    if (/^-\s*total p&l/.test(low)) { cur.pnl = moneyAfterColon(t) ?? 0; continue; }
    if (/^-\s*available to withdraw/.test(low)) { cur.available = moneyAfterColon(t) ?? 0; continue; }
    if (/^-\s*weekly change \(available/.test(low)) { cur.weeklyAvailChange = moneyAfterColon(t); continue; }
    if (/^-\s*weekly change \(p&l/.test(low)) { cur.weeklyPnlChange = moneyAfterColon(t); continue; }
    if (/^-\s*xirr/.test(low)) { cur.xirr = parsePercent(t.slice(t.lastIndexOf(':') + 1)); continue; }
    if (/^-\s*roi/.test(low)) {
      const v = t.slice(t.lastIndexOf(':') + 1).trim();
      cur.roi = parsePercent(v);
      if (cur.roi == null) cur.roiLabel = v;
      continue;
    }
    if (/no assigned accounts/.test(low)) { cur.exited = true; continue; }
    if (/^per-account breakdown/.test(low)) { mode = 'accounts'; continue; }
    if (/pnl ledger/.test(low)) { mode = 'investorLedger'; continue; }
    if (mode === 'investorLedger') continue; // the group ledger at the end is authoritative
    if (mode === 'accounts') {
      const amts = (t.match(MONEY_RE) ?? []).map(parseMoney);
      const acct: AccountLine = {
        account: (t.match(/#+\S*/)?.[0]) ?? t.split(/[:\s]/)[0].replace(/^[-•]\s*/, ''),
        raw: t, amounts: amts, placeholder: amts.length > 0 && amts.every((a) => a === 0),
      };
      cur.accounts.push(acct);
    }
  }

  if (investors.length === 0) throw new ReportParseError('No investor blocks ("━━ Name ━━") found.');
  for (const inv of investors) {
    if (inv.available === 0 && Math.abs(inv.invested + inv.pnl) < 0.01 && inv.pnl !== 0) inv.exited = true;
    if (inv.roi == null && !inv.roiLabel) {
      if (inv.exited) inv.roiLabel = 'EXITED';
      else if (inv.invested > 0) inv.roi = (inv.pnl / inv.invested) * 100;
      else inv.roiLabel = 'N/A';
    }
  }
  return { date, source: 'report', investors, ledger: groupLedger, importedAt: new Date().toISOString(), raw: text };
}
