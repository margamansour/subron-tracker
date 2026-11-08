import { useState } from 'react';
import { useApp } from '../state';
import { usd, signedUsd } from '../lib/money';
import { Stat, toneOf } from '../components/ui';
import type { PageProps } from '../App';

export function Ledger(_: PageProps) {
  const { ds } = useApp();
  const [who, setWho] = useState('');
  const [showInferred, setShowInferred] = useState(true);
  const names = [...new Set(ds.flows.map((f) => f.investor))].sort();
  const rows = ds.flows.filter((f) => (!who || f.investor === who) && (showInferred || !f.inferred));
  const dep = rows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  const wd = rows.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0);

  return (
    <div>
      <div className="page-head">
        <div><h1>Ledger</h1><div className="muted">All deposits and withdrawals</div></div>
        <div className="row">
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">All investors</option>
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>
          <label className="row small"><input type="checkbox" checked={showInferred} onChange={(e) => setShowInferred(e.target.checked)} /> Include inferred</label>
        </div>
      </div>
      <div className="grid cards">
        <Stat label="Deposits" value={usd(dep)} />
        <Stat label="Withdrawals" value={usd(-wd)} />
        <Stat label="Net" value={signedUsd(dep + wd)} />
        <Stat label="Entries" value={rows.length} />
      </div>
      <div className="section card">
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Investor</th><th>Account</th><th>Type</th><th className="num">Amount</th></tr></thead>
          <tbody>{[...rows].reverse().map((f, i) => (
            <tr key={i}><td>{f.date}</td><td>{f.investor}</td><td className="muted">{f.account}</td><td>{f.type}</td><td className={`num ${toneOf(f.amount) ?? ''}`}>{signedUsd(f.amount)}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          “(inferred)” rows are worked out from a change in an investor's Invested figure, for weeks where no report ledger covers that movement (mainly the CSV history). They're dated on the report date, not the actual day. The reports remove the ledger entries of investors who have fully exited.
        </p>
      </div>
    </div>
  );
}
