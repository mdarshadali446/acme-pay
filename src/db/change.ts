import type { DatabaseSync } from 'node:sqlite'
import { parseMoneyInput } from '../domain/money.ts'
import { decideSalaryChange } from '../domain/salary-change.ts'
import type { EmployeeDetail, EmploymentStatus } from '../domain/types.ts'
import { asNumber } from './database.ts'
import { getEmployee } from './queries.ts'

type ChangeResult = { ok: true; detail: EmployeeDetail } | { ok: false; status: number; error: string }

export function changeSalary(
  db: DatabaseSync,
  employeeId: number,
  input: { amount: string; effectiveDate: string; reason: string; note: string },
  today: string,
  recordedAt: string,
): ChangeResult {
  const employee = db
    .prepare(
      `SELECT id, employment_status, hire_date FROM employees WHERE id = ?`,
    )
    .get(employeeId) as { id: number | bigint; employment_status: string; hire_date: string } | undefined
  if (!employee) return { ok: false, status: 404, error: 'Employee not found.' }

  const current = db
    .prepare(
      `SELECT id, annual_minor, effective_date FROM salary_records
       WHERE employee_id = ? AND end_date IS NULL`,
    )
    .get(employeeId) as { id: number | bigint; annual_minor: number | bigint; effective_date: string } | undefined
  if (!current) {
    return {
      ok: false,
      status: 400,
      error: 'No open salary to change. Terminated records are kept as history only.',
    }
  }

  const parsed = parseMoneyInput(input.amount)
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error }

  const decision = decideSalaryChange({
    employmentStatus: employee.employment_status as EmploymentStatus,
    hireDate: employee.hire_date,
    current: { annualMinor: asNumber(current.annual_minor), effectiveDate: current.effective_date },
    proposed: {
      annualMinor: parsed.minor,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
      note: input.note,
    },
    today,
  })
  if (!decision.ok) return { ok: false, status: 400, error: decision.error }

  const currentId = asNumber(current.id)
  db.exec('BEGIN')
  try {
    if (decision.mode === 'replace') {
      db.prepare(
        `UPDATE salary_records
         SET annual_minor = ?, reason = ?, note = ?, recorded_at = ?
         WHERE id = ?`,
      ).run(decision.annualMinor, decision.reason, decision.note, recordedAt, currentId)
    } else {
      const closeEndDate = decision.closeEndDate
      if (!closeEndDate) throw new Error('Missing the date the previous salary should close on.')
      db.prepare(`UPDATE salary_records SET end_date = ? WHERE id = ?`).run(closeEndDate, currentId)
      const currency = db
        .prepare(`SELECT currency FROM salary_records WHERE id = ?`)
        .get(currentId) as { currency: string }
      db.prepare(
        `INSERT INTO salary_records (
           employee_id, annual_minor, currency, effective_date, end_date, reason, note, recorded_at
         ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).run(
        employeeId,
        decision.annualMinor,
        currency.currency,
        decision.effectiveDate,
        decision.reason,
        decision.note,
        recordedAt,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const detail = getEmployee(db, employeeId)
  if (!detail) return { ok: false, status: 404, error: 'Employee not found.' }
  return { ok: true, detail }
}
