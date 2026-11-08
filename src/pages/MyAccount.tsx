import { useApp } from '../state';
import { InvestorDetail } from './InvestorDetail';
import type { PageProps } from '../App';

export function MyAccount(_: PageProps) {
  const { ds, settings, saveSettings } = useApp();
  return (
    <div>
      <div className="page-head">
        <div><h1>My Account</h1><div className="muted">Your own position in the fund</div></div>
        <label className="field">I am
          <select value={settings.me} onChange={(e) => saveSettings({ ...settings, me: e.target.value })}>
            {!ds.investors.includes(settings.me) && <option value={settings.me}>{settings.me}</option>}
            {ds.investors.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <InvestorDetail name={settings.me} />
    </div>
  );
}
