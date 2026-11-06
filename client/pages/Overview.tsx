import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@shared/domain/money'
import type { SummaryResponse } from '@shared/domain/types'
import { ApiError, api } from '../api'

export function OverviewPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<SummaryResponse>('/api/summary')
      .then(setSummary)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the overview.'))
  }, [])

  if (error) return <p className="banner">{error}</p>
  if (!summary) return <p className="muted">Adding up payroll…</p>

  const paid = summary.headcount.active + summary.headcount.leave

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">As of {summary.today}</p>
          <h1>How ACME pays people</h1>
          <p className="lede">
            Base pay for people we are still paying. Terminated staff stay in the directory and are left out of these
            totals. Each currency is its own total — nothing here is converted.
          </p>
        </div>
      </header>

      <section className="stats">
        <article>
          <span>On payroll</span>
          <strong>{paid.toLocaleString('en-US')}</strong>
          <em>
            {summary.headcount.active.toLocaleString('en-US')} active · {summary.headcount.leave.toLocaleString('en-US')}{' '}
            on leave
          </em>
        </article>
        <article>
          <span>Terminated</span>
          <strong>{summary.headcount.terminated.toLocaleString('en-US')}</strong>
          <em>History only</em>
        </article>
        <article>
          <span>Below band</span>
          <strong>{summary.outsideBand.below.toLocaleString('en-US')}</strong>
          <em>
            <Link to="/employees?band=below&status=paid">Open the list</Link>
          </em>
        </article>
        <article>
          <span>Above band</span>
          <strong>{summary.outsideBand.above.toLocaleString('en-US')}</strong>
          <em>
            <Link to="/employees?band=above&status=paid">Open the list</Link>
          </em>
        </article>
      </section>

      <section className="panel">
        <h2>Payroll by currency</h2>
        <div className="currency-grid">
          {summary.byCurrency.map((row) => (
            <article key={row.currency}>
              <span>{row.currency}</span>
              <strong>{formatMoney(row.payrollMinor, row.currency)}</strong>
              <em>
                {row.people.toLocaleString('en-US')} people · median {formatMoney(row.medianMinor, row.currency)}
              </em>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>By country</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Active</th>
                <th>Leave</th>
                <th>Terminated</th>
                <th>Payroll</th>
                <th>Median</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCountry.map((row) => (
                <tr key={row.countryCode}>
                  <td>
                    {row.countryName} <span className="muted">{row.currency}</span>
                  </td>
                  <td className="num">{row.active.toLocaleString('en-US')}</td>
                  <td className="num">{row.leave.toLocaleString('en-US')}</td>
                  <td className="num">{row.terminated.toLocaleString('en-US')}</td>
                  <td className="num">{formatMoney(row.payrollMinor, row.currency)}</td>
                  <td className="num">{row.payrollMinor ? formatMoney(row.medianMinor, row.currency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
