import { useApp } from '../state';
import { longDate } from '../components/charts';
import { LevelBadge } from '../components/ui';
import type { PageProps } from '../App';

export function DataPage({ openImport }: PageProps) {
  const app = useApp();
  const { ds } = app;
  async function del(date: string) {
    if (confirm(`Delete the week to ${longDate(date)}? You can re-import it later.`)) await app.deleteReport(date);
  }
  async function wipe() {
    if (confirm('Delete ALL data from this browser? Export a backup first if you want to keep it.')) await app.replaceAll([]);
  }
  return (
    <div>
      <div className="page-head">
        <div><h1>Data & Settings</h1><div className="muted">Stored only in this browser ({app.storageKind === 'indexeddb' ? 'IndexedDB' : app.storageKind}). Export a backup now and then.</div></div>
        <div className="row"><button className="primary" onClick={openImport}>＋ Import</button><button className="danger" onClick={wipe} disabled={!app.reports.length}>Delete all data</button></div>
      </div>
      <div className="card">
        <h2>Weeks on record ({ds.reports.length})</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Week to</th><th>Source</th><th className="num">Investors</th><th className="num">Ledger entries</th><th>Checks</th><th /></tr></thead>
          <tbody>{[...ds.reports].reverse().map((r, i) => {
            const wc = ds.checks[ds.reports.length - 1 - i];
            return (
              <tr key={r.date}>
                <td>{longDate(r.date)}</td><td>{r.source === 'report' ? 'Weekly report' : 'History CSV'}</td>
                <td className="num">{r.investors.length}</td><td className="num">{r.ledger.length || '—'}</td>
                <td><LevelBadge level={wc.level} /></td>
                <td style={{ textAlign: 'right' }}><button className="danger small" onClick={() => del(r.date)}>Delete</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
    </div>
  );
}
