import { addDays, isIsoDate } from './dates.ts'
import { MAX_ANNUAL_MINOR } from './money.ts'

export type EmploymentStatus = 'active' | 'leave' | 'terminated'
export type SalaryReason = 'adjustment' | 'promotion' | 'correction'

export type SalaryChangeDecision =
  | { ok: false; error: string }
  | {
      ok: true
      mode: 'replace' | 'append'
      annualMinor: number
      effectiveDate: string
      reason: SalaryReason
      note: string
      closeEndDate?: string
    }

const REASONS: SalaryReason[] = ['adjustment', 'promotion', 'correction']

export function decideSalaryChange(input: {
  employmentStatus: EmploymentStatus
  hireDate: string
  current: { annualMinor: number; effectiveDate: string }
  proposed: { annualMinor: number; effectiveDate: string; reason: string; note: string }
  today: string
}): SalaryChangeDecision {
  if (input.employmentStatus === 'terminated') {
    return {
      ok: false,
      error: 'Terminated employees are kept for history. Their pay can\'t be changed here.',
    }
  }
  if (input.employmentStatus !== 'active' && input.employmentStatus !== 'leave') {
    return { ok: false, error: 'This employment status can\'t be changed.' }
  }

  const amount = input.proposed.annualMinor
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' }
  }
  if (amount > MAX_ANNUAL_MINOR) {
    return { ok: false, error: 'Amount is above the 20,000,000 cap for one salary.' }
  }

  if (!REASONS.includes(input.proposed.reason as SalaryReason)) {
    return { ok: false, error: 'Reason must be adjustment, promotion, or correction.' }
  }
  const reason = input.proposed.reason as SalaryReason

  if (!isIsoDate(input.proposed.effectiveDate) || !isIsoDate(input.today) || !isIsoDate(input.hireDate)) {
    return { ok: false, error: 'Enter a real effective date (YYYY-MM-DD).' }
  }
  if (!isIsoDate(input.current.effectiveDate)) {
    return { ok: false, error: 'The current salary date is not usable. Fix the data before changing pay.' }
  }

  const effectiveDate = input.proposed.effectiveDate
  if (effectiveDate < input.hireDate) {
    return { ok: false, error: 'Effective date is before this person\'s hire date.' }
  }
  if (effectiveDate > addDays(input.today, 90)) {
    return { ok: false, error: 'Effective date is more than 90 days out. Pick a closer date.' }
  }
  if (effectiveDate < input.current.effectiveDate) {
    return {
      ok: false,
      error: 'Effective date is before the current salary started. This app doesn\'t rewrite older rows.',
    }
  }

  const note = input.proposed.note.trim()
  if (note.length > 500) {
    return { ok: false, error: 'Note is too long (500 characters).' }
  }

  const reduced = amount < input.current.annualMinor
  if (reason === 'promotion' && reduced) {
    return { ok: false, error: 'A promotion can\'t reduce base pay.' }
  }
  if (reduced && note.length < 8) {
    return { ok: false, error: 'Lowering base pay needs a note of at least 8 characters.' }
  }

  if (effectiveDate === input.current.effectiveDate) {
    return { ok: true, mode: 'replace', annualMinor: amount, effectiveDate, reason, note }
  }

  return {
    ok: true,
    mode: 'append',
    annualMinor: amount,
    effectiveDate,
    reason,
    note,
    closeEndDate: addDays(effectiveDate, -1),
  }
}
