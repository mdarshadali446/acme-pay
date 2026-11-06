export const MAX_ANNUAL_MINOR = 2_000_000_000

export type MoneyParse = { ok: true; minor: number } | { ok: false; error: string }

export function parseMoneyInput(raw: string): MoneyParse {
  const cleaned = raw.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return {
      ok: false,
      error: 'Enter a positive amount with at most 2 decimal places. Commas are fine.',
    }
  }
  const [whole, frac = ''] = cleaned.split('.')
  const minor = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' }
  }
  if (minor > MAX_ANNUAL_MINOR) {
    return { ok: false, error: 'Amount is above the 20,000,000 cap for one salary.' }
  }
  return { ok: true, minor }
}

export function formatMajor(minor: number): string {
  const negative = minor < 0
  const absolute = Math.abs(Math.round(minor))
  const whole = Math.floor(absolute / 100)
  const frac = String(absolute % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${frac}`
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

export function compaRatio(annualMinor: number, midMinor: number): number {
  if (midMinor <= 0) return 0
  return Math.round((annualMinor / midMinor) * 100) / 100
}
