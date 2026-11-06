import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatMoney, parseMoneyInput } from '@shared/domain/money'
import { decideSalaryChange } from '@shared/domain/salary-change'
import type { EmployeeDetail, SalaryReason } from '@shared/domain/types'
import { ApiError, api } from '../api'
import { useMeta } from '../shell'

export function EmployeeDetailPage() {
  const { id } = useParams()
  const meta = useMeta()
  const [detail, setDetail] = useState<EmployeeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(meta.today)
  const [reason, setReason] = useState<SalaryReason>('adjustment')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api<EmployeeDetail>(`/api/employees/${id}`)
      .then((next) => {
        setDetail(next)
        setAmount((next.employee.annualMinor / 100).toFixed(2))
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load this person.'))
  }, [id])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    const parsed = parseMoneyInput(amount)
    if (!parsed.ok) {
      setFormError(parsed.error)
      return
    }
    const decision = decideSalaryChange({
      employmentStatus: detail.employee.employmentStatus,
      hireDate: detail.employee.hireDate,
      current: { annualMinor: detail.employee.annualMinor, effectiveDate: detail.employee.effectiveDate },
      proposed: { annualMinor: parsed.minor, effectiveDate, reason, note },
      today: meta.today,
    })
    if (!decision.ok) {
      setFormError(decision.error)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      const next = await api<EmployeeDetail>(`/api/employees/${detail.employee.id}/salary`, {
        method: 'POST',
        body: JSON.stringify({ amount, effectiveDate, reason, note }),
      })
      setDetail(next)
      setNote('')
      setAmount((next.employee.annualMinor / 100).toFixed(2))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save the change.')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="banner">{error}</p>
  if (!detail) return <p className="muted">Loading salary history…</p>

  const person = detail.employee
  const frozen = person.employmentStatus === 'terminated' || person.endDate != null
  const span = person.bandMaxMinor - person.bandMinMinor
  const raw = span <= 0 ? 50 : ((person.annualMinor - person.bandMinMinor) / span) * 100
  const marker = Math.min(100, Math.max(0, raw))
  const delta = person.annualMinor - person.bandMidMinor

  return (
    <div className="page">
      <Link className="back" to="/employees">
        Back to directory
      </Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {person.employeeCode} · hired {person.hireDate}
            {person.terminationDate ? ` · left ${person.terminationDate}` : ''}
          </p>
          <h1>{person.fullName}</h1>
          <p className="lede">
            {person.jobTitle}, {person.department} · {person.countryName}
          </p>
        </div>
        <span className={`pill status-${person.employmentStatus}`}>{person.employmentStatus}</span>
      </header>

      <section className="split">
        <article className="panel">
          <h2>Current base</h2>
          <p className="pay">{formatMoney(person.annualMinor, person.currency)}</p>
          <p className="muted">
            {person.endDate ? `Last paid through ${person.endDate}` : `Effective ${person.effectiveDate}`} · compa-ratio{' '}
            {person.compaRatio.toFixed(2)} · {delta === 0 ? 'at midpoint' : `${delta > 0 ? '+' : '−'}${formatMoney(Math.abs(delta), person.currency)} vs midpoint`}
          </p>
          <div className="band" aria-hidden="true">
            <div className="band-track">
              <div className="band-mark" style={{ left: `${marker}%` }} />
            </div>
            <div className="band-labels">
              <span>{formatMoney(person.bandMinMinor, person.currency)}</span>
              <span>{formatMoney(person.bandMidMinor, person.currency)}</span>
              <span>{formatMoney(person.bandMaxMinor, person.currency)}</span>
            </div>
          </div>
          <p>
            <span className={`pill band-${person.bandPosition}`}>{person.bandPosition} band</span>
          </p>
          <p className="fine">
            The band is a flag. Saving outside it is allowed, and the directory will keep showing it.
          </p>
        </article>

        <article className="panel">
          <h2>Change base pay</h2>
          {frozen ? (
            <p>This record is closed. Terminated pay stays as history.</p>
          ) : (
            <form className="stack" onSubmit={(event) => void submit(event)}>
              <label>
                Annual amount ({person.currency})
                <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label>
                Effective date
                <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
              </label>
              <label>
                Reason
                <select value={reason} onChange={(event) => setReason(event.target.value as SalaryReason)}>
                  <option value="adjustment">Adjustment</option>
                  <option value="promotion">Promotion</option>
                  <option value="correction">Correction</option>
                </select>
              </label>
              <label>
                Note
                <textarea value={note} rows={3} onChange={(event) => setNote(event.target.value)} />
              </label>
              <p className="fine">
                A promotion can&apos;t reduce pay. Any reduction needs a short note. The same effective date updates the
                open row instead of adding a new one.
              </p>
              {formError ? <p className="banner">{formError}</p> : null}
              <button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save salary'}
              </button>
            </form>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>History</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Effective</th>
                <th>Through</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {detail.history.map((row) => (
                <tr key={row.id}>
                  <td>{row.effectiveDate}</td>
                  <td>{row.endDate ?? 'Current'}</td>
                  <td className="num">{formatMoney(row.annualMinor, row.currency)}</td>
                  <td>{row.reason}</td>
                  <td>{row.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
