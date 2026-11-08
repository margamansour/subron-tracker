import type { InvestorSnapshot, WeekReport } from './types';
import { parseMoney, parsePercent } from './money';

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "Apr 3" -> "2026-04-03". Also accepts ISO dates. */
export function parseShortDate(s: string, year = 2026): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (!m) throw new Error(`Unrecognised date "${s}"`);
  const mo = MONTHS[m[1].toLowerCase()];
  if (!mo) throw new Error(`Unrecognised month in "${s}"`);
  const y = m[3] ? +m[3] : year;
  return `${y}-${String(mo).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function money(s: string): number {
  if (!s || /^(n\/?a|-)$/i.test(s)) return 0;
  return parseMoney(s.includes('$') ? s : `$${s.replace(/^-/, '')}`) * (s.trim().startsWith('-') && !s.includes('$') ? -1 : 1);
}

/** Parse the history CSV (Date, Investor, Invested, P&L, Available, ROI%, XIRR%) into weekly reports. */
export function parseHistoryCsv(text: string): WeekReport[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z&%]/g, ''));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    date: idx(['date']), investor: idx(['investor', 'name']), invested: idx(['invested']),
    pnl: idx(['p&l', 'pnl']), available: idx(['available']), roi: idx(['roi%', 'roi']), xirr: idx(['xirr%', 'xirr']),
  };
  if (col.date < 0 || col.investor < 0 || col.invested < 0 || col.pnl < 0 || col.available < 0)
    throw new Error('CSV must have Date, Investor, Invested, P&L and Available columns.');

  const byDate = new Map<string, InvestorSnapshot[]>();
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    if (!c[col.date] || !c[col.investor]) continue;
    const date = parseShortDate(c[col.date]);
    const roiRaw = col.roi >= 0 ? c[col.roi] ?? '' : '';
    const roi = parsePercent(roiRaw);
    const inv: InvestorSnapshot = {
      name: c[col.investor],
      invested: money(c[col.invested]),
      pnl: money(c[col.pnl]),
      available: money(c[col.available]),
      roi,
      roiLabel: roi == null && roiRaw ? roiRaw.toUpperCase() : undefined,
      xirr: col.xirr >= 0 ? parsePercent(c[col.xirr]) : null,
      weeklyAvailChange: null,
      weeklyPnlChange: null,
      exited: /exited/i.test(roiRaw),
      accounts: [],
    };
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(inv);
  }
  const now = new Date().toISOString();
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, investors]) => ({ date, source: 'csv' as const, investors, ledger: [], importedAt: now }));
}
