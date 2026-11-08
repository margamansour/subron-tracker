import { useEffect, useRef, useState } from 'react';
import { useApp } from './state';
import { ImportDialog } from './components/ImportDialog';
import { makeBackup } from './lib/storage';
import { Overview } from './pages/Overview';
import { MyAccount } from './pages/MyAccount';
import { Groups } from './pages/Groups';
import { Investors } from './pages/Investors';
import { Trends } from './pages/Trends';
import { Rates } from './pages/Rates';
import { Projections } from './pages/Projections';
import { Ledger } from './pages/Ledger';
import { DataPage } from './pages/DataPage';

const PAGES = [
  { id: 'overview', label: 'Overview', C: Overview },
  { id: 'me', label: 'My Account', C: MyAccount },
  { id: 'groups', label: 'Account Groups', C: Groups },
  { id: 'investors', label: 'Investors', C: Investors },
  { id: 'trends', label: 'Trends', C: Trends },
  { id: 'rates', label: 'Rates & Anomalies', C: Rates },
  { id: 'projections', label: 'Projections', C: Projections },
  { id: 'ledger', label: 'Ledger', C: Ledger },
  { id: 'data', label: 'Data & Settings', C: DataPage },
];

function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'overview';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const app = useApp();
  const route = useHashRoute();
  const [base, ...rest] = route.split('/');
  const page = PAGES.find((p) => p.id === base) ?? PAGES[0];
  const [importOpen, setImportOpen] = useState(false);
  const [dropped, setDropped] = useState<File[] | undefined>();
  const backupPicker = useRef<HTMLInputElement>(null);

  // Dropping a file anywhere on the page opens the import dialog with it.
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setDropped([...e.dataTransfer.files]);
      setImportOpen(true);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, []);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(makeBackup(app.reports, app.settings), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `subron-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const nav = (
    <nav className="nav">
      {PAGES.map((p) => <a key={p.id} href={`#/${p.id}`} className={p.id === page.id ? 'active' : ''}>{p.label}</a>)}
    </nav>
  );
  const actions = (
    <>
      <button className="primary" onClick={() => { setDropped(undefined); setImportOpen(true); }}>＋ Import report</button>
      <button onClick={exportBackup} disabled={!app.reports.length}>Export backup</button>
      <button onClick={() => backupPicker.current?.click()}>Import backup</button>
      <input ref={backupPicker} type="file" accept=".json,application/json" hidden
        onChange={(e) => { if (e.target.files?.length) { setDropped([...e.target.files]); setImportOpen(true); } e.target.value = ''; }} />
    </>
  );

  const Page = page.C;
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Subron Tracker<span>Private · stored on this device</span></div>
        {nav}
        <div className="actions">{actions}</div>
      </aside>
      <header className="topbar">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>Subron Tracker</b>
          <button className="primary" onClick={() => { setDropped(undefined); setImportOpen(true); }}>＋ Import</button>
        </div>
        {nav}
      </header>
      <main className="main">
        {!app.ready ? <p className="muted">Loading…</p> : (
          <>
            {app.storageKind === 'memory' && (
              <div className="notice" style={{ marginBottom: 12 }}>This browser is blocking local storage, so data will be lost when you close the tab. Use <b>Export backup</b> before closing, or open the app in Chrome or Edge.</div>
            )}
            {!app.reports.length && page.id !== 'data' ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <h1>Welcome</h1>
                <p className="muted">No data yet. Import your history CSV and weekly reports to get started.</p>
                <button className="primary" onClick={() => setImportOpen(true)}>Import files</button>
              </div>
            ) : <Page sub={rest.join('/')} openImport={() => setImportOpen(true)} />}
            <div className="row" style={{ marginTop: 24 }}>
              <span className="small muted">Mobile: backups are under “Data &amp; Settings”.</span>
            </div>
          </>
        )}
      </main>
      {importOpen && <ImportDialog files={dropped} onClose={() => { setImportOpen(false); setDropped(undefined); }} />}
    </div>
  );
}

export interface PageProps { sub: string; openImport: () => void }
