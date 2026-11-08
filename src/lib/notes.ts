/** Background history to show on charts and in the anomaly log. Dates are report (week-ending) dates. */
export interface HistoryNote {
  date: string;
  title: string;
  detail: string;
  anomaly?: boolean; // a known historic anomaly: checks that fail this week are expected
}

export const HISTORY_NOTES: HistoryNote[] = [
  { date: '2026-04-19', title: 'Keshia exited', detail: "Keshia's balance was absorbed into Subron's account ($2,049.21 on 2026-04-14)." },
  { date: '2026-06-07', title: 'Unreconciled jumps', detail: 'The Jun 7 report had jumps and losses that do not reconcile. Kept as a known historic anomaly.', anomaly: true },
  { date: '2026-07-26', title: '~$38,924 new deposits', detail: 'About $38,924 went in on Jul 21 (Osama $14,999.99, Subron2 $6,391.53, Junior, Kim, Ved, Toby). Rates were compressed for about 4 weeks afterwards.' },
  { date: '2026-08-30', title: 'Hans withdrew $13,800', detail: 'Hans withdrew $13,800 on 2026-08-25, more than he had deposited, so his Invested shows −$107.90. He has earned about 0.45–0.49× the group rate since.' },
  { date: '2026-09-06', title: 'Rate spike', detail: 'Weekly rate spike, followed by a slump to the record low on Sep 20.' },
  { date: '2026-09-20', title: 'Record low', detail: 'Lowest weekly rate on record (~0.099%).' },
  { date: '2026-11-08', title: 'Amreen exited; 2 joined', detail: 'Amreen fully exited (withdrew $11,382.58). Pacific and Peter Strugar joined on 2026-11-04.' },
];

/** Ongoing issues that are already known: a flagged rate is shown amber ("known") rather than red. */
export const KNOWN_RATE_ISSUES: { investor: string; from: string; note: string }[] = [
  { investor: 'Hans', from: '2026-08-30', note: 'Known issue since his $13,800 withdrawal on 2026-08-25.' },
];

export const STREAK_INVESTOR = 'Hans';
