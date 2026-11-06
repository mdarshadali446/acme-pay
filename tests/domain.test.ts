import { describe, expect, it } from 'vitest'
import { employeesToCsv } from '../src/domain/csv.ts'
import { addDays, addYears, isIsoDate } from '../src/domain/dates.ts'
import { compaRatio, formatMajor, formatMoney, parseMoneyInput } from '../src/domain/money.ts'
import { decideSalaryChange } from '../src/domain/salary-change.ts'
import { bandPosition, genderComparisons, median, summarizeByLevel } from '../src/domain/stats.ts'
import type { EmployeeListItem } from '../src/domain/types.ts'

const today = '2026-11-06'

function proposal(overrides: Partial<{ annualMinor: number; effectiveDate: string; reason: string; note: string }> = {}) {
  return decideSalaryChange({
    employmentStatus: 'active',
    hireDate: '2020-01-15',
    current: { annualMinor: 10_000_00, effectiveDate: '2026-01-15' },
    proposed: {
      annualMinor: 11_000_00,
      effectiveDate: today,
      reason: 'adjustment',
      note: '',
      ...overrides,
    },
    today,
  })
}

describe('dates', () => {
  it('rejects impossible calendar dates', () => {
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('2026-11-06')).toBe(true)
    expect(isIsoDate('06-11-2026')).toBe(false)
  })

  it('steps across month and year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28')
  })
})

describe('money', () => {
  it('parses commas and at most two decimal places', () => {
    expect(parseMoneyInput('85,000')).toEqual({ ok: true, minor: 8_500_000 })
    expect(parseMoneyInput('10.5')).toEqual({ ok: true, minor: 1050 })
    expect(parseMoneyInput('10.50')).toEqual({ ok: true, minor: 1050 })
    expect(parseMoneyInput('0').ok).toBe(false)
    expect(parseMoneyInput('10.555').ok).toBe(false)
    expect(parseMoneyInput('$10').ok).toBe(false)
    expect(parseMoneyInput('20000000.01').ok).toBe(false)
    expect(parseMoneyInput('20000000').ok).toBe(true)
  })

  it('formats minor units without floating the major amount', () => {
    expect(formatMajor(123456)).toBe('1234.56')
    expect(formatMajor(100)).toBe('1.00')
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
  })

  it('rounds compa-ratio to two decimals', () => {
    expect(compaRatio(10000, 10000)).toBe(1)
    expect(compaRatio(1, 3)).toBe(0.33)
  })
})

describe('decideSalaryChange', () => {
  it('appends a later adjustment and closes the previous day', () => {
    const decision = proposal()
    expect(decision).toMatchObject({ ok: true, mode: 'append', closeEndDate: '2026-11-05' })
  })

  it('updates the open row when the effective date does not move', () => {
    const decision = proposal({ effectiveDate: '2026-01-15', annualMinor: 10_500_00 })
    expect(decision).toMatchObject({ ok: true, mode: 'replace' })
  })

  it('blocks a promotion that cuts pay, and a cut with no note', () => {
    const promotion = proposal({ reason: 'promotion', annualMinor: 9_000_00 })
    expect(promotion.ok).toBe(false)
    const quietCut = proposal({ annualMinor: 9_000_00, note: 'no' })
    expect(quietCut.ok).toBe(false)
    const notedCut = proposal({ annualMinor: 9_000_00, note: 'Role scope reduced' })
    expect(notedCut.ok).toBe(true)
  })

  it('refuses terminated staff, dates before the open row, and dates too far out', () => {
    const terminated = decideSalaryChange({
      employmentStatus: 'terminated',
      hireDate: '2020-01-15',
      current: { annualMinor: 100, effectiveDate: '2026-01-15' },
      proposed: { annualMinor: 200, effectiveDate: today, reason: 'adjustment', note: '' },
      today,
    })
    expect(terminated.ok).toBe(false)
    expect(proposal({ effectiveDate: '2025-12-01' }).ok).toBe(false)
    expect(proposal({ effectiveDate: '2026-02-31' }).ok).toBe(false)
    expect(proposal({ effectiveDate: addDays(today, 91) }).ok).toBe(false)
    expect(proposal({ effectiveDate: addDays(today, 90) }).ok).toBe(true)
    expect(proposal({ effectiveDate: '2019-01-01' }).ok).toBe(false)
  })
})

describe('stats', () => {
  it('takes the middle, or the rounded mean of the two middles', () => {
    expect(median([30, 10, 20])).toBe(20)
    expect(median([10, 20, 30, 40])).toBe(25)
    expect(median([1, 2])).toBe(2)
    expect(median([])).toBeNull()
  })

  it('treats the band edges as inside', () => {
    expect(bandPosition(80, 80, 125)).toBe('within')
    expect(bandPosition(125, 80, 125)).toBe('within')
    expect(bandPosition(79, 80, 125)).toBe('below')
    expect(bandPosition(126, 80, 125)).toBe('above')
  })

  it('hides gender cells under 20 and ignores undisclosed', () => {
    const rows = []
    for (let i = 0; i < 20; i += 1) {
      rows.push({ countryCode: 'US', jobLevel: 'IC3', currency: 'USD', gender: 'female' as const, annualMinor: 100 })
      rows.push({ countryCode: 'US', jobLevel: 'IC3', currency: 'USD', gender: 'male' as const, annualMinor: 80 })
    }
    for (let i = 0; i < 30; i += 1) {
      rows.push({ countryCode: 'US', jobLevel: 'IC3', currency: 'USD', gender: 'undisclosed' as const, annualMinor: 10 })
    }
    rows.push({ countryCode: 'IN', jobLevel: 'IC3', currency: 'INR', gender: 'female' as const, annualMinor: 50 })
    const result = genderComparisons(rows)
    expect(result.suppressed).toBe(1)
    expect(result.shown).toHaveLength(1)
    expect(result.shown[0].gapRatio).toBeCloseTo(0.25)
    expect(result.shown[0].women).toBe(20)
  })

  it('sorts level medians by currency then level order', () => {
    const cells = summarizeByLevel(
      [
        { currency: 'USD', jobLevel: 'IC3', annualMinor: 30 },
        { currency: 'USD', jobLevel: 'IC1', annualMinor: 10 },
        { currency: 'INR', jobLevel: 'IC2', annualMinor: 5 },
      ],
      ['IC1', 'IC2', 'IC3'],
    )
    expect(cells.map((cell) => `${cell.currency}:${cell.level}`)).toEqual(['INR:IC2', 'USD:IC1', 'USD:IC3'])
  })
})

describe('csv', () => {
  it('quotes commas and quotes, and starts with a BOM for Excel', () => {
    const row = {
      employeeCode: 'E10001',
      fullName: 'Doe, Jane "JJ"',
      workEmail: 'jane@acme.test',
      countryName: 'India',
      department: 'Engineering',
      jobTitle: 'Engineer',
      jobLevel: 'IC2',
      employmentStatus: 'active',
      currency: 'INR',
      annualMinor: 140000000,
      effectiveDate: '2026-01-01',
      bandPosition: 'within',
      bandMidMinor: 140000000,
    } as EmployeeListItem
    const csv = employeesToCsv([row])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Doe, Jane ""JJ"""')
    expect(csv).toContain('1400000.00')
  })
})
