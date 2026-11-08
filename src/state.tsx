import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Settings, WeekReport } from './lib/types';
import { buildDataset } from './lib/analysis';
import type { Dataset } from './lib/analysis';
import { DEFAULT_SETTINGS, getStore } from './lib/storage';

interface AppState {
  ready: boolean;
  storageKind: string;
  reports: WeekReport[];
  ds: Dataset;
  settings: Settings;
  saveReports(rs: WeekReport[]): Promise<void>;
  replaceAll(rs: WeekReport[], s?: Settings): Promise<void>;
  deleteReport(date: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageKind, setKind] = useState('');
  const [reports, setReports] = useState<WeekReport[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = useCallback(async () => {
    const st = await getStore();
    setKind(st.kind);
    setReports(await st.getReports());
    setSettings(await st.getSettings());
    setReady(true);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const ds = useMemo(() => buildDataset(reports), [reports]);

  const value: AppState = {
    ready, storageKind, reports, ds, settings,
    async saveReports(rs) { const st = await getStore(); await st.putReports(rs); await reload(); },
    async replaceAll(rs, s) { const st = await getStore(); await st.clear(); await st.putReports(rs); if (s) await st.putSettings(s); await reload(); },
    async deleteReport(d) { const st = await getStore(); await st.deleteReport(d); await reload(); },
    async saveSettings(s) { const st = await getStore(); await st.putSettings(s); setSettings(s); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
