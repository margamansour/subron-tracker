import type { WeekReport } from './types';
import { parseReport } from './parseReport';
import { parseHistoryCsv } from './parseCsv';
import { readBackup } from './storage';
import type { Backup } from './types';

export type Detected =
  | { kind: 'reports'; reports: WeekReport[]; label: string }
  | { kind: 'backup'; backup: Backup; label: string };

/** Work out what a dropped/pasted file is and parse it. */
export function detectAndParse(text: string, filename = 'pasted text'): Detected {
  const head = text.trimStart().slice(0, 200);
  if (head.startsWith('{')) return { kind: 'backup', backup: readBackup(text), label: filename };
  if (/^﻿?"?date"?\s*,/i.test(head)) return { kind: 'reports', reports: parseHistoryCsv(text.replace(/^﻿/, '')), label: filename };
  return { kind: 'reports', reports: [parseReport(text)], label: filename };
}

export interface FieldDiff { investor: string; field: string; before: string; after: string }
export interface ReportDiff {
  date: string;
  added: string[];
  removed: string[];
  changed: FieldDiff[];
  ledgerBefore: number;
  ledgerAfter: number;
  sourceBefore: WeekReport['source'];
  sourceAfter: WeekReport['source'];
  identical: boolean;
}

const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(2) : String(v));

export function diffReports(before: WeekReport, after: WeekReport): ReportDiff {
  const b = new Map(before.investors.map((x) => [x.name, x]));
  const a = new Map(after.investors.map((x) => [x.name, x]));
  const changed: FieldDiff[] = [];
  for (const [name, x] of a) {
    const y = b.get(name);
    if (!y) continue;
    for (const f of ['invested', 'pnl', 'available', 'roi', 'xirr'] as const) {
      const bv = y[f], av = x[f];
      if (bv == null && av == null) continue;
      if (bv == null || av == null || Math.abs(bv - av) > 0.005) changed.push({ investor: name, field: f, before: fmt(bv), after: fmt(av) });
    }
  }
  const added = [...a.keys()].filter((k) => !b.has(k));
  const removed = [...b.keys()].filter((k) => !a.has(k));
  return {
    date: after.date, added, removed, changed,
    ledgerBefore: before.ledger.length, ledgerAfter: after.ledger.length,
    sourceBefore: before.source, sourceAfter: after.source,
    identical: !added.length && !removed.length && !changed.length && before.ledger.length === after.ledger.length,
  };
}
