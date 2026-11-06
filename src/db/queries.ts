import type { DatabaseSync } from 'node:sqlite'
import { compaRatio } from '../domain/money.ts'
import { bandPosition, median } from '../domain/stats.ts'
import type {
  BandPosition,
  CountryTotal,
  CurrencyTotal,
  DirectoryStatus,
  EmployeeDetail,
  EmployeeListItem,
  EmployeeListResponse,
  EmploymentStatus,
  Gender,
  Outlier,
  SalaryHistoryItem,
  SalaryReason,
  SummaryResponse,
} from '../domain/types.ts'
import { COUNTRIES, countryByCode } from '../reference.ts'
import { asNumber } from './database.ts'

const WITH_LATEST = `
  WITH latest AS (
    SELECT
      salary_records.*,
      ROW_NUMBER() OVER (
        PARTITION BY employee_id
        ORDER BY effective_date DESC, id DESC
      ) AS rn
    FROM salary_records
  )
`

const DIRECTORY_SELECT = `
  SELECT
    e.id, e.employee_code, e.full_name, e.work_email, e.country_code, e.department,
    e.job_title, e.job_level, e.employment_status, e.hire_date, e.termination_date,
    s.annual_minor, s.currency, s.effective_date, s.end_date, s.reason,
    b.min_minor, b.mid_minor, b.max_minor
`

const DIRECTORY_FROM = `
  FROM employees e
  JOIN latest s ON s.employee_id = e.id AND s.rn = 1
  JOIN salary_bands b ON b.country_code = e.country_code AND b.job_level = e.job_level
`

type SqlRow = Record<string, unknown>

function text(row: SqlRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Expected text in ${key}`)
  return value
}

function nullableText(row: SqlRow, key: string): string | null {
  const value = row[key]
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`Expected text in ${key}`)
  return value
}

export function mapEmployee(row: SqlRow): EmployeeListItem {
  const annualMinor = asNumber(row.annual_minor)
  const bandMinMinor = asNumber(row.min_minor)
  const bandMidMinor = asNumber(row.mid_minor)
  const bandMaxMinor = asNumber(row.max_minor)
  const countryCode = text(row, 'country_code')
  return {
    id: asNumber(row.id),
    employeeCode: text(row, 'employee_code'),
    fullName: text(row, 'full_name'),
    workEmail: text(row, 'work_email'),
    countryCode,
    countryName: countryByCode(countryCode)?.name ?? countryCode,
    department: text(row, 'department'),
    jobTitle: text(row, 'job_title'),
    jobLevel: text(row, 'job_level'),
    employmentStatus: text(row, 'employment_status') as EmploymentStatus,
    hireDate: text(row, 'hire_date'),
    terminationDate: nullableText(row, 'termination_date'),
    currency: text(row, 'currency'),
    annualMinor,
    effectiveDate: text(row, 'effective_date'),
    endDate: nullableText(row, 'end_date'),
    reason: text(row, 'reason') as SalaryReason,
    compaRatio: compaRatio(annualMinor, bandMidMinor),
    bandPosition: bandPosition(annualMinor, bandMinMinor, bandMaxMinor),
    bandMinMinor,
    bandMidMinor,
    bandMaxMinor,
  }
}

export type DirectoryQuery = {
  q?: string
  country?: string
  department?: string
  level?: string
  status?: string
  band?: string
  page?: number
  pageSize?: number
}

function likePattern(raw: string): string {
  const escaped = raw.replace(/[\\%_]/g, (char) => `\\${char}`)
  return `%${escaped}%`
}

function directoryWhere(query: DirectoryQuery): { clause: string; params: (string | number)[] } {
  const where: string[] = []
  const params: (string | number)[] = []
  const status = (query.status || 'paid') as DirectoryStatus
  if (status === 'all') {
    // no status predicate
  } else if (status === 'active' || status === 'leave' || status === 'terminated') {
    where.push('e.employment_status = ?')
    params.push(status)
  } else {
    where.push(`e.employment_status IN ('active', 'leave')`)
  }
  if (query.country) {
    where.push('e.country_code = ?')
    params.push(query.country)
  }
  if (query.department) {
    where.push('e.department = ?')
    params.push(query.department)
  }
  if (query.level) {
    where.push('e.job_level = ?')
    params.push(query.level)
  }
  if (query.q && query.q.trim()) {
    const pattern = likePattern(query.q.trim())
    where.push(
      `(e.full_name LIKE ? ESCAPE '\\' OR e.work_email LIKE ? ESCAPE '\\' OR e.employee_code LIKE ? ESCAPE '\\')`,
    )
    params.push(pattern, pattern, pattern)
  }
  if (query.band === 'below') where.push('s.annual_minor < b.min_minor')
  else if (query.band === 'above') where.push('s.annual_minor > b.max_minor')
  else if (query.band === 'within') where.push('s.annual_minor >= b.min_minor AND s.annual_minor <= b.max_minor')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return { clause, params }
}

export function listEmployees(db: DatabaseSync, query: DirectoryQuery): EmployeeListResponse {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25))
  const { clause, params } = directoryWhere(query)
  const totalRow = db
    .prepare(`${WITH_LATEST} SELECT COUNT(*) AS n ${DIRECTORY_FROM} ${clause}`)
    .get(...params) as SqlRow
  const rows = db
    .prepare(
      `${WITH_LATEST} ${DIRECTORY_SELECT} ${DIRECTORY_FROM} ${clause} ORDER BY e.full_name COLLATE NOCASE, e.employee_code LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as SqlRow[]
  return {
    total: asNumber(totalRow.n),
    page,
    pageSize,
    rows: rows.map(mapEmployee),
  }
}

