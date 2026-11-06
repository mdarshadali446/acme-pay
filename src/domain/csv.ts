import { compaRatio, formatMajor } from './money.ts'
import type { EmployeeListItem } from './types.ts'

function cell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function employeesToCsv(rows: EmployeeListItem[]): string {
  const header = [
    'employee_code',
    'full_name',
    'work_email',
    'country',
    'department',
    'job_title',
    'job_level',
    'status',
    'currency',
    'annual_amount',
    'compa_ratio',
    'band_position',
    'effective_date',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        cell(row.employeeCode),
        cell(row.fullName),
        cell(row.workEmail),
        cell(row.countryName),
        cell(row.department),
        cell(row.jobTitle),
        cell(row.jobLevel),
        cell(row.employmentStatus),
        cell(row.currency),
        formatMajor(row.annualMinor),
        compaRatio(row.annualMinor, row.bandMidMinor).toFixed(2),
        cell(row.bandPosition),
        cell(row.effectiveDate),
      ].join(','),
    )
  }
  return `\uFEFF${lines.join('\n')}\n`
}
