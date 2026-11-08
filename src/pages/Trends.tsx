import { useState } from 'react';
import { useApp } from '../state';
import { Card } from '../components/ui';
import { TimeLines, SERIES } from '../components/charts';
import type { PageProps } from '../App';

const MAX = SERIES.length;

export function Trends(_: PageProps) {
  const { ds, settings } = useApp();
  // Each selected investor keeps the colour it was given until it is switched off (colour follows the person).
  const [picked, setPicked] = useState<{ name: string; slot: number }[]>(() => {
    const latest = ds.latest!.investors.filter((x) => x.available > 0).sort((a, b) => b.available - a.available).map((x) => x.name);
    const first = [settings.me, ...latest.filter((n) => n !== settings.me)].filter((n) => ds.investors.includes(n)).slice(0, 4);
    return first.map((name, slot) => ({ name, slot }));
  });
  const [metric, setMetric] = useState<'available' | 'pnl' | 'invested'>('available');

  function toggle(name: string) {
    setPicked((p) => {
      if (p.some((x) => x.name === name)) return p.filter((x) => x.name !== name);
      if (p.length >= MAX) return p;
      const used = new Set(p.map((x) => x.slot));
      const slot = [...Array(MAX).keys()].find((s) => !used.has(s))!;
      return [...p, { name, slot }];
    });
  }

  const data = ds.reports.map((r) => {
    const row: Record<string, number | string | null> = { date: r.date };
    for (const { name } of picked) { const s = r.investors.find((x) => x.name === name); row[name] = s ? s[metric] : null; }
    return row;
  });

  return (
    <div>
      <div className="page-head">
        <div><h1>Trends</h1><div className="muted">Compare investors over time (up to {MAX} at once)</div></div>
        <div className="row">
          {(['available', 'pnl', 'invested'] as const).map((m) => <button key={m} className={metric === m ? 'primary' : ''} onClick={() => setMetric(m)}>{m === 'pnl' ? 'P&L' : m[0].toUpperCase() + m.slice(1)}</button>)}
        </div>
      </div>
      <Card>
        <div className="toggle-row" style={{ marginBottom: 10 }}>
          {ds.investors.map((n) => {
            const p = picked.find((x) => x.name === n);
            return (
              <button key={n} className={`chip ${p ? 'on' : 'off'}`} onClick={() => toggle(n)} disabled={!p && picked.length >= MAX} title={!p && picked.length >= MAX ? `Up to ${MAX} at once` : ''}>
                <span className="dot" style={{ background: p ? SERIES[p.slot] : 'transparent', border: p ? 'none' : '1px solid #6b6a65' }} />{n}
              </button>
            );
          })}
        </div>
        <TimeLines data={data} height={380} series={picked.map((p) => ({ key: p.name, label: p.name, color: SERIES[p.slot] }))} />
      </Card>
    </div>
  );
}
