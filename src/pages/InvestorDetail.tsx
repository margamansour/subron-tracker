import { useApp } from '../state';
import { investorHistory, ledgerXirr } from '../lib/analysis';
import { usd, pct, signedUsd } from '../lib/money';
import { Card, Stat, toneOf } from '../components/ui';
import { isAnomalyWeek } from '../lib/notes';
import { TimeLines, WeeklyBars, longDate, shortDate, SERIES } from '../components/charts';

/** Everything about one investor: cards, charts, best/worst weeks, full week-by-week table. */
export function InvestorDetail({ name }: { name: string }) {
  const { ds } = useApp();
  const hist = investorHistory(ds, name);
  if (!hist.length) return <p className="muted">No data for “{name}”.</p>;
  const cur = hist[hist.length - 1];
  const firstFlow = ds.flows.find((f) => f.investor === name && f.amount > 0);
  const startDate = firstFlow && firstFlow.date < hist[0].date ? firstFlow.date : hist[0].date;
  const weeks = Math.floor((Date.parse(ds.latest!.date) - Date.parse(startDate)) / (7 * 86400000));
  const lx = ledgerXirr(ds, name);
  const gains = hist.filter((h) => h.gain != null && h.date !== hist[0].date);
  const ranked = gains.filter((h) => !isAnomalyWeek(h.date));
  const best = [...ranked].sort((a, b) => (b.rate ?? -1e9) - (a.rate ?? -1e9)).slice(0, 5);
  const worst = [...ranked].sort((a, b) => (a.rate ?? 1e9) - (b.rate ?? 1e9)).slice(0, 5);
  const latestIsCurrent = cur.date === ds.latest!.date;

  return (
    <div>
      {!latestIsCurrent && <div className="notice" style={{ marginBottom: 12 }}>{name} is not in the latest report. Figures below are from {longDate(cur.date)}.</div>}
      <div className="grid cards">
        <Stat label="Invested" value={usd(cur.invested)} sub={cur.invested < 0 ? 'withdrawn more than deposited' : undefined} />
        <Stat label="P&L" value={usd(cur.pnl)} tone={toneOf(cur.pnl)} />
        <Stat label="Available" value={usd(cur.available)} />
        <Stat label="ROI" value={cur.roi != null ? pct(cur.roi) : cur.roiLabel ?? '—'} />
        <Stat label="XIRR (from report)" value={pct(cur.xirr)}
          sub={lx.value != null ? <>From cash flows: {pct(lx.value)}{lx.inferred ? ' (approx.)' : ''}{cur.xirr != null ? ` · diff ${(lx.value - cur.xirr).toFixed(2)} pts` : ''}</> : undefined} />
        <Stat label="Weeks in the fund" value={weeks} sub={`since ${longDate(startDate)}`} />
        <Stat label="This week's gain" value={signedUsd(cur.gain)} tone={toneOf(cur.gain)}
          sub={cur.rate != null ? `true rate ${cur.rate.toFixed(4)}%${cur.ratio != null ? ` · ${cur.ratio.toFixed(3)}× group` : ''}` : undefined} />
      </div>
      <div className="grid two section">
        <Card title="Available"><TimeLines data={hist} series={[{ key: 'available', label: 'Available', color: SERIES[0] }, { key: 'invested', label: 'Invested', color: SERIES[2], dashed: true }]} /></Card>
        <Card title="P&L (your 45% share)"><TimeLines data={hist} series={[{ key: 'pnl', label: 'P&L', color: SERIES[0] }]} /></Card>
        <Card title="XIRR (as reported)"><TimeLines data={hist.filter((h) => h.xirr != null)} fmt="pct" series={[{ key: 'xirr', label: 'XIRR', color: SERIES[0] }]} notes={false} /></Card>
        <Card title="Weekly gain"><WeeklyBars data={gains} barKey="gain" barLabel="P&L gain" fmt="usd" /></Card>
      </div>
      <div className="grid two section">
        <Card title="Best weeks (by true rate, anomaly weeks left out)"><WeekList rows={best} /></Card>
        <Card title="Worst weeks (by true rate, anomaly weeks left out)"><WeekList rows={worst} /></Card>
      </div>
      <div className="section card">
        <h2>Week by week</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Week to</th><th className="num">Invested</th><th className="num">P&L</th><th className="num">Available</th><th className="num">Gain</th><th className="num">True rate</th><th className="num">× group</th><th className="num">XIRR</th></tr></thead>
          <tbody>{[...hist].reverse().map((h) => (
            <tr key={h.date}>
              <td>{longDate(h.date)}</td><td className="num">{usd(h.invested)}</td><td className="num">{usd(h.pnl)}</td><td className="num">{usd(h.available)}</td>
              <td className={`num ${toneOf(h.gain) ?? ''}`}>{signedUsd(h.gain)}</td><td className="num">{h.rate != null ? `${h.rate.toFixed(4)}%` : '—'}</td>
              <td className={`num ${h.ratio != null && Math.abs(h.ratio - 1) > 0.01 ? 'neg' : ''}`}>{h.ratio != null ? h.ratio.toFixed(3) : '—'}</td><td className="num">{pct(h.xirr)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function WeekList({ rows }: { rows: ReturnType<typeof investorHistory> }) {
  return (
    <table><tbody>{rows.map((r) => (
      <tr key={r.date}><td>{shortDate(r.date)}{isAnomalyWeek(r.date) && <span className="badge fail" style={{ marginLeft: 6 }}>anomaly</span>}</td><td className={`num ${toneOf(r.gain) ?? ''}`}>{signedUsd(r.gain)}</td><td className="num">{r.rate != null ? `${r.rate.toFixed(4)}%` : '—'}</td></tr>
    ))}</tbody></table>
  );
}
