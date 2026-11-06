import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatMoney } from '@shared/domain/money'
import type { EmployeeListResponse } from '@shared/domain/types'
import { ApiError, api } from '../api'
import { useMeta } from '../shell'

export function EmployeesPage() {
  const meta = useMeta()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [draft, setDraft] = useState(q)
  const [data, setData] = useState<EmployeeListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(q)
  }, [q])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft === q) return
      const next = new URLSearchParams(params)
      if (draft) next.set('q', draft)
      else next.delete('q')
      next.delete('page')
      setParams(next)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [draft, q, params, setParams])

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    const query = params.toString()
    api<EmployeeListResponse>(`/api/employees${query ? `?${query}` : ''}`, { signal: controller.signal })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err.message : 'Could not load the directory.')
      })
    return () => controller.abort()
  }, [params])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  function setPage(page: number) {
    const next = new URLSearchParams(params)
    if (page <= 1) next.delete('page')
    else next.set('page', String(page))
    setParams(next)
  }

  const exportParams = new URLSearchParams(params)
  exportParams.delete('page')
  exportParams.delete('pageSize')
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Employees</h1>
          <p className="lede">Latest base pay. The default list is people still on payroll.</p>
        </div>
        <a className="button secondary" href={`/api/employees.csv?${exportParams.toString()}`}>
          Export CSV
        </a>
      </header>

      <div className="filters">
        <label>
          Search
          <input
            value={draft}
            placeholder="Name, email, or code"
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <label>
          Country
          <select value={params.get('country') ?? ''} onChange={(event) => setFilter('country', event.target.value)}>
            <option value="">All</option>
            {meta.countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Department
          <select
            value={params.get('department') ?? ''}
            onChange={(event) => setFilter('department', event.target.value)}
          >
            <option value="">All</option>
            {meta.departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level
          <select value={params.get('level') ?? ''} onChange={(event) => setFilter('level', event.target.value)}>
            <option value="">All</option>
            {meta.levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={params.get('status') ?? 'paid'} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="paid">On payroll</option>
            <option value="active">Active</option>
            <option value="leave">Leave</option>
            <option value="terminated">Terminated</option>
            <option value="all">Everyone</option>
          </select>
        </label>
        <label>
          Band
          <select value={params.get('band') ?? ''} onChange={(event) => setFilter('band', event.target.value)}>
            <option value="">Any</option>
            <option value="below">Below</option>
            <option value="within">Within</option>
            <option value="above">Above</option>
          </select>
        </label>
      </div>

      {error ? <p className="banner">{error}</p> : null}
      {!data && !error ? <p className="muted">Loading people…</p> : null}

      {data ? (
        <>
          <p className="result-count">
            {data.total.toLocaleString('en-US')} {data.total === 1 ? 'person' : 'people'}
          </p>
          {data.rows.length === 0 ? (
            <p className="empty">Nobody matches these filters.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Country</th>
                    <th>Department</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Base pay</th>
                    <th>Compa</th>
                    <th>Band</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link className="who" to={`/employees/${row.id}`}>
                          <span className="who-name">{row.fullName}</span>
                          <span className="who-meta">
                            {row.employeeCode} · {row.workEmail}
                          </span>
                        </Link>
                      </td>
                      <td>{row.countryName}</td>
                      <td>{row.department}</td>
                      <td>{row.jobLevel}</td>
                      <td>
                        <span className={`pill status-${row.employmentStatus}`}>{row.employmentStatus}</span>
                      </td>
                      <td className="num">{formatMoney(row.annualMinor, row.currency)}</td>
                      <td className="num">{row.compaRatio.toFixed(2)}</td>
                      <td>
                        <span className={`pill band-${row.bandPosition}`}>{row.bandPosition}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pager">
            <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
              Previous
            </button>
            <span>
              Page {data.page} of {pages}
            </span>
            <button type="button" disabled={data.page >= pages} onClick={() => setPage(data.page + 1)}>
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
