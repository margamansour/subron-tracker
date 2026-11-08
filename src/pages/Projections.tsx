import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { project, rateStats } from '../lib/analysis';
import { grossBase } from '../lib/rates';
import { HISTORY_NOTES } from '../lib/notes';
import { usd, signedUsd } from '../lib/money';
import { Card, Stat } from '../components/ui';
import { TimeLines, longDate, SERIES } from '../components/charts';
import type { PageProps } from '../App';

export function Projections(_: PageProps) {
  const { ds, settings } = useApp();
  const anomalies = new Set(HISTORY_NOTES.filter((n) => n.anomaly).map((n) => n.date));
  const last12 = ds.weeks.filter((w) => w.groupRate != null && !anomalies.has(w.date)).slice(-12).map((w) => w.groupRate!);
  const st = rateStats(last12);
  const [rate, setRate] = useState((st.median ?? 0.5).toFixed(4));
  const [topUp, setTopUp] = useState('0');
  const [topUpDate, setTopUpDate] = useState('');
  const [months, setMonths] = useState('12');

  const me = ds.latest!.investors.find((x) => x.name === settings.me);
  const weeks = Math.max(1, Math.round((+months || 12) * 52 / 12));
  const opts = me ? { start: { date: ds.latest!.date, invested: me.invested, pnl: me.pnl }, weeks, topUp: +topUp || 0, topUpDate: topUpDate || undefined } : null;

  const res = useMemo(() => {
    if (!opts) return null;
    const mid = project({ ...opts, weeklyRatePct: +rate || 0 });
    const low = project({ ...opts, weeklyRatePct: st.p25 ?? 0 });
    const high = project({ ...opts, weeklyRatePct: st.p75 ?? 0 });
    return { mid, low, high, rows: mid.map((p, i) => ({ date: p.date, mid: p.available, low: low[i].available, high: high[i].available, pnl: p.pnl })) };
  }, [JSON.stringify(opts), rate, st.p25, st.p75]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me || !res) return <p className="muted">“{settings.me}” isn't in the latest report. Pick yourself on the My Account page.</p>;
  const end = res.mid[res.mid.length - 1];
  const base = grossBase(me.invested, me.pnl);
  const weeklyNow = (base * (+rate || 0)) / 100;

  return (
    <div>
      <div className="page-head">
        <div><h1>Projections</h1><div className="muted">For {settings.me}, starting from the week to {longDate(ds.latest!.date)}</div></div>
      </div>
      <div className="notice" style={{ marginBottom: 14 }}>
        <b>These are estimates, not guarantees.</b> They assume every future week earns the same rate. Real weeks have ranged from about {st.min?.toFixed(2)}% to {st.max?.toFixed(2)}% in the last 12 weeks alone, and past returns don't predict future ones.
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
          <label className="field">Assumed weekly true rate (%)
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: 130 }} />
          </label>
          <div className="row small">
            <button onClick={() => setRate((st.p25 ?? 0).toFixed(4))}>Low {st.p25?.toFixed(3)}%</button>
            <button onClick={() => setRate((st.median ?? 0).toFixed(4))}>Median {st.median?.toFixed(3)}%</button>
            <button onClick={() => setRate((st.p75 ?? 0).toFixed(4))}>High {st.p75?.toFixed(3)}%</button>
          </div>
          <label className="field">Extra top-up ($)<input type="number" step="100" value={topUp} onChange={(e) => setTopUp(e.target.value)} style={{ width: 120 }} /></label>
          <label className="field">Top-up date<input type="date" value={topUpDate} onChange={(e) => setTopUpDate(e.target.value)} /></label>
          <label className="field">Horizon (months)<input type="number" min="1" max="120" value={months} onChange={(e) => setMonths(e.target.value)} style={{ width: 90 }} /></label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Low / median / high are the 25th, 50th and 75th percentiles of the last {last12.length} weekly rates (anomaly weeks left out).</p>
      </div>
      <div className="grid cards section">
        <Stat label={`Available in ${months} months`} value={usd(end.available)} sub={`${signedUsd(end.available - me.available)} from today`} />
        <Stat label="P&L by then" value={usd(end.pnl)} />
        <Stat label="Weekly income now" value={usd(weeklyNow)} sub={`≈ ${usd((weeklyNow * 52) / 12)} a month`} />
        <Stat label="Weekly income at the end" value={usd(end.gain)} sub={`≈ ${usd((end.gain * 52) / 12)} a month`} />
        <Stat label="Range (low – high)" value={<span style={{ fontSize: 16 }}>{usd(res.low[res.low.length - 1].available)} – {usd(res.high[res.high.length - 1].available)}</span>} />
      </div>
      <div className="section">
        <Card title="Projected available balance (estimate)">
          <TimeLines data={res.rows} notes={false} height={320} series={[
            { key: 'high', label: `High (${st.p75?.toFixed(3)}%)`, color: SERIES[2], dashed: true },
            { key: 'mid', label: `Your rate (${(+rate).toFixed(3)}%)`, color: SERIES[0] },
            { key: 'low', label: `Low (${st.p25?.toFixed(3)}%)`, color: SERIES[1], dashed: true },
          ]} />
        </Card>
      </div>
    </div>
  );
}
