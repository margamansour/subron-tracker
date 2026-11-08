import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Level } from '../lib/checks';

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Card({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="card">
      {(title || right) && <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>{title && <h2 style={{ margin: 0 }}>{title}</h2>}{right}</div>}
      {children}
    </div>
  );
}

const LEVEL_TEXT: Record<Level, string> = { ok: 'OK', warn: 'Check', fail: 'Problem', info: 'Info' };
const LEVEL_ICON: Record<Level, string> = { ok: '✓', warn: '!', fail: '✕', info: 'i' };
export function LevelBadge({ level, text }: { level: Level; text?: string }) {
  return <span className={`badge ${level}`}><span aria-hidden>{LEVEL_ICON[level]}</span>{text ?? LEVEL_TEXT[level]}</span>;
}

export const toneOf = (n: number | null | undefined) => (n == null || n === 0 ? undefined : n > 0 ? 'pos' : 'neg');

export interface Column<T> {
  key: string;
  label: string;
  value: (row: T) => number | string | null;
  render?: (row: T) => ReactNode;
  num?: boolean;
}

export function SortableTable<T>({ rows, columns, initialSort, onRowClick, rowClass }: {
  rows: T[]; columns: Column<T>[]; initialSort?: { key: string; desc: boolean };
  onRowClick?: (r: T) => void; rowClass?: (r: T) => string;
}) {
  const [sort, setSort] = useState(initialSort ?? { key: columns[0].key, desc: false });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.value(a), y = col.value(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
  }, [rows, columns, sort]);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`sortable ${c.num ? 'num' : ''}`} onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : !!c.num }))}>
                {c.label}{sort.key === c.key ? (sort.desc ? ' ▾' : ' ▴') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className={`${onRowClick ? 'clickable' : ''} ${rowClass?.(r) ?? ''}`} onClick={() => onRowClick?.(r)}>
              {columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : (c.value(r) ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>{children}</div>;
}
