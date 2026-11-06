export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addYears(iso: string, years: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const targetYear = year + years
  const date = new Date(Date.UTC(targetYear, month - 1, day))
  if (date.getUTCMonth() !== month - 1) {
    const clamped = new Date(Date.UTC(targetYear, month, 0))
    return clamped.toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

export function localIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
