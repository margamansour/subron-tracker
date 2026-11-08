import { useState } from 'react';
import { useApp } from '../state';
import { combinedHistory } from '../lib/analysis';
import { usd, signedUsd } from '../lib/money';
import { Card, Stat, toneOf } from '../components/ui';
import { TimeLines, WeeklyBars, longDate, SERIES } from '../components/charts';
import type { PageProps } from '../App';

export function Groups(_: PageProps) {
  const { ds, settings, saveSettings } = useApp();
  const groups = settings.accountGroups;
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState<{ name: string; members: string[]; index: number | null } | null>(null);
  const g = groups[Math.min(sel, groups.length - 1)];

  async function save() {
    if (!editing || !editing.name.trim() || !editing.members.length) return;
    const next = [...groups];
    const item = { name: editing.name.trim(), members: editing.members };
    if (editing.index == null) next.push(item); else next[editing.index] = item;
    await saveSettings({ ...settings, accountGroups: next });
    setSel(editing.index ?? next.length - 1);
    setEditing(null);
  }
  async function remove(i: number) {
    if (!confirm(`Delete the group “${groups[i].name}”? (No investor data is deleted.)`)) return;
    await saveSettings({ ...settings, accountGroups: groups.filter((_, j) => j !== i) });
    setSel(0);
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Account Groups</h1><div className="muted">View several accounts combined, e.g. Subron = Subron + Subron2</div></div>
        <div className="row">
          {groups.map((x, i) => <button key={x.name + i} className={i === sel ? 'primary' : ''} onClick={() => setSel(i)}>{x.name}</button>)}
          <button onClick={() => setEditing({ name: '', members: [], index: null })}>＋ New group</button>
        </div>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>{editing.index == null ? 'New group' : 'Edit group'}</h2>
          <label className="field">Name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
          <div className="toggle-row" style={{ marginTop: 10 }}>
            {ds.investors.map((n) => {
              const on = editing.members.includes(n);
              return <button key={n} className={`chip ${on ? 'on' : 'off'}`} onClick={() => setEditing({ ...editing, members: on ? editing.members.filter((m) => m !== n) : [...editing.members, n] })}>{on ? '✓ ' : ''}{n}</button>;
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={save}>Save</button><button onClick={() => setEditing(null)}>Cancel</button></div>
        </div>
      )}

      {!g ? <p className="muted">No groups yet.</p> : <GroupView g={g} onEdit={() => setEditing({ ...g, index: groups.indexOf(g) })} onDelete={() => remove(groups.indexOf(g))} />}
      {ds && null}
    </div>
  );
}

function GroupView({ g, onEdit, onDelete }: { g: { name: string; members: string[] }; onEdit: () => void; onDelete: () => void }) {
  const { ds } = useApp();
  const hist = combinedHistory(ds, g.members);
  if (!hist.length) return <p className="muted">None of these accounts appear in the data.</p>;
  const cur = hist[hist.length - 1];
  const rows = hist.map((h) => ({ date: h.date, available: h.available, gain: h.gain, ...h.byMember }));
  const flows = ds.flows.filter((f) => g.members.includes(f.investor));
  const latest = ds.latest!;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="muted">{g.members.join(' + ')}</div>
        <div className="row"><button onClick={onEdit}>Edit</button><button className="danger" onClick={onDelete}>Delete</button></div>
      </div>
      <div className="grid cards">
        <Stat label="Combined invested" value={usd(cur.invested)} />
        <Stat label="Combined P&L" value={usd(cur.pnl)} tone={toneOf(cur.pnl)} />
        <Stat label="Combined available" value={usd(cur.available)} />
        <Stat label="This week's gain" value={signedUsd(cur.gain)} tone={toneOf(cur.gain)} />
      </div>
      <div className="section card">
        <h2>Split between accounts ({longDate(latest.date)})</h2>
        <table>
          <thead><tr><th>Account</th><th className="num">Invested</th><th className="num">P&L</th><th className="num">Available</th><th className="num">Share</th></tr></thead>
          <tbody>{g.members.map((m) => {
            const s = latest.investors.find((x) => x.name === m);
            return <tr key={m}><td>{m}</td><td className="num">{usd(s?.invested ?? 0)}</td><td className="num">{usd(s?.pnl ?? 0)}</td><td className="num">{usd(s?.available ?? 0)}</td><td className="num">{cur.available ? (((s?.available ?? 0) / cur.available) * 100).toFixed(1) + '%' : '—'}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="grid two section">
        <Card title="Available by account">
          <TimeLines data={rows} series={[{ key: 'available', label: 'Combined', color: SERIES[0] }, ...g.members.slice(0, 7).map((m, i) => ({ key: m, label: m, color: SERIES[i + 1], dashed: true }))]} />
        </Card>
        <Card title="Combined weekly gain"><WeeklyBars data={rows.slice(1)} barKey="gain" barLabel="Gain" fmt="usd" /></Card>
      </div>
      <div className="grid two section">
        <Card title="Week by week">
          <div className="table-wrap" style={{ maxHeight: 420 }}><table>
            <thead><tr><th>Week to</th><th className="num">Invested</th><th className="num">P&L</th><th className="num">Available</th><th className="num">Gain</th></tr></thead>
            <tbody>{[...hist].reverse().map((h) => <tr key={h.date}><td>{longDate(h.date)}</td><td className="num">{usd(h.invested)}</td><td className="num">{usd(h.pnl)}</td><td className="num">{usd(h.available)}</td><td className={`num ${toneOf(h.gain) ?? ''}`}>{signedUsd(h.gain)}</td></tr>)}</tbody>
          </table></div>
        </Card>
        <Card title="Deposits & withdrawals">
          {!flows.length ? <p className="muted">None recorded.</p> : (
            <table><thead><tr><th>Date</th><th>Account</th><th>Type</th><th className="num">Amount</th></tr></thead>
              <tbody>{[...flows].reverse().map((f, i) => <tr key={i}><td>{f.date}</td><td>{f.investor}</td><td>{f.type}{f.inferred ? <span className="muted small"> (inferred)</span> : ''}</td><td className={`num ${toneOf(f.amount)}`}>{signedUsd(f.amount)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </div>
  );
}
