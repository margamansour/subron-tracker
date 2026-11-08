import type { WeekChecks } from '../lib/checks';
import { LevelBadge } from './ui';
import { longDate } from './charts';

const ICON = { ok: '✓', warn: '!', fail: '✕', info: 'i' } as const;

export function ChecksPanel({ wc, compact = false }: { wc: WeekChecks; compact?: boolean }) {
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Checks: week to {longDate(wc.date)}</h2>
        <LevelBadge level={wc.level} text={wc.level === 'ok' ? 'All good' : wc.level === 'warn' ? 'Needs a look' : wc.level === 'fail' ? 'Problems found' : 'Info'} />
      </div>
      {wc.anomalyNote && <div className="notice">Known historic anomaly: {wc.anomalyNote}</div>}
      {wc.checks.map((c) => (
        <details key={c.id} className={`check ${c.level}`} open={!compact && (c.level === 'fail' || c.level === 'warn')}>
          <summary>
            <LevelBadge level={c.level} />
            <span style={{ fontWeight: 600 }}>{c.id}. {c.title}</span>
            <span className="muted small" style={{ marginLeft: 'auto', textAlign: 'right' }}>{c.summary}</span>
          </summary>
          {c.items.length > 0 && (
            <ul>
              {c.items.map((it, i) => (
                <li key={i}><span className={`badge ${it.level}`} style={{ padding: '0 6px', marginRight: 6 }}>{ICON[it.level]}</span>{it.text}</li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </div>
  );
}
