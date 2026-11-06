# ACME Pay

Web desk for ACME's HR manager. It holds base salary for 10,000 employees across eight countries, keeps the history when pay changes, and answers a few questions about how the org pays people.

Payroll totals stay in the local currency. The app does not convert them.

What this version will and won't do is in [docs/requirements.md](docs/requirements.md). Why it's shaped this way is in [docs/design.md](docs/design.md).

## Run it

Node 22 or newer.

```bash
npm install
npm run seed
npm run dev
```

Open http://127.0.0.1:5173. The local password is `pay-ledger` until you set `HR_PASSWORD`. The API listens on port 3001 and Vite proxies `/api` to it.

`npm run seed` deletes `data/acme.db` and rebuilds it. Stop the server first on Windows, or the file stays locked. The script prints how long the load took and the headcount by country. Here that was about 4 seconds for 10,000 people, with 9,326 of them still on payroll. The snapshot date baked into the history is 6 Nov 2026. New changes you make in the UI use the machine's date.

```bash
npm test
npm run build
```

After `npm run build`, `npm start` serves the UI and the API together on port 3001. Production will not boot until `HR_PASSWORD` is set.

```powershell
$env:HR_PASSWORD = "pay-ledger"
npm start
```

## Demo script

A two-minute walkthrough, if you need to record one:

1. Sign in. On the overview, point at the currency cards and say these are not converted into dollars.
2. Open Directory, filter a country and "Below" band, and export the CSV.
3. Open one person. Show the band and the history. Save an adjustment dated today. Show the previous row closed.
4. Try a promotion with a lower amount and show the refusal.
5. Open Questions. Show a gender row only exists when both groups have at least 20 people in the same country, level, and currency.

## Docker

```bash
docker build -t acme-pay .
docker run --rm -p 3001:3001 acme-pay
```

The image seeds the database and sets `HR_PASSWORD=pay-ledger` so it actually starts. Change that password before the port is reachable by anyone else. Sessions live in memory on the one process.
