export type EmploymentStatus = 'active' | 'leave' | 'terminated'
export type Gender = 'female' | 'male' | 'undisclosed'
export type BandPosition = 'below' | 'within' | 'above'
export type SalaryReason = 'hire' | 'adjustment' | 'promotion' | 'correction'
export type DirectoryStatus = 'paid' | 'active' | 'leave' | 'terminated' | 'all'

export type EmployeeListItem = {
  id: number
  employeeCode: string
  fullName: string
  workEmail: string
  countryCode: string
  countryName: string
  department: string
  jobTitle: string
  jobLevel: string
  employmentStatus: EmploymentStatus
  hireDate: string
  terminationDate: string | null
  currency: string
  annualMinor: number
  effectiveDate: string
  endDate: string | null
  reason: SalaryReason
  compaRatio: number
  bandPosition: BandPosition
  bandMinMinor: number
  bandMidMinor: number
  bandMaxMinor: number
}

export type SalaryHistoryItem = {
  id: number
  annualMinor: number
  currency: string
  effectiveDate: string
  endDate: string | null
  reason: SalaryReason
  note: string
  recordedAt: string
}

export type EmployeeDetail = {
  employee: EmployeeListItem
  history: SalaryHistoryItem[]
}

export type EmployeeListResponse = {
  total: number
  page: number
  pageSize: number
  rows: EmployeeListItem[]
}

export type CurrencyTotal = {
  currency: string
  people: number
  payrollMinor: number
  medianMinor: number
}

export type CountryTotal = {
  countryCode: string
  countryName: string
  currency: string
  active: number
  leave: number
  terminated: number
  payrollMinor: number
  medianMinor: number
}

export type SummaryResponse = {
  today: string
  headcount: { active: number; leave: number; terminated: number }
  outsideBand: { below: number; above: number; within: number }
  byCurrency: CurrencyTotal[]
  byCountry: CountryTotal[]
}

export type Outlier = {
  id: number
  employeeCode: string
  fullName: string
  countryCode: string
  countryName: string
  department: string
  jobLevel: string
  currency: string
  annualMinor: number
  bandMinMinor: number
  bandMaxMinor: number
  bandPosition: 'below' | 'above'
  gapMinor: number
}

export type QuestionsResponse = {
  outsideBand: { below: number; above: number; within: number }
  outliers: Outlier[]
  byLevel: {
    currency: string
    level: string
    people: number
    medianMinor: number
    lowMinor: number
    highMinor: number
  }[]
  gender: {
    minCell: number
    suppressed: number
    rows: {
      countryCode: string
      countryName: string
      jobLevel: string
      currency: string
      women: number
      men: number
      womenMedianMinor: number
      menMedianMinor: number
      gapRatio: number
    }[]
  }
}
