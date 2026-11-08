import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { HISTORY_NOTES } from '../lib/notes';
import { usd, usd0 } from '../lib/money';

export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const MUTED = '#898781', GRID = '#2c2c2a', AXIS = '#383835';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${MONTHS[+m - 1]} ${+d}`; };
export const longDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };

export type Fmt = 'usd' | 'pct' | 'pct4' | 'ratio';
const fmtVal = (v: number, f: Fmt) => (f === 'usd' ? usd(v) : f === 'ratio' ? `${v.toFixed(3)}×` : `${v.toFixed(f === 'pct4' ? 4 : 2)}%`);
const fmtTick = (v: number, f: Fmt) =>
  f === 'usd' ? (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : usd0(v)) : f === 'ratio' ? `${v.toFixed(2)}×` : `${v.toFixed(f === 'pct4' ? 2 : 0)}%`;

export interface Series { key: string; label: string; color: string; dashed?: boolean }

const axisProps = { stroke: AXIS, tick: { fill: MUTED, fontSize: 11 }, tickLine: false } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TipBox({ active, payload, label, fmt }: { active?: boolean; payload?: readonly any[]; label?: string | number; fmt: Fmt }) {
  if (!active || !payload?.length) return null;
  const note = HISTORY_NOTES.find((n) => n.date === label);
  return (
    <div className="chart-tip">
      <div className="t">Week to {longDate(String(label))}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="row" style={{ gap: 6 }}>
          <span className="swatch" style={{ background: p.color ?? p.fill }} />
          <span style={{ color: '#c3c2b7' }}>{p.name}</span>
          <b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtVal(p.value, fmt)}</b>
        </div>
      ))}
      {note && <div style={{ marginTop: 6, maxWidth: 260, color: '#f5d38a' }}>◆ {note.title}</div>}
    </div>
  );
}

/** Numbered markers for the history notes that fall inside this chart's date range. */
function notesIn(data: { date: string }[], show: boolean) {
  if (!show || !data.length) return [];
  const dates = new Set(data.map((d) => d.date));
  return HISTORY_NOTES.filter((n) => dates.has(n.date)).map((n) => ({ ...n, n: HISTORY_NOTES.indexOf(n) + 1 }));
}

function noteLines(notes: ReturnType<typeof notesIn>) {
  return notes.map((n) => (
    <ReferenceLine key={n.date} x={n.date} stroke={n.anomaly ? '#d03b3b' : '#6b6a65'} strokeDasharray="3 3"
      label={{ value: String(n.n), position: 'top', fill: n.anomaly ? '#ff6b6b' : MUTED, fontSize: 11 }} />
  ));
}

export function NotesLegend({ data, show = true }: { data: { date: string }[]; show?: boolean }) {
  const notes = notesIn(data, show);
  if (!notes.length) return null;
  return (
    <div className="small muted" style={{ marginTop: 6, display: 'grid', gap: 2 }}>
      {notes.map((n) => (
        <div key={n.date}><b style={{ color: n.anomaly ? '#ff6b6b' : '#c3c2b7' }}>{n.n}</b> {shortDate(n.date)}: {n.title}{n.anomaly ? ' (anomaly)' : ''}</div>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return <div className="legend">{series.map((s) => <span key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label}</span>)}</div>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function TimeLines({ data, series, fmt = 'usd', height = 260, notes = true, extra }: {
  data: Row[]; series: Series[]; fmt?: Fmt; height?: number; notes?: boolean; extra?: ReactNode;
}) {
  const ns = notesIn(data as { date: string }[], notes);
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={24} />
          <YAxis tickFormatter={(v) => fmtTick(v, fmt)} {...axisProps} axisLine={false} width={56} domain={['auto', 'auto']} />
          <Tooltip content={(p) => <TipBox {...(p as object)} fmt={fmt} />} cursor={{ stroke: '#6b6a65' }} />
          {noteLines(ns)}
          {extra}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} activeDot={{ r: 4, stroke: '#1a1a19', strokeWidth: 2 }}
              connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <Legend series={series} />
      <NotesLegend data={data as { date: string }[]} show={notes} />
    </div>
  );
}

/** Weekly bars (negative weeks in red) with an optional running-average line on the same axis. */
export function WeeklyBars({ data, barKey, barLabel, lineKey, lineLabel, fmt = 'pct4', height = 260, notes = true }: {
  data: Row[]; barKey: string; barLabel: string; lineKey?: string; lineLabel?: string; fmt?: Fmt; height?: number; notes?: boolean;
}) {
  const ns = notesIn(data as { date: string }[], notes);
  const series: Series[] = [
    { key: barKey, label: barLabel, color: SERIES[0] },
    ...(lineKey ? [{ key: lineKey, label: lineLabel ?? lineKey, color: SERIES[1] }] : []),
  ];
  const inner = [
    <CartesianGrid key="g" stroke={GRID} vertical={false} />,
    <XAxis key="x" dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={24} />,
    <YAxis key="y" tickFormatter={(v) => fmtTick(v, fmt)} {...axisProps} axisLine={false} width={56} />,
    <Tooltip key="t" content={(p) => <TipBox {...(p as object)} fmt={fmt} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />,
    <ReferenceLine key="z" y={0} stroke={AXIS} />,
    ...noteLines(ns),
    <Bar key="b" dataKey={barKey} name={barLabel} fill={SERIES[0]} radius={[4, 4, 0, 0]} isAnimationActive={false}>
      {data.map((d, i) => <Cell key={i} fill={d[barKey] < 0 ? '#e66767' : SERIES[0]} />)}
    </Bar>,
  ];
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        {lineKey ? (
          <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barCategoryGap={2}>
            {inner}
            <Line type="monotone" dataKey={lineKey} name={lineLabel} stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        ) : (
          <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barCategoryGap={2}>{inner}</BarChart>
        )}
      </ResponsiveContainer>
      <Legend series={series} />
      <NotesLegend data={data as { date: string }[]} show={notes} />
    </div>
  );
}
