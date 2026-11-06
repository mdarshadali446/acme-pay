# ACME Pay — design notes

## Shape

```
React UI (Vite)  --cookie-->  Express JSON API  -->  salary rules (plain functions)
                                      |
                                      v
                               SQLite file (data/acme.db)
```

The UI and the API are separate processes in development (Vite on 5173 proxies `/api` to 3001) and one process in production (Express serves the built UI). Salary rules don't import the database, and the database doesn't know about HTTP. That split is what makes the tests fast: most of them never open a socket.

I used Node's built-in `node:sqlite` rather than a native addon. Node 22 is the runtime anyway, and a native module is one more thing to break on a reviewer's Windows machine. The module is still marked experimental by Node. The npm scripts disable that warning. If it disappeared in a later Node, the replacement is a small edit in `src/db/database.ts`.

I didn't pull in a component kit. The screens are a directory, a form, and some tables. A kit's default spacing fights that. Shared bits (buttons, fields, table, pills) live in the stylesheet and a few components.

## Schema

`employees` is the person. `salary_records` is append-only except for the one open row. `salary_bands` is the local range for a country and level.

An open row has `end_date IS NULL`. A partial unique index makes a second open row a database error, not just an application hope. Terminated employees have no open row. Their last row ends on `termination_date`. Payroll queries look at open rows joined to active or leave. The directory looks at the latest row, so a terminated person still shows a last salary.

Amounts are `annual_minor INTEGER`. No floats in the schema. The 20,000,000 major-unit cap is a sanity check against a bad paste, not a compensation policy.

Bands are generated from one table of midpoints in `src/reference.ts` (min = 80% of mid, max = 125% of mid) and inserted by the seed. The UI does not hard-code a second copy.

## Changing pay

`decideSalaryChange` is the rule. The route parses JSON, `parseMoneyInput` turns the text field into minor units, then the decision says either:

- `append`: set the open row's `end_date` to the day before the new effective date, insert the new open row
- `replace`: the effective date equals the open row, so update that row in place

Both happen in one transaction. The UI calls the same function before submitting, and the API calls it again. The client check is only there so the form can fail fast.

Rules, in the order they fail:

1. Terminated people are frozen.
2. Amount is a positive integer of minor units, at most 20,000,000.00.
3. Effective date is a real calendar date, on or after hire, not more than 90 days ahead, and not before the open row started.
4. A promotion cannot be lower than the current amount.
5. Any reduction needs a note of at least 8 characters.
6. Notes cap at 500 characters.

Out-of-band amounts are saved. The directory then shows them as below or above.

## How the questions are computed

One query loads the paid population (active + leave, open salary, with the band). At 10,000 employees that is about 9,300 small rows, which is nothing. Medians are computed in `src/domain/stats.ts`, not in SQL, so the definition is a ten-line function with a test.

Even-sized groups: average of the two middle values, rounded half up to a minor unit. We don't display half a cent.

Gender comparison key is country + level + currency. Undisclosed is stored and ignored in the comparison. A cell is shown only when women and men each have at least 20 people. The page says the 5% highlight is a prompt to look, not a conclusion.

## Search and pages

Directory filters are query parameters, so a filtered link can be pasted to someone. Search is `LIKE '%term%'` with `%`, `_`, and `\` escaped. A leading wildcard will not use an index. At 10,000 rows that is fine. I would add FTS5 before this pattern was pointed at a few hundred thousand.

Page size defaults to 25 and caps at 100. The CSV endpoint uses the same filters and ignores paging. It puts a UTF-8 BOM at the front because Excel otherwise misreads the file.

## Sessions

The password is compared with scrypt so a short guess and a long guess take similar time. A random token is stored in a `Map` on the process and sent as an HttpOnly, SameSite=Lax cookie. Restarting the process logs everyone out. That's acceptable for one HR user on one box, and it's the thing I would replace first if this were deployed for a real team (sticky sessions or a session table).

The demo password `pay-ledger` is shown on the login screen only while that is still the configured password. Setting `HR_PASSWORD` removes the hint. Production refuses to boot if `HR_PASSWORD` is missing... except the Docker image sets it, on purpose, so the image actually starts. Change it before anyone else can reach the port.

## Tests

- Pure tests for dates, money parsing, the pay-change decision, medians, gender suppression, CSV escaping.
- SQLite tests, in memory, for the open-row constraint, paging, and a pay change that closes the old row.
- HTTP tests through the Express app for login, the gender field not leaking onto a person, a rejected promotion cut, and a CSV.

The 10,000-person build is covered by the generator (pure, so it's quick) and by `npm run seed` against the file. The HTTP tests use a few dozen people so they stay obviously fast.

## What I would do next if this were staying in production

A salary_record table is the right core. Next real pieces, in order: a session store, an import with a dry run, then level changes as their own fact (a band is meaningless if level history doesn't exist). I would not add currency conversion until finance writes down which rate and which day.
