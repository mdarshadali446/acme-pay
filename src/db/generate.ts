import { addDays, addYears } from '../domain/dates.ts'
import type { EmploymentStatus, Gender, SalaryReason } from '../domain/types.ts'
import { COUNTRIES, DEPARTMENTS, LEVELS, bandFor, countryByCode, jobTitle, type Level } from '../reference.ts'

export type DraftRecord = {
  annualMinor: number
  currency: string
  effectiveDate: string
  endDate: string | null
  reason: SalaryReason
  note: string
  recordedAt: string
}

export type DraftEmployee = {
  employeeCode: string
  fullName: string
  workEmail: string
  countryCode: string
  department: string
  jobTitle: string
  jobLevel: Level
  employmentStatus: EmploymentStatus
  gender: Gender
  hireDate: string
  terminationDate: string | null
  records: DraftRecord[]
}

const FIRST_NAMES = [
  'Asha', 'Noah', 'Mia', 'Arun', 'Sofia', 'Liam', 'Priya', 'Emma', 'Kabir', 'Olivia',
  'Wei', 'Hannah', 'Omar', 'Isla', 'Diego', 'Amelia', 'Rohan', 'Chloe', 'Yuki', 'Grace',
  'Mateo', 'Anika', 'Leo', 'Fatima', 'Jonah', 'Meera', 'Hugo', 'Elena', 'Samir', 'Nora',
  'Isaac', 'Leila', 'Adam', 'Hana', 'Felix', 'Diya', 'Oscar', 'Ines', 'Nikhil', 'Ruby',
]

const LAST_NAMES = [
  'Sharma', 'Patel', 'Nguyen', 'Garcia', 'Kim', 'Singh', 'Brown', 'Martinez', 'Khan', 'Wilson',
  'Iyer', 'Andersen', 'Rossi', 'Cohen', 'Ali', 'Murphy', 'Silva', 'Novak', 'Berg', 'Diaz',
  'Chen', 'Owusu', 'Keller', 'Santos', 'Rahman', 'Fischer', 'Park', 'Hughes', 'Das', 'Moreau',
  'Bennett', 'Iqbal', 'Laurent', 'Costa', 'Walsh', 'Mehta', 'Hoffmann', 'Reyes', 'Clark', 'Nair',
]

const LEVEL_WEIGHTS: { value: Level; weight: number }[] = [
  { value: 'IC1', weight: 8 },
  { value: 'IC2', weight: 18 },
  { value: 'IC3', weight: 22 },
  { value: 'IC4', weight: 18 },
  { value: 'IC5', weight: 10 },
  { value: 'IC6', weight: 4 },
  { value: 'M1', weight: 10 },
  { value: 'M2', weight: 7 },
  { value: 'M3', weight: 3 },
]

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(rng: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let mark = rng() * total
  for (const item of items) {
    mark -= item.weight
    if (mark < 0) return item.value
  }
  return items[items.length - 1].value
}

function randomIso(rng: () => number, start: string, end: string): string {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  const days = Math.round((endMs - startMs) / 86400000)
  return addDays(start, Math.floor(rng() * (days + 1)))
}

function amountNearBand(midMinor: number, rng: () => number): number {
  const factor = 0.72 + rng() * 0.63
  const major = Math.max(1, Math.round((midMinor / 100) * factor))
  return major * 100
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

export function generateOrg(options: { count: number; seed: number; asOf: string }): DraftEmployee[] {
  const rng = mulberry32(options.seed)
  const people: DraftEmployee[] = []
  for (let index = 0; index < options.count; index += 1) {
    const country = pickWeighted(
      rng,
      COUNTRIES.map((item) => ({ value: item, weight: item.weight })),
    )
    const department = pickWeighted(
      rng,
      DEPARTMENTS.map((item) => ({ value: item.name, weight: item.weight })),
    )
    const level = pickWeighted(rng, LEVEL_WEIGHTS)
    const status = pickWeighted(rng, [
      { value: 'active' as const, weight: 86 },
      { value: 'leave' as const, weight: 7 },
      { value: 'terminated' as const, weight: 7 },
    ])
    const gender = pickWeighted(rng, [
      { value: 'female' as const, weight: 46 },
      { value: 'male' as const, weight: 46 },
      { value: 'undisclosed' as const, weight: 8 },
    ])
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
    const employeeCode = `E${10001 + index}`
    const hireDate = randomIso(rng, '2015-03-01', '2026-08-15')
    const band = bandFor(country.code, level)
    const target = amountNearBand(band.midMinor, rng)

    const dates = [hireDate]
    for (let year = 1; year <= 4; year += 1) {
      const anniversary = addYears(hireDate, year)
      if (anniversary <= options.asOf) dates.push(anniversary)
    }

    const amounts: number[] = []
    let walking = Math.max(100, Math.round(target / 100 / 1.08 ** (dates.length - 1)) * 100)
    for (let step = 0; step < dates.length; step += 1) {
      if (step === dates.length - 1) amounts.push(target)
      else {
        amounts.push(walking)
        const growth = 1.04 + rng() * 0.08
        walking = Math.max(100, Math.round((walking * growth) / 100) * 100)
      }
    }

    let keptDates = dates
    let keptAmounts = amounts
    let terminationDate: string | null = null
    if (status === 'terminated') {
      terminationDate = randomIso(rng, hireDate, options.asOf)
      const filtered = dates
        .map((date, dateIndex) => ({ date, amount: amounts[dateIndex] }))
        .filter((item) => item.date <= terminationDate!)
      if (filtered.length === 0) {
        keptDates = [hireDate]
        keptAmounts = [target]
        if (terminationDate < hireDate) terminationDate = hireDate
      } else {
        keptDates = filtered.map((item) => item.date)
        keptAmounts = filtered.map((item) => item.amount)
      }
    }

    const records: DraftRecord[] = keptDates.map((date, dateIndex) => ({
      annualMinor: keptAmounts[dateIndex],
      currency: country.currency,
      effectiveDate: date,
      endDate: null,
      reason: dateIndex === 0 ? 'hire' : 'adjustment',
      note: dateIndex === 0 ? 'Starting base' : 'Annual adjustment',
      recordedAt: `${date}T09:00:00.000Z`,
    }))
    for (let recordIndex = 0; recordIndex < records.length - 1; recordIndex += 1) {
      records[recordIndex].endDate = addDays(records[recordIndex + 1].effectiveDate, -1)
    }
    if (terminationDate) records[records.length - 1].endDate = terminationDate

    const fullName = `${first} ${last}`
    people.push({
      employeeCode,
      fullName,
      workEmail: `${slug(first)}.${slug(last)}.${employeeCode.toLowerCase()}@acme.test`,
      countryCode: country.code,
      department,
      jobTitle: jobTitle(department, level),
      jobLevel: level,
      employmentStatus: status,
      gender,
      hireDate,
      terminationDate,
      records,
    })
  }
  return people
}

export function currencyFor(countryCode: string): string {
  const country = countryByCode(countryCode)
  if (!country) throw new Error(`Unknown country ${countryCode}`)
  return country.currency
}

export { LEVELS }
