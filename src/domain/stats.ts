import type { BandPosition, Gender } from './types.ts'

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function bandPosition(annualMinor: number, minMinor: number, maxMinor: number): BandPosition {
  if (annualMinor < minMinor) return 'below'
  if (annualMinor > maxMinor) return 'above'
  return 'within'
}

export type MoneyGroup = {
  people: number
  payrollMinor: number
  medianMinor: number
}

export function summarizeAmounts(values: number[]): MoneyGroup {
  const people = values.length
  const payrollMinor = values.reduce((sum, value) => sum + value, 0)
  return { people, payrollMinor, medianMinor: median(values) ?? 0 }
}

export type LevelCell = {
  currency: string
  level: string
  people: number
  medianMinor: number
  lowMinor: number
  highMinor: number
}

export function summarizeByLevel(
  rows: { currency: string; jobLevel: string; annualMinor: number }[],
  levelOrder: readonly string[],
): LevelCell[] {
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.currency}\t${row.jobLevel}`
    const list = groups.get(key)
    if (list) list.push(row.annualMinor)
    else groups.set(key, [row.annualMinor])
  }
  const cells: LevelCell[] = []
  for (const [key, amounts] of groups) {
    const [currency, level] = key.split('\t')
    cells.push({
      currency,
      level,
      people: amounts.length,
      medianMinor: median(amounts) ?? 0,
      lowMinor: Math.min(...amounts),
      highMinor: Math.max(...amounts),
    })
  }
  const rank = new Map(levelOrder.map((level, index) => [level, index]))
  cells.sort((a, b) => a.currency.localeCompare(b.currency) || (rank.get(a.level) ?? 99) - (rank.get(b.level) ?? 99))
  return cells
}

export type GenderComparison = {
  countryCode: string
  jobLevel: string
  currency: string
  women: number
  men: number
  womenMedianMinor: number
  menMedianMinor: number
  gapRatio: number
}

export const MIN_GENDER_CELL = 20

export function genderComparisons(
  rows: { countryCode: string; jobLevel: string; currency: string; gender: Gender; annualMinor: number }[],
): { shown: GenderComparison[]; suppressed: number } {
  const women = new Map<string, number[]>()
  const men = new Map<string, number[]>()
  for (const row of rows) {
    if (row.gender === 'undisclosed') continue
    const key = `${row.countryCode}\t${row.jobLevel}\t${row.currency}`
    const bucket = row.gender === 'female' ? women : men
    const list = bucket.get(key)
    if (list) list.push(row.annualMinor)
    else bucket.set(key, [row.annualMinor])
  }

  const keys = new Set([...women.keys(), ...men.keys()])
  const shown: GenderComparison[] = []
  let suppressed = 0
  for (const key of keys) {
    const femaleAmounts = women.get(key) ?? []
    const maleAmounts = men.get(key) ?? []
    if (femaleAmounts.length < MIN_GENDER_CELL || maleAmounts.length < MIN_GENDER_CELL) {
      suppressed += 1
      continue
    }
    const womenMedianMinor = median(femaleAmounts) ?? 0
    const menMedianMinor = median(maleAmounts) ?? 0
    if (menMedianMinor === 0) {
      suppressed += 1
      continue
    }
    const [countryCode, jobLevel, currency] = key.split('\t')
    shown.push({
      countryCode,
      jobLevel,
      currency,
      women: femaleAmounts.length,
      men: maleAmounts.length,
      womenMedianMinor,
      menMedianMinor,
      gapRatio: (womenMedianMinor - menMedianMinor) / menMedianMinor,
    })
  }
  shown.sort((a, b) => Math.abs(b.gapRatio) - Math.abs(a.gapRatio))
  return { shown, suppressed }
}

export function countBandPositions(
  rows: { annualMinor: number; minMinor: number; maxMinor: number }[],
): Record<BandPosition, number> {
  const counts: Record<BandPosition, number> = { below: 0, within: 0, above: 0 }
  for (const row of rows) counts[bandPosition(row.annualMinor, row.minMinor, row.maxMinor)] += 1
  return counts
}
