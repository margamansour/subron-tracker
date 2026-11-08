import { useApp } from '../state';
import { groupTotals } from '../lib/analysis';
import { usd, signedUsd } from '../lib/money';
import { Card, Stat, toneOf } from '../components/ui';
import { ChecksPanel } from '../components/ChecksPanel';
import { TimeLines, WeeklyBars, longDate, SERIES } from '../components/charts';
import type { PageProps } from '../App';

export function Overview(_: PageProps) {
  const { ds } = useApp();
  const latest = ds.latest!;
  const t = groupTotals(latest);
  const prev = ds.reports[ds.reports.length - 2];
  const tp = prev ? groupTotals(prev) : null;
  const lastWeek = ds.weeks[ds.weeks.length - 1];
  // Weekly gain = sum of each investor's P&L change (exits don't count as losses).
  const prevBy = new Map(prev?.investors.map((x) => [x.name, x]) ?? []);
  const weekGain = prev ? latest.investors.reduce((s, x) => s + (prevBy.has(x.name) ? x.pnl - prevBy.get(x.name)!.pnl : 0), 0) : null;
  const netFlows = prev ? ds.flows.filter((f) => f.date > prev.date && f.date <= latest.date).reduce((s, f) => s + f.amount, 0) : null;

  const availSeries = ds.reports.map((r) => ({ date: r.date, available: groupTotals(r).available, invested: groupTotals(r).invested }));
  let sum = 0;
  const rateSeries = ds.weeks.map((w, i) => {
    sum += w.groupRate ?? 0;
    return { date: w.date, rate: w.groupRate, avg: sum / (i + 1) };
  });
  const wc = ds.checks[ds.checks.length - 1];

  return (
    <div>
      <div className="page-head">
        <div><h1>Overview</h1><div className="muted">Subron Group · latest report {longDate(latest.date)} · {ds.reports.length} weeks on record</div></div>
      </div>
      <div className="grid cards">
        <Stat label="Group available" value={usd(t.available)} sub={tp ? `${signedUsd(t.available - tp.available)} this week, incl. ${signedUsd(netFlows)} net deposits/withdrawals` : undefined} />
        <Stat label="Group invested" value={usd(t.invested)} sub="active investors only" />
        <Stat label="Group P&L (investor share)" value={usd(t.pnl)} sub={weekGain != null ? `${signedUsd(weekGain)} earned this week` : undefined} tone={toneOf(t.pnl)} />
        <Stat label="Active investors" value={t.active} sub={tp && tp.active !== t.active ? `${t.active - tp.active > 0 ? '+' : ''}${t.active - tp.active} vs last week` : 'unchanged'} />
        <Stat label="This week's true rate" value={lastWeek?.groupRate != null ? `${lastWeek.groupRate.toFixed(4)}%` : '—'} sub="median across investors" />
      </div>
      <div className="grid two section">
        <Card title="Group available over time">
          <TimeLines data={availSeries} series={[{ key: 'available', label: 'Available', color: SERIES[0] }, { key: 'invested', label: 'Invested', color: SERIES[2], dashed: true }]} />
        </Card>
        <Card title="Weekly true rate">
          <WeeklyBars data={rateSeries} barKey="rate" barLabel="Group true rate" lineKey="avg" lineLabel="Running average" />
        </Card>
      </div>
      <div className="section card"><ChecksPanel wc={wc} compact /></div>
    </div>
  );
}
