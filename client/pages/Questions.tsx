import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@shared/domain/money'
import type { QuestionsResponse } from '@shared/domain/types'
import { ApiError, api } from '../api'

export function QuestionsPage() {
  const [data, setData] = useState<QuestionsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<QuestionsResponse>('/api/questions')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not answer these yet.'))
  }, [])

  if (error) return <p className="banner">{error}</p>
  if (!data) return <p className="muted">Working through the paid population…</p>

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Questions</p>
          <h1>What the numbers can support</h1>
          <p className="lede">
            All three use current base pay for active staff and people on leave. They do not use terminated salaries.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2>Who is outside their band?</h2>
        <p className="fine">
          {data.outsideBand.below.toLocaleString('en-US')} below, {data.outsideBand.above.toLocaleString('en-US')} above,{' '}
          {data.outsideBand.within.toLocaleString('en-US')} inside. The eight furthest from the range are listed. This is
          a work queue, not a verdict.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Where</th>
                <th>Level</th>
                <th>Pay</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {data.outliers.length === 0 ? (
                <tr>
                  <td colSpan={5}>Everyone on payroll is inside their band.</td>
                </tr>
              ) : (
                data.outliers.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/employees/${row.id}`}>
                        {row.fullName}
                      </Link>
                      <div className="who-meta">{row.employeeCode}</div>
                    </td>
                    <td>
                      {row.countryName}
                      <div className="who-meta">{row.department}</div>
                    </td>
                    <td>{row.jobLevel}</td>
                    <td className="num">{formatMoney(row.annualMinor, row.currency)}</td>
                    <td>
                      <span className={`pill band-${row.bandPosition}`}>{row.bandPosition}</span>{' '}
                      <span className="num">{formatMoney(row.gapMinor, row.currency)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Median base by level</h2>
        <p className="fine">Low and high are the actual salaries in that cell, not the band.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Currency</th>
                <th>Level</th>
                <th>People</th>
                <th>Median</th>
                <th>Low</th>
                <th>High</th>
              </tr>
            </thead>
            <tbody>
              {data.byLevel.map((row) => (
                <tr key={`${row.currency}-${row.level}`}>
                  <td>{row.currency}</td>
                  <td>{row.level}</td>
                  <td className="num">{row.people.toLocaleString('en-US')}</td>
                  <td className="num">{formatMoney(row.medianMinor, row.currency)}</td>
                  <td className="num">{formatMoney(row.lowMinor, row.currency)}</td>
                  <td className="num">{formatMoney(row.highMinor, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Pay by gender, inside a real peer group</h2>
        <p className="fine">
          Compared only when women and men each have at least {data.gender.minCell} people in the same country, level,
          and currency. {data.gender.suppressed.toLocaleString('en-US')} smaller cells are hidden. Undisclosed is not
          folded into either side. A gap of 5% or more is highlighted as a prompt to look, not a finding.
        </p>
        {data.gender.rows.length === 0 ? (
          <p className="empty">No peer group is large enough to show.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Level</th>
                  <th>Women</th>
                  <th>Men</th>
                  <th>Median women</th>
                  <th>Median men</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.gender.rows.map((row) => {
                  const pct = row.gapRatio * 100
                  const tone = pct <= -5 ? 'gap-low' : pct >= 5 ? 'gap-high' : ''
                  return (
                    <tr key={`${row.countryCode}-${row.jobLevel}-${row.currency}`}>
                      <td>
                        {row.countryName} <span className="muted">{row.currency}</span>
                      </td>
                      <td>{row.jobLevel}</td>
                      <td className="num">{row.women}</td>
                      <td className="num">{row.men}</td>
                      <td className="num">{formatMoney(row.womenMedianMinor, row.currency)}</td>
                      <td className="num">{formatMoney(row.menMedianMinor, row.currency)}</td>
                      <td className={`num ${tone}`}>
                        {pct > 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
