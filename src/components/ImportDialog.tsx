import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { detectAndParse, diffReports } from '../lib/importer';
import type { ReportDiff } from '../lib/importer';
import type { Backup, WeekReport } from '../lib/types';
import { longDate } from './charts';

interface Conflict { incoming: WeekReport; diff: ReportDiff; overwrite: boolean }

export function ImportDialog({ files, onClose }: { files?: File[]; onClose: () => void }) {
  const app = useApp();
  const [paste, setPaste] = useState('');
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fresh, setFresh] = useState<WeekReport[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [backup, setBackup] = useState<{ b: Backup; label: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const handled = useRef<File[] | undefined>(undefined);

  const existing = new Map(app.reports.map((r) => [r.date, r]));

  async function ingest(items: { text: string; name: string }[]) {
    const errs: string[] = [];
    const incoming: WeekReport[] = [];
    for (const it of items) {
      try {
        const d = detectAndParse(it.text, it.name);
        if (d.kind === 'backup') setBackup({ b: d.backup, label: d.label });
        else incoming.push(...d.reports);
      } catch (e) {
        errs.push(`${it.name}: ${(e as Error).message}`);
      }
    }
    // If the same date appears twice in this batch, the last one wins (a .txt report beats CSV rows).
    const byDate = new Map<string, WeekReport>();
    for (const r of incoming) {
      const prev = byDate.get(r.date);
      if (!prev || r.source === 'report' || prev.source === 'csv') byDate.set(r.date, r);
    }
    const nf: WeekReport[] = [], nc: Conflict[] = [];
    for (const r of byDate.values()) {
      const ex = existing.get(r.date);
      if (!ex) nf.push(r);
      else nc.push({ incoming: r, diff: diffReports(ex, r), overwrite: false });
    }
    setErrors(errs);
    setFresh(nf);
    setConflicts(nc.sort((a, b) => a.incoming.date.localeCompare(b.incoming.date)));
    setDone(null);
  }

  async function readFiles(fs: File[]) {
    await ingest(await Promise.all(fs.map(async (f) => ({ text: await f.text(), name: f.name }))));
  }

  useEffect(() => {
    if (files?.length && handled.current !== files) { handled.current = files; readFiles(files); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  async function apply() {
    const chosen = [...fresh, ...conflicts.filter((c) => c.overwrite).map((c) => c.incoming)];
    if (chosen.length) await app.saveReports(chosen);
    const kept = conflicts.filter((c) => !c.overwrite).length;
    setDone(`Imported ${chosen.length} week${chosen.length === 1 ? '' : 's'}${kept ? `, kept ${kept} existing week${kept === 1 ? '' : 's'} unchanged` : ''}.`);
    setFresh([]); setConflicts([]); setPaste('');
  }

  async function applyBackup(mode: 'replace' | 'merge') {
    if (!backup) return;
    if (mode === 'replace') await app.replaceAll(backup.b.reports, backup.b.settings);
    else await app.saveReports(backup.b.reports);
    setDone(`Backup ${mode === 'replace' ? 'restored' : 'merged'}: ${backup.b.reports.length} weeks.`);
    setBackup(null);
  }

  const setAll = (v: boolean) => setConflicts((cs) => cs.map((c) => ({ ...c, overwrite: v })));
  const pending = fresh.length + conflicts.length > 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Import a report</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted small">Drop a weekly <b>.txt</b> report, the history <b>.csv</b>, or a <b>backup .json</b>. Nothing leaves this computer.</p>

        <div className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); readFiles([...e.dataTransfer.files]); }}>
          <div>Drag files here</div>
          <div className="muted small" style={{ margin: '6px 0' }}>or</div>
          <button onClick={() => picker.current?.click()}>Choose files…</button>
          <input ref={picker} type="file" multiple accept=".txt,.csv,.json,text/plain" hidden
            onChange={(e) => { if (e.target.files) readFiles([...e.target.files]); e.target.value = ''; }} />
        </div>

        <div className="section">
          <label className="field">Or paste the report text
            <textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="PnL — Group: Subron Group — 2026-11-15&#10;━━ Osama ━━&#10;…" />
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button disabled={!paste.trim()} onClick={() => ingest([{ text: paste, name: 'Pasted text' }])}>Read pasted text</button>
          </div>
        </div>

        {errors.length > 0 && <div className="section notice" style={{ color: '#ff9a9a', borderColor: 'rgba(208,59,59,0.5)', background: 'rgba(208,59,59,0.08)' }}>{errors.map((e) => <div key={e}>{e}</div>)}</div>}
        {done && <div className="section notice" style={{ color: '#9be09b', borderColor: 'rgba(12,163,12,0.5)', background: 'rgba(12,163,12,0.08)' }}>{done}</div>}

        {backup && (
          <div className="section card">
            <h3>Backup file: {backup.label}</h3>
            <p className="small">{backup.b.reports.length} weeks, exported {backup.b.exportedAt.slice(0, 10)}. You have {app.reports.length} weeks now.</p>
            <div className="row">
              <button className="primary" onClick={() => applyBackup('replace')}>Replace everything with this backup</button>
              <button onClick={() => applyBackup('merge')}>Merge (backup wins on same dates)</button>
              <button onClick={() => setBackup(null)}>Cancel</button>
            </div>
          </div>
        )}

        {pending && (
          <div className="section">
            {fresh.length > 0 && <p><b>{fresh.length}</b> new week{fresh.length === 1 ? '' : 's'} ready: {fresh.map((r) => r.date).sort().join(', ')}</p>}
            {conflicts.length > 0 && (
              <div className="grid" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>{conflicts.length} week{conflicts.length === 1 ? '' : 's'} already exist. Choose what to do:</b>
                  <div className="row"><button onClick={() => setAll(true)}>Overwrite all</button><button onClick={() => setAll(false)}>Keep all existing</button></div>
                </div>
                {conflicts.map((c, i) => <ConflictRow key={c.incoming.date} c={c} onToggle={(v) => setConflicts((cs) => cs.map((x, j) => (j === i ? { ...x, overwrite: v } : x)))} />)}
              </div>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" onClick={apply}>Import</button>
              <button onClick={() => { setFresh([]); setConflicts([]); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictRow({ c, onToggle }: { c: Conflict; onToggle: (v: boolean) => void }) {
  const d = c.diff;
  const summary = d.identical
    ? 'Same figures as what you have'
    : [d.changed.length && `${d.changed.length} figure(s) differ`, d.added.length && `${d.added.length} investor(s) added`, d.removed.length && `${d.removed.length} removed`, d.ledgerAfter !== d.ledgerBefore && `ledger ${d.ledgerBefore} → ${d.ledgerAfter} entries`].filter(Boolean).join(' · ');
  return (
    <details className={`check ${d.identical ? 'info' : 'warn'}`} open={!d.identical}>
      <summary>
        <b>{longDate(d.date)}</b>
        <span className="muted small">{d.sourceBefore === 'csv' ? 'from CSV' : 'from report'} → {d.sourceAfter === 'csv' ? 'CSV' : 'report'}</span>
        <span className="small" style={{ marginLeft: 'auto' }}>{summary}</span>
      </summary>
      <div style={{ marginTop: 8 }}>
        {d.added.length > 0 && <div className="small">Added: {d.added.join(', ')}</div>}
        {d.removed.length > 0 && <div className="small">Missing from the new file: {d.removed.join(', ')}</div>}
        {d.changed.length > 0 && (
          <div className="table-wrap"><table>
            <thead><tr><th>Investor</th><th>Field</th><th className="num">Existing</th><th className="num">New</th></tr></thead>
            <tbody>{d.changed.map((x, i) => <tr key={i}><td>{x.investor}</td><td>{x.field}</td><td className="num">{x.before}</td><td className="num">{x.after}</td></tr>)}</tbody>
          </table></div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <label className="row small"><input type="radio" checked={!c.overwrite} onChange={() => onToggle(false)} /> Keep existing</label>
          <label className="row small"><input type="radio" checked={c.overwrite} onChange={() => onToggle(true)} /> Overwrite with new</label>
        </div>
      </div>
    </details>
  );
}