export function listEmployeesForExport(db: DatabaseSync, query: DirectoryQuery): EmployeeListItem[] {
  const { clause, params } = directoryWhere(query)
  const rows = db
    .prepare(
      `${WITH_LATEST} ${DIRECTORY_SELECT} ${DIRECTORY_FROM} ${clause} ORDER BY e.full_name COLLATE NOCASE, e.employee_code`,
    )
    .all(...params) as SqlRow[]
  return rows.map(mapEmployee)
}

export function getEmployee(db: DatabaseSync, id: number): EmployeeDetail | null {
  const row = db.prepare(`${WITH_LATEST} ${DIRECTORY_SELECT} ${DIRECTORY_FROM} WHERE e.id = ?`).get(id) as SqlRow | undefined
  if (!row) return null
  const historyRows = db
    .prepare(
      `SELECT id, annual_minor, currency, effective_date, end_date, reason, note, recorded_at
       FROM salary_records WHERE employee_id = ? ORDER BY effective_date DESC, id DESC`,
    )
    .all(id) as SqlRow[]
  const history: SalaryHistoryItem[] = historyRows.map((history) => ({
    id: asNumber(history.id),
    annualMinor: asNumber(history.annual_minor),
    currency: text(history, 'currency'),
    effectiveDate: text(history, 'effective_date'),
    endDate: nullableText(history, 'end_date'),
    reason: text(history, 'reason') as SalaryReason,
    note: text(history, 'note'),
    recordedAt: text(history, 'recorded_at'),
  }))
  return { employee: mapEmployee(row), history }
}

type PaidRow = {
  countryCode: string
  countryName: string
  department: string
  jobLevel: string
  gender: Gender
  currency: string
  annualMinor: number
  minMinor: number
  maxMinor: number
  employmentStatus: EmploymentStatus
}

function loadPaidRows(db: DatabaseSync): PaidRow[] {
  const rows = db
    .prepare(
      `SELECT e.country_code, e.department, e.job_level, e.gender, e.employment_status,
              s.annual_minor, s.currency, b.min_minor, b.max_minor
       FROM employees e
       JOIN salary_records s ON s.employee_id = e.id AND s.end_date IS NULL
       JOIN salary_bands b ON b.country_code = e.country_code AND b.job_level = e.job_level
       WHERE e.employment_status IN ('active', 'leave')`,
    )
    .all() as SqlRow[]
  return rows.map((row) => {
    const countryCode = text(row, 'country_code')
    return {
      countryCode,
      countryName: countryByCode(countryCode)?.name ?? countryCode,
      department: text(row, 'department'),
      jobLevel: text(row, 'job_level'),
      gender: text(row, 'gender') as Gender,
      currency: text(row, 'currency'),
      annualMinor: asNumber(row.annual_minor),
      minMinor: asNumber(row.min_minor),
      maxMinor: asNumber(row.max_minor),
      employmentStatus: text(row, 'employment_status') as EmploymentStatus,
    }
  })
}

