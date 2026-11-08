export interface AccountLine {
  account: string; // masked id or label, as shown in the report
  raw: string; // original text, kept so nothing is lost
  amounts: number[];
  placeholder: boolean; // all amounts are $0.00
}

export interface InvestorSnapshot {
  name: string;
  invested: number;
  pnl: number;
  available: number;
  roi: number | null; // percent, e.g. 27.4
  roiLabel?: string; // "N/A" | "EXITED" when roi is null
  xirr: number | null; // percent
  weeklyAvailChange: number | null;
  weeklyPnlChange: number | null;
  exited: boolean;
  accounts: AccountLine[];
}

export interface LedgerEntry {
  date: string; // YYYY-MM-DD
  investor: string;
  account: string;
  type: 'Deposit' | 'Withdraw';
  amount: number; // signed: deposits positive, withdrawals negative
}

export interface WeekReport {
  date: string; // YYYY-MM-DD report date
  source: 'report' | 'csv';
  investors: InvestorSnapshot[];
  ledger: LedgerEntry[]; // group ledger as printed in this report (empty for CSV weeks)
  importedAt: string;
  raw?: string;
}

export interface Settings {
  me: string;
  accountGroups: { name: string; members: string[] }[];
}

export interface Backup {
  app: 'subron-tracker';
  version: 1;
  exportedAt: string;
  reports: WeekReport[];
  settings: Settings;
}
