import { useApp } from '../state';
import { usd, pct, signedUsd } from '../lib/money';
import { SortableTable, toneOf } from '../components/ui';
import type { Column } from '../components/ui';
import { longDate } from '../components/charts';
import { InvestorDetail } from './InvestorDetail';
import type { PageProps } from '../App';

interface Row {
  name: string; invested: number; pnl: number; available: number; roi: number | null; roiLabel?: string; xirr: number | null;
  gain: number | null; rate: number | null; ratio: number | null; naive: number | null; exited: boolean;
}

export function Investors({ sub }: PageProps) {
  const { ds, settings } = useApp();
  if (sub) {
    const name = decodeURIComponent(sub);
    return (
      <div>
        <div className="page-head"><div><a href="#/investors">← All investors</a><h1 style={{ marginTop: 6 }}>{name}</h1></div></div>
        <InvestorDetail name={name} />
      </div>
    );
  }
  const latest = ds.latest!;
  const week = ds.weeks[ds.weeks.length - 1];
  const prevBy = new Map(ds.reports[ds.reports.length - 2]?.investors.map((x) => [x.name, x]) ?? []);
  const rows: Row[] = latest.investors.map((s) => {
    const w = week?.date === latest.date ? week.investors.find((x) => x.name === s.name) : undefined;
    const p = prevBy.get(s.name);
    return { ...s, gain: p ? s.pnl - p.pnl : null, rate: w?.rate ?? null, ratio: w?.ratio ?? null, naive: w?.naive ?? null };
  });
  const cols: Column<Row>[] = [
    { key: 'name', label: 'Investor', value: (r) => r.name, render: (r) => <>{r.name}{r.name === settings.me && <span className="badge info" style={{ marginLeft: 6 }}>you</span>}{r.exited && <span className="badge info" style={{ marginLeft: 6 }}>exited</span>}</> },
    { key: 'invested', label: 'Invested', num: true, value: (r) => r.invested, render: (r) => usd(r.invested) },
    { key: 'pnl', label: 'P&L', num: true, value: (r) => r.pnl, render: (r) => usd(r.pnl) },
    { key: 'available', label: 'Available', num: true, value: (r) => r.available, render: (r) => usd(r.available) },
    { key: 'roi', label: 'ROI', num: true, value: (r) => r.roi, render: (r) => (r.roi != null ? pct(r.roi) : r.roiLabel ?? '—') },
    { key: 'xirr', label: 'XIRR', num: true, value: (r) => r.xirr, render: (r) => pct(r.xirr) },
    { key: 'gain', label: 'This week', num: true, value: (r) => r.gain, render: (r) => <span className={toneOf(r.gain)}>{signedUsd(r.gain)}</span> },
    { key: 'naive', label: 'Naive %', num: true, value: (r) => r.naive, render: (r) => pct(r.naive, 3) },
    { key: 'rate', label: 'True rate', num: true, value: (r) => r.rate, render: (r) => (r.rate != null ? `${r.rate.toFixed(4)}%` : '—') },
    { key: 'ratio', label: '× group', num: true, value: (r) => r.ratio, render: (r) => (r.ratio == null ? '—' : <span className={Math.abs(r.ratio - 1) > 0.01 ? 'neg' : ''}>{r.ratio.toFixed(3)}</span>) },
  ];
  return (
    <div>
      <div className="page-head">
        <div><h1>Investors</h1><div className="muted">Week to {longDate(latest.date)} · group true rate {week?.groupRate != null ? `${week.groupRate.toFixed(4)}%` : '—'} · click a row for history</div></div>
      </div>
      <div className="card">
        <SortableTable rows={rows} columns={cols} initialSort={{ key: 'available', desc: true }}
          onRowClick={(r) => { window.location.hash = `#/investors/${encodeURIComponent(r.name)}`; }}
          rowClass={(r) => (r.name === settings.me ? 'me' : '')} />
        <p className="small muted" style={{ marginBottom: 0 }}>
          <b>Naive %</b> = this week's gain ÷ last week's available. It differs between investors only because of time in the fund, which is expected.
          <b> True rate</b> = gain ÷ gross base (Invested + P&L ÷ 0.45, plus in-week deposits). It should be the same for everyone.
        </p>
      </div>
    </div>
  );
}