export function payrollSummary(db: DatabaseSync, today: string): SummaryResponse {
  const paid = loadPaidRows(db)
  const statusRows = db
    .prepare(`SELECT employment_status, COUNT(*) AS n FROM employees GROUP BY employment_status`)
    .all() as SqlRow[]
  const headcount = { active: 0, leave: 0, terminated: 0 }
  for (const row of statusRows) {
    const status = text(row, 'employment_status') as EmploymentStatus
    headcount[status] = asNumber(row.n)
  }

  const byCurrencyMap = new Map<string, number[]>()
  const byCountryMap = new Map<string, { amounts: number[]; active: number; leave: number }>()
  const outsideBand = { below: 0, above: 0, within: 0 }
  for (const row of paid) {
    const currencyAmounts = byCurrencyMap.get(row.currency) ?? []
    currencyAmounts.push(row.annualMinor)
    byCurrencyMap.set(row.currency, currencyAmounts)

    const country = byCountryMap.get(row.countryCode) ?? { amounts: [], active: 0, leave: 0 }
    country.amounts.push(row.annualMinor)
    if (row.employmentStatus === 'leave') country.leave += 1
    else country.active += 1
    byCountryMap.set(row.countryCode, country)

    const position = bandPosition(row.annualMinor, row.minMinor, row.maxMinor)
    outsideBand[position] += 1
  }

  const byCurrency: CurrencyTotal[] = [...byCurrencyMap.entries()]
    .map(([currency, amounts]) => ({
      currency,
      people: amounts.length,
      payrollMinor: amounts.reduce((sum, amount) => sum + amount, 0),
      medianMinor: median(amounts) ?? 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))

  const terminatedByCountry = new Map<string, number>()
  const terminatedRows = db
    .prepare(
      `SELECT country_code, COUNT(*) AS n FROM employees WHERE employment_status = 'terminated' GROUP BY country_code`,
    )
    .all() as SqlRow[]
  for (const row of terminatedRows) terminatedByCountry.set(text(row, 'country_code'), asNumber(row.n))

  const byCountry: CountryTotal[] = COUNTRIES.map((country) => {
    const bucket = byCountryMap.get(country.code)
    const amounts = bucket?.amounts ?? []
    return {
      countryCode: country.code,
      countryName: country.name,
      currency: country.currency,
      active: bucket?.active ?? 0,
      leave: bucket?.leave ?? 0,
      terminated: terminatedByCountry.get(country.code) ?? 0,
      payrollMinor: amounts.reduce((sum, amount) => sum + amount, 0),
      medianMinor: median(amounts) ?? 0,
    }
  }).filter((country) => country.active + country.leave + country.terminated > 0)

  return { today, headcount, outsideBand, byCurrency, byCountry }
}

export function listOutliers(db: DatabaseSync, limit: number): Outlier[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.employee_code, e.full_name, e.country_code, e.department, e.job_level,
              s.annual_minor, s.currency, b.min_minor, b.max_minor,
              CASE WHEN s.annual_minor < b.min_minor THEN 'below' ELSE 'above' END AS band_position,
              CASE
                WHEN s.annual_minor < b.min_minor THEN b.min_minor - s.annual_minor
                ELSE s.annual_minor - b.max_minor
              END AS gap_minor
       FROM employees e
       JOIN salary_records s ON s.employee_id = e.id AND s.end_date IS NULL
       JOIN salary_bands b ON b.country_code = e.country_code AND b.job_level = e.job_level
       WHERE e.employment_status IN ('active', 'leave')
         AND (s.annual_minor < b.min_minor OR s.annual_minor > b.max_minor)
       ORDER BY gap_minor DESC, e.employee_code
       LIMIT ?`,
    )
    .all(limit) as SqlRow[]
  return rows.map((row) => {
    const countryCode = text(row, 'country_code')
    return {
      id: asNumber(row.id),
      employeeCode: text(row, 'employee_code'),
      fullName: text(row, 'full_name'),
      countryCode,
      countryName: countryByCode(countryCode)?.name ?? countryCode,
      department: text(row, 'department'),
      jobLevel: text(row, 'job_level'),
      currency: text(row, 'currency'),
      annualMinor: asNumber(row.annual_minor),
      bandMinMinor: asNumber(row.min_minor),
      bandMaxMinor: asNumber(row.max_minor),
      bandPosition: text(row, 'band_position') as 'below' | 'above',
      gapMinor: asNumber(row.gap_minor),
    }
  })
}

export function loadQuestionRows(db: DatabaseSync): PaidRow[] {
  return loadPaidRows(db)
}

export type { BandPosition }
