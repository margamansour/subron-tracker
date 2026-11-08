# Subron Tracker

A private dashboard for your Subron Group P&L reports. You drop in each Sunday's report and it updates your charts, your own position, and a set of automatic checks that flag anything that doesn't add up.

**Your data never leaves your computer.** It is saved inside your web browser on this machine. There is no server and no account, and nothing is sent anywhere.

---

## The easy way: one file, no installation

You don't need to install anything for this.

1. Get the file **`Subron-Tracker.html`** (sent to you separately, or build it yourself; see the end of this README).
2. Put it somewhere permanent, e.g. your Documents folder.
3. **Double-click it.** It opens in your web browser. Chrome, Edge or Firefox work best.
4. Click **＋ Import report** and choose your files:
   - the history file `subron-group-pnl.csv` (do this once), then
   - each weekly `.txt` report.

   You can also drag files onto the window, or paste the report text into the box.

Bookmark the page. Always open the **same file in the same browser**, because your data is stored by that browser for that file. If you move the file or switch browsers, the app will start empty. Restore it with **Import backup** (below).

> **Safari note:** Safari sometimes refuses to save data for files opened by double-click. If you see a yellow warning saying data will be lost, use Chrome or Edge instead.

## Every Sunday

1. Save the report text as a `.txt` file, or just copy it.
2. Open the app and click **＋ Import report**.
3. Drop the file in, or paste the text and click **Read pasted text**, then click **Import**.
4. Look at the **Checks** panel on the Overview page:
   - ✓ green: fine
   - ! amber: worth a look (e.g. a known ongoing issue)
   - ✕ red: something doesn't add up
   - i grey: just information

If you import a week you already have, the app shows exactly which figures differ and asks whether to overwrite or keep the old version.

## Backups (please do this now and then)

- **Export backup** saves a `.json` file with everything: all weeks plus your settings. Keep it somewhere safe, such as an email to yourself or a cloud drive.
- **Import backup** loads that file back, e.g. on a new computer or a different browser. You can replace everything or merge.

On a phone-width screen, these buttons are on the **Data & Settings** page.

## What each screen shows

| Screen | What it's for |
|---|---|
| **Overview** | Group totals, group balance over time, the weekly true rate, and this week's checks. |
| **My Account** | Your cards, charts, best/worst weeks, and a week-by-week table. Change who "you" are at the top right. |
| **Account Groups** | Several accounts viewed together (e.g. *Subron* = Subron + Subron2). Create your own. |
| **Investors** | Everyone this week. Click a column to sort; click a row to see that person's history. |
| **Trends** | Compare up to 8 investors' balances on one chart. Click names to switch them on or off. |
| **Rates & Anomalies** | True rate history, highs/lows/volatility, Hans's ratio to the group, the checks for any week, and a log of every flagged issue. |
| **Projections** | "What if" calculator for your account. **Estimates only, not guarantees.** |
| **Ledger** | All deposits and withdrawals, filterable by investor. |
| **Data & Settings** | Every week you've imported (you can delete one), and the delete-everything button. |

## How the maths works

- Investors keep **45%** of gross profit; the reported P&L is that 45% share.
- **Gross base** = Invested + (P&L ÷ 0.45), using the previous week's figures. Deposits made during the week are added too, because they earn the whole week.
- **True weekly rate** = this week's P&L change ÷ gross base. In a normal week this is the same for every investor (to about 4 decimal places). The group rate is the **median** across investors.
- **Naive %** = weekly gain ÷ available balance. It differs between people only because of time in the fund, so it is *not* treated as a problem.

The six automatic checks:
1. Invested + P&L = Available for every investor.
2. The report's "weekly change" equals this week minus last week.
3. (Available change − P&L change) equals the deposits/withdrawals in the ledger.
4. Everyone's true rate is within 1% of the group rate. Anyone outside that is listed with their ratio to the group.
5. New investors, exits, deposits and withdrawals since last week.
6. The Hans streak: how many weeks in a row he has earned less than the group rate.

**About the history CSV:** the CSV has no ledger, so for those weeks the app works out deposits and withdrawals from changes in "Invested". These show as "(inferred)" in the Ledger. Once you import the weekly `.txt` reports, their real ledger is used instead.

---

## For a developer (or a curious doctor): running from source

You need [Node.js](https://nodejs.org) (the "LTS" version). Then, in a terminal, inside this folder:

```bash
npm install
```

```bash
npm run dev
```

This opens the app at http://localhost:5173. Data is stored per browser *and* per address, so the `npm run dev` version and the double-click file keep separate data. Use Export/Import backup to move between them.

Other commands:

```bash
npm test
```

runs the unit tests: the parser, the rate maths, and your acceptance figures. The acceptance tests read `data/subron-group-pnl.csv` and are skipped if it isn't there.

```bash
npm run build:single
```

builds the one-file version at `dist-single/Subron-Tracker.html`.

The `data/` folder is deliberately excluded from git (see `.gitignore`), so your real P&L files are never uploaded.
