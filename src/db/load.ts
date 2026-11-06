import type { DatabaseSync } from 'node:sqlite'
import type { DraftEmployee } from './generate.ts'
import { allBands } from '../reference.ts'

export function insertBands(db: DatabaseSync): void {
  const insert = db.prepare(`
    INSERT INTO salary_bands (country_code, job_level, currency, min_minor, mid_minor, max_minor)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  db.exec('BEGIN')
  try {
    for (const band of allBands()) {
      insert.run(band.countryCode, band.jobLevel, band.currency, band.minMinor, band.midMinor, band.maxMinor)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function insertOrg(db: DatabaseSync, people: DraftEmployee[]): void {
  const insertEmployee = db.prepare(`
    INSERT INTO employees (
      employee_code, full_name, work_email, country_code, department, job_title, job_level,
      employment_status, gender, hire_date, termination_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertSalary = db.prepare(`
    INSERT INTO salary_records (
      employee_id, annual_minor, currency, effective_date, end_date, reason, note, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.exec('BEGIN')
  try {
    for (const person of people) {
      const result = insertEmployee.run(
        person.employeeCode,
        person.fullName,
        person.workEmail,
        person.countryCode,
        person.department,
        person.jobTitle,
        person.jobLevel,
        person.employmentStatus,
        person.gender,
        person.hireDate,
        person.terminationDate,
      )
      const employeeId = Number(result.lastInsertRowid)
      for (const record of person.records) {
        insertSalary.run(
          employeeId,
          record.annualMinor,
          record.currency,
          record.effectiveDate,
          record.endDate,
          record.reason,
          record.note,
          record.recordedAt,
        )
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
