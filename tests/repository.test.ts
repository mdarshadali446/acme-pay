import { describe, expect, it } from 'vitest'
import { addDays } from '../src/domain/dates.ts'
import { openDatabase } from '../src/db/database.ts'
import { generateOrg } from '../src/db/generate.ts'
import { insertBands, insertOrg } from '../src/db/load.ts'
import { changeSalary } from '../src/db/change.ts'
import { getEmployee, listEmployees, payrollSummary } from '../src/db/queries.ts'
import { applySchema } from '../src/db/schema.ts'
import { countryByCode } from '../src/reference.ts'

function databaseWith(count: number, seed = 7) {
  const db = openDatabase(':memory:')
  applySchema(db)
  insertBands(db)
  insertOrg(db, generateOrg({ count, seed, asOf: '2026-11-06' }))
  return db
}

describe('generateOrg', () => {
  it('builds a consistent org and the same seed twice', () => {
    const first = generateOrg({ count: 400, seed: 42, asOf: '2026-11-06' })
    const second = generateOrg({ count: 400, seed: 42, asOf: '2026-11-06' })
    expect(first.map((person) => person.employeeCode)).toEqual(second.map((person) => person.employeeCode))
    expect(new Set(first.map((person) => person.workEmail)).size).toBe(400)

    for (const person of first) {
      const currency = countryByCode(person.countryCode)?.currency
      const open = person.records.filter((record) => record.endDate == null)
      expect(open).toHaveLength(person.employmentStatus === 'terminated' ? 0 : 1)
      if (person.terminationDate) expect(person.records.at(-1)?.endDate).toBe(person.terminationDate)
      for (let index = 0; index < person.records.length; index += 1) {
        const record = person.records[index]
        expect(record.currency).toBe(currency)
        expect(record.annualMinor).toBeGreaterThan(0)
        if (index > 0) {
          expect(record.effectiveDate > person.records[index - 1].effectiveDate).toBe(true)
          expect(person.records[index - 1].endDate).toBe(addDays(record.effectiveDate, -1))
        }
      }
    }
  })

  it('can produce the full 10,000 without colliding codes', () => {
    const people = generateOrg({ count: 10_000, seed: 20261106, asOf: '2026-11-06' })
    expect(people).toHaveLength(10_000)
    expect(people[0].employeeCode).toBe('E10001')
    expect(people[9999].employeeCode).toBe('E20000')
    expect(new Set(people.map((person) => person.employeeCode)).size).toBe(10_000)
  })
})

describe('salary store', () => {
  it('pages the directory and refuses a second open salary', () => {
    const db = databaseWith(60)
    const page = listEmployees(db, { status: 'all', page: 1, pageSize: 10 })
    expect(page.rows).toHaveLength(10)
    expect(page.total).toBe(60)
    const employeeId = page.rows[0].id
    expect(() => {
      db.prepare(
        `INSERT INTO salary_records (
           employee_id, annual_minor, currency, effective_date, end_date, reason, note, recorded_at
         ) VALUES (?, 100, 'USD', '2026-11-06', NULL, 'adjustment', '', '2026-11-06T00:00:00.000Z')`,
      ).run(employeeId)
    }).toThrow()
  })

  it('keeps terminated pay out of the payroll total', () => {
    const db = databaseWith(150)
    const summary = payrollSummary(db, '2026-11-06')
    const paid = summary.headcount.active + summary.headcount.leave
    const summed = summary.byCurrency.reduce((total, row) => total + row.people, 0)
    expect(summed).toBe(paid)
    expect(summary.headcount.terminated).toBeGreaterThan(0)
    expect(summary.headcount.active + summary.headcount.leave + summary.headcount.terminated).toBe(150)
  })

  it('closes the old row, then edits in place on the same date', () => {
    const db = databaseWith(40)
    const current = db
      .prepare(
        `SELECT e.id, s.annual_minor, e.hire_date
         FROM employees e
         JOIN salary_records s ON s.employee_id = e.id AND s.end_date IS NULL
         WHERE e.employment_status = 'active' AND s.effective_date < '2026-11-06'
         LIMIT 1`,
      )
      .get() as { id: number | bigint; annual_minor: number | bigint; hire_date: string }
    const id = Number(current.id)
    const before = getEmployee(db, id)
    const lowered = (Number(current.annual_minor) / 100 - 1000).toFixed(2)
    const cut = changeSalary(
      db,
      id,
      { amount: lowered, effectiveDate: '2026-11-06', reason: 'adjustment', note: '' },
      '2026-11-06',
      '2026-11-06T12:00:00.000Z',
    )
    expect(cut.ok).toBe(false)

    const saved = changeSalary(
      db,
      id,
      { amount: lowered, effectiveDate: '2026-11-06', reason: 'adjustment', note: 'Scope reduced' },
      '2026-11-06',
      '2026-11-06T12:00:00.000Z',
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.detail.history).toHaveLength((before?.history.length ?? 0) + 1)
    expect(saved.detail.history[1].endDate).toBe('2026-11-05')

    const replaced = changeSalary(
      db,
      id,
      { amount: lowered, effectiveDate: '2026-11-06', reason: 'correction', note: 'Same day fixup' },
      '2026-11-06',
      '2026-11-06T13:00:00.000Z',
    )
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.detail.history).toHaveLength(saved.detail.history.length)
    expect(replaced.detail.history[0].note).toBe('Same day fixup')
  })
})
