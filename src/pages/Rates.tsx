import { useState } from 'react';
import { useApp } from '../state';
import { rateStats } from '../lib/analysis';
import { anomalyLabel, HISTORY_NOTES, isAnomalyWeek, STREAK_INVESTOR } from '../lib/notes';
import { lowRatioStreak } from '../lib/checks';
import { Card, LevelBadge, Stat } from '../components/ui';
import { ChecksPanel } from '../components/ChecksPanel';
import { TimeLines, WeeklyBars, longDate, shortDate, SERIES } from '../components/charts';
import { ReferenceLine } from 'recharts';
import type { PageProps } from '../App';

const r4 = (n: number | null) => (n == null ? '—' : `${n.toFixed(4)}%`);

export function Rates(_: PageProps) {
  const { ds } = useApp();
  const [excludeAnomalies, setExclude] = useState(true);
  const [weekSel, setWeekSel] = useState(ds.latest!.date);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const usable = ds.weeks.filter((w) => w.groupRate != null && !(excludeAnomalies && isAnomalyWeek(w.date)));
  const stats = rateStats(usable.map((w) => w.groupRate!));
  const minWeek = usable.find((w) => w.groupRate === stats.min);
  const maxWeek = usable.find((w) => w.groupRate === stats.max);
  let sum = 0;
  const series = ds.weeks.map((w, i) => { sum += w.groupRate ?? 0; return { date: w.date, rate: w.groupRate, avg: sum / (i + 1) }; });

  const hansSeries = ds.weeks.map((w) => ({ date: w.date, ratio: w.investors.find((x) => x.name === STREAK_INVESTOR)?.ratio ?? null })).filter((x) => x.ratio != null);
  const streak = lowRatioStreak(ds.weeks, STREAK_INVESTOR, ds.weeks.length - 1);

  const log = [...ds.checks].reverse().flatMap((wc) => wc.checks.flatMap((c) => c.items
    .filter((it) => (onlyProblems ? it.level === 'warn' || it.level === 'fail' : it.level !== 'ok'))
    .map((it) => ({ date: wc.date, check: c.id, title: c.title, ...it }))));
  const wc = ds.checks.find((c) => c.date === weekSel) ?? ds.checks[ds.checks.length - 1];

  return (
    <div>
      <div className="page-head">
        <div><h1>Rates & Anomalies</h1><div className="muted">True weekly rate = P&L change ÷ previous gross base (Invested + P&L ÷ 0.45)</div></div>
        <label className="row small"><input type="checkbox" checked={excludeAnomalies} onChange={(e) => setExclude(e.target.checked)} /> Leave anomaly weeks ({anomalyLabel(shortDate)}) out of the statistics</label>
      </div>
      <div className="grid cards">
        <Stat label="Average weekly rate" value={r4(stats.mean)} sub={`${stats.count} weeks`} />
        <Stat label="Median weekly rate" value={r4(stats.median)} sub={`middle half: ${r4(stats.p25)} – ${r4(stats.p75)}`} />
        <Stat label="Lowest week" value={r4(stats.min)} sub={minWeek ? `week to ${longDate(minWeek.date)}` : undefined} />
        <Stat label="Highest week" value={r4(stats.max)} sub={maxWeek ? `week to ${longDate(maxWeek.date)}` : undefined} />
        <Stat label="Volatility (std dev)" value={r4(stats.stdev)} sub="week-to-week spread" />
      </div>
      <div className="section card">
        <h2>True weekly rate history</h2>
        <WeeklyBars data={series} barKey="rate" barLabel="Group true rate" lineKey="avg" lineLabel="Running average" height={300} />
      </div>
      <div className="grid two section">
        <Card title={`${STREAK_INVESTOR}'s rate ÷ group rate`} right={streak.weeks ? <LevelBadge level="warn" text={`${streak.weeks}-week streak`} /> : <LevelBadge level="ok" />}>
          <TimeLines data={hansSeries} fmt="ratio" series={[{ key: 'ratio', label: 'Ratio to group', color: SERIES[0] }]}
            extra={<ReferenceLine y={1} stroke="#0ca30c" strokeDasharray="4 4" label={{ value: '1× = fair', fill: '#898781', fontSize: 11, position: 'insideTopLeft' }} />} />
          <p className="small muted">
            {streak.weeks
              ? `Below the group rate for ${streak.weeks} week(s) in a row, since the week to ${longDate(streak.since!)}. Ratio in that time: ${streak.min!.toFixed(3)}× – ${streak.max!.toFixed(3)}×; this week ${streak.current!.toFixed(3)}×.`
              : `${STREAK_INVESTOR} earned the group rate in the latest week.`}
          </p>
        </Card>
        <Card title="Checks for any week" right={
          <select value={wc.date} onChange={(e) => setWeekSel(e.target.value)}>
            {[...ds.checks].reverse().map((c) => <option key={c.date} value={c.date}>{longDate(c.date)} · {c.level === 'ok' ? '✓' : c.level === 'fail' ? '✕' : c.level === 'warn' ? '!' : 'i'}</option>)}
          </select>}>
          <ChecksPanel wc={wc} compact />
        </Card>
      </div>
      <div className="section card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Issue log</h2>
          <label className="row small"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Only problems (hide info)</label>
        </div>
        <div className="table-wrap" style={{ maxHeight: 520, marginTop: 8 }}>
          <table>
            <thead><tr><th>Week to</th><th>Level</th><th>Check</th><th>Detail</th></tr></thead>
            <tbody>{log.map((x, i) => (
              <tr key={i}><td style={{ whiteSpace: 'nowrap' }}>{shortDate(x.date)}</td><td><LevelBadge level={x.level} /></td><td className="small muted" style={{ whiteSpace: 'nowrap' }}>{x.check}. {x.title}</td><td className="small">{x.text}</td></tr>
            ))}</tbody>
          </table>
          {!log.length && <p className="muted">Nothing flagged.</p>}
        </div>
        <h3 className="section">History notes</h3>
        <ul className="small" style={{ color: 'var(--ink-2)' }}>
          {HISTORY_NOTES.map((n) => <li key={n.date}><b>{longDate(n.date)}</b>: {n.detail}{n.anomaly && <span className="badge fail" style={{ marginLeft: 6 }}>anomaly</span>}</li>)}
        </ul>
      </div>
    </div>
  );
}
