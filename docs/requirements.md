# ACME Pay — requirements

One HR manager at ACME currently keeps base salary for about 10,000 employees in spreadsheets, across several countries. This version replaces that spreadsheet as the place base pay is stored, and answers a few questions about how the org pays people. It is a tool for that HR manager, not a payroll engine.

## Goal

Find a person, see what we pay them and what we paid them before, change base pay without losing the old row, and see payroll in each local currency. Totals are never converted into one "global" number. A converted total looks tidy and is wrong often enough that I don't want it on the page.

## In this version

- A single shared password so the directory isn't an open page. This is a lock for the demo, not SSO and not per-person accounts.
- Directory of employees. Search by name, email, or employee code. Filter by country, department, level, status, and whether latest base pay sits inside the local band. 25 rows at a time. Default view is people still on payroll (active and on leave).
- Employee page with current base pay, compa-ratio against the band midpoint, the band range, and every previous base-pay row.
- Change base pay. The previous row is closed. Reasons are adjustment, promotion, and correction. A promotion cannot reduce pay. Any reduction needs a short note. Same effective date updates the open row instead of creating an empty period. Terminated people stay in the directory for history and cannot be changed.
- Saving outside the band is allowed. The band is a flag, not a hard stop. HR sometimes has a reason.
- Overview: headcount, who is outside band, and payroll plus median by currency and by country. Terminated staff are not in the payroll totals. People on leave are, because we are still paying them.
- Three questions:
  1. Who is paid outside their local band, most-off first, so there is a list to work.
  2. Median base by level, inside each currency.
  3. Women's and men's median base, only inside the same country, level, and currency, and only when both sides have at least 20 people. Smaller cells are counted and hidden.
- CSV of whatever the directory filters currently show, so a number can still leave the app for a board pack. UTF-8 with a BOM because Excel is the tool this is replacing.
- A seed script that builds 10,000 employees, local bands, and a bit of salary history. Same seed, same data.

Money is stored as an integer in minor units (cents, paise, fils). The currencies in this dataset all use 2 decimal places. Each country has one payroll currency. Bands are local HR bands per country and level, not the US band run through an exchange rate.

Gender is stored so the third question can be answered. It is not shown on a person's page. A single company-wide gender percentage is intentionally not in the product: mix of country and level would dominate it.

## Left out on purpose

- Tax, bonus, benefits, equity. "What do we pay" gets muddy the moment those are mixed into the same total. This version is base salary only.
- Exchange rates. Eight honest totals are more useful to HR than one blended USD figure nobody can tie back to a contract.
- Approval chains, manager proposals, offer letters. The user is one HR manager who already owns the number.
- Employee self-service, and editing name, department, level, or country. A salary change shouldn't be the same form as a transfer. If the level is wrong, the band flag will be wrong with it; fixing master data is a separate job.
- Excel import. The seed stands in for the first load. A real import needs column mapping and a dry run.
- SSO, roles, and an audit log beyond salary history. The history of the amount is the part people come back to ask about. Login sessions live in memory on one Node process.
- Rewriting a salary row that is already closed. Corrections are on the open row, or a new row dated today. I don't want silent edits to last year's number.

## Done when

HR can answer "what does this person earn, what did they earn before, and how does this country and level pay" on 10,000 people, without a spreadsheet, and the pay-change rules above are covered by tests that don't need the UI.
