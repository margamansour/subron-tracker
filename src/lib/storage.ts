import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Backup, Settings, WeekReport } from './types';

export const DEFAULT_SETTINGS: Settings = {
  me: 'Osama',
  accountGroups: [{ name: 'Subron', members: ['Subron', 'Subron2'] }],
};

/**
 * Everything is saved in the browser on this computer (IndexedDB). If the browser blocks IndexedDB
 * (some browsers do for files opened by double-click), we fall back to localStorage.
 */
interface Store {
  kind: 'indexeddb' | 'localstorage' | 'memory';
  getReports(): Promise<WeekReport[]>;
  putReports(rs: WeekReport[]): Promise<void>;
  deleteReport(date: string): Promise<void>;
  clear(): Promise<void>;
  getSettings(): Promise<Settings>;
  putSettings(s: Settings): Promise<void>;
}

async function idbStore(): Promise<Store> {
  const db: IDBPDatabase = await openDB('subron-tracker', 1, {
    upgrade(db) {
      db.createObjectStore('reports', { keyPath: 'date' });
      db.createObjectStore('settings');
    },
  });
  return {
    kind: 'indexeddb',
    getReports: () => db.getAll('reports'),
    async putReports(rs) { const tx = db.transaction('reports', 'readwrite'); await Promise.all([...rs.map((r) => tx.store.put(r)), tx.done]); },
    deleteReport: (d) => db.delete('reports', d),
    async clear() { await db.clear('reports'); },
    async getSettings() { return { ...DEFAULT_SETTINGS, ...((await db.get('settings', 'settings')) ?? {}) }; },
    async putSettings(s) { await db.put('settings', s, 'settings'); },
  };
}

function lsStore(): Store {
  const K = 'subron-tracker:';
  const read = (): Record<string, WeekReport> => JSON.parse(localStorage.getItem(K + 'reports') ?? '{}');
  const write = (m: Record<string, WeekReport>) => localStorage.setItem(K + 'reports', JSON.stringify(m));
  localStorage.setItem(K + 'probe', '1');
  return {
    kind: 'localstorage',
    async getReports() { return Object.values(read()); },
    async putReports(rs) { const m = read(); rs.forEach((r) => (m[r.date] = r)); write(m); },
    async deleteReport(d) { const m = read(); delete m[d]; write(m); },
    async clear() { write({}); },
    async getSettings() { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(K + 'settings') ?? '{}') }; },
    async putSettings(s) { localStorage.setItem(K + 'settings', JSON.stringify(s)); },
  };
}

function memStore(): Store {
  let m: Record<string, WeekReport> = {};
  let s = DEFAULT_SETTINGS;
  return {
    kind: 'memory',
    async getReports() { return Object.values(m); },
    async putReports(rs) { rs.forEach((r) => (m[r.date] = r)); },
    async deleteReport(d) { delete m[d]; },
    async clear() { m = {}; },
    async getSettings() { return s; },
    async putSettings(x) { s = x; },
  };
}

let storePromise: Promise<Store> | null = null;
export function getStore(): Promise<Store> {
  if (!storePromise) storePromise = (async () => {
    try { const s = await idbStore(); await s.getReports(); return s; } catch { /* fall through */ }
    try { return lsStore(); } catch { return memStore(); }
  })();
  return storePromise;
}

export function makeBackup(reports: WeekReport[], settings: Settings): Backup {
  return { app: 'subron-tracker', version: 1, exportedAt: new Date().toISOString(), reports, settings };
}

export function readBackup(text: string): Backup {
  const b = JSON.parse(text);
  if (b?.app !== 'subron-tracker' || !Array.isArray(b.reports)) throw new Error('This is not a Subron Tracker backup file.');
  return b as Backup;
}
