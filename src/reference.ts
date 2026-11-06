export const LEVELS = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'M1', 'M2', 'M3'] as const

export type Level = (typeof LEVELS)[number]

export type Country = {
  code: string
  name: string
  currency: string
  weight: number
}

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', currency: 'INR', weight: 30 },
  { code: 'US', name: 'United States', currency: 'USD', weight: 25 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', weight: 10 },
  { code: 'DE', name: 'Germany', currency: 'EUR', weight: 8 },
  { code: 'CA', name: 'Canada', currency: 'CAD', weight: 7 },
  { code: 'AU', name: 'Australia', currency: 'AUD', weight: 7 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', weight: 7 },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', weight: 6 },
]

export const DEPARTMENTS: { name: string; weight: number }[] = [
  { name: 'Engineering', weight: 34 },
  { name: 'Product', weight: 8 },
  { name: 'Design', weight: 5 },
  { name: 'Sales', weight: 16 },
  { name: 'Marketing', weight: 7 },
  { name: 'Customer Success', weight: 10 },
  { name: 'People', weight: 5 },
  { name: 'Finance', weight: 6 },
  { name: 'Legal', weight: 3 },
  { name: 'Operations', weight: 6 },
]

const TITLES: Record<string, Record<Level, string>> = {
  Engineering: {
    IC1: 'Associate Engineer',
    IC2: 'Engineer',
    IC3: 'Senior Engineer',
    IC4: 'Staff Engineer',
    IC5: 'Senior Staff Engineer',
    IC6: 'Principal Engineer',
    M1: 'Engineering Manager',
    M2: 'Senior Engineering Manager',
    M3: 'Director of Engineering',
  },
  Product: {
    IC1: 'Associate Product Manager',
    IC2: 'Product Manager',
    IC3: 'Senior Product Manager',
    IC4: 'Staff Product Manager',
    IC5: 'Senior Staff Product Manager',
    IC6: 'Principal Product Manager',
    M1: 'Product Manager, Group',
    M2: 'Senior Product Director',
    M3: 'Director of Product',
  },
  Design: {
    IC1: 'Associate Designer',
    IC2: 'Designer',
    IC3: 'Senior Designer',
    IC4: 'Staff Designer',
    IC5: 'Senior Staff Designer',
    IC6: 'Principal Designer',
    M1: 'Design Manager',
    M2: 'Senior Design Manager',
    M3: 'Director of Design',
  },
  Sales: {
    IC1: 'Sales Development Rep',
    IC2: 'Account Executive',
    IC3: 'Senior Account Executive',
    IC4: 'Enterprise Account Executive',
    IC5: 'Strategic Account Executive',
    IC6: 'Principal Account Executive',
    M1: 'Sales Manager',
    M2: 'Senior Sales Manager',
    M3: 'Director of Sales',
  },
  Marketing: {
    IC1: 'Marketing Coordinator',
    IC2: 'Marketing Specialist',
    IC3: 'Senior Marketing Specialist',
    IC4: 'Marketing Lead',
    IC5: 'Senior Marketing Lead',
    IC6: 'Principal Marketer',
    M1: 'Marketing Manager',
    M2: 'Senior Marketing Manager',
    M3: 'Director of Marketing',
  },
  'Customer Success': {
    IC1: 'Support Associate',
    IC2: 'Customer Success Manager',
    IC3: 'Senior Customer Success Manager',
    IC4: 'Staff Customer Success Manager',
    IC5: 'Senior Staff CSM',
    IC6: 'Principal CSM',
    M1: 'Customer Success Manager, Team',
    M2: 'Senior CS Manager',
    M3: 'Director of Customer Success',
  },
  People: {
    IC1: 'People Coordinator',
    IC2: 'People Partner',
    IC3: 'Senior People Partner',
    IC4: 'Staff People Partner',
    IC5: 'Senior Staff People Partner',
    IC6: 'Principal People Partner',
    M1: 'People Manager',
    M2: 'Senior People Manager',
    M3: 'Director of People',
  },
  Finance: {
    IC1: 'Finance Analyst',
    IC2: 'Financial Analyst',
    IC3: 'Senior Financial Analyst',
    IC4: 'Finance Lead',
    IC5: 'Senior Finance Lead',
    IC6: 'Principal Finance Partner',
    M1: 'Finance Manager',
    M2: 'Senior Finance Manager',
    M3: 'Director of Finance',
  },
  Legal: {
    IC1: 'Legal Assistant',
    IC2: 'Counsel',
    IC3: 'Senior Counsel',
    IC4: 'Lead Counsel',
    IC5: 'Senior Lead Counsel',
    IC6: 'Principal Counsel',
    M1: 'Legal Manager',
    M2: 'Senior Legal Manager',
    M3: 'General Counsel',
  },
  Operations: {
    IC1: 'Operations Associate',
    IC2: 'Operations Specialist',
    IC3: 'Senior Operations Specialist',
    IC4: 'Operations Lead',
    IC5: 'Senior Operations Lead',
    IC6: 'Principal Operations Partner',
    M1: 'Operations Manager',
    M2: 'Senior Operations Manager',
    M3: 'Director of Operations',
  },
}

// Annual midpoint in major units. Min is 80% and max is 125%, applied in bandFor.
// These are local pay bands, not a conversion of the US band.
const BAND_MID: Record<string, Record<Level, number>> = {
  US: { IC1: 65000, IC2: 85000, IC3: 110000, IC4: 140000, IC5: 175000, IC6: 210000, M1: 150000, M2: 185000, M3: 230000 },
  IN: { IC1: 800000, IC2: 1400000, IC3: 2200000, IC4: 3200000, IC5: 4500000, IC6: 6000000, M1: 3500000, M2: 5000000, M3: 7000000 },
  GB: { IC1: 35000, IC2: 48000, IC3: 65000, IC4: 82000, IC5: 100000, IC6: 125000, M1: 90000, M2: 115000, M3: 145000 },
  DE: { IC1: 45000, IC2: 58000, IC3: 72000, IC4: 88000, IC5: 105000, IC6: 125000, M1: 95000, M2: 115000, M3: 140000 },
  CA: { IC1: 60000, IC2: 78000, IC3: 98000, IC4: 120000, IC5: 145000, IC6: 170000, M1: 130000, M2: 155000, M3: 185000 },
  AU: { IC1: 70000, IC2: 90000, IC3: 115000, IC4: 140000, IC5: 165000, IC6: 195000, M1: 150000, M2: 180000, M3: 210000 },
  SG: { IC1: 48000, IC2: 70000, IC3: 96000, IC4: 125000, IC5: 155000, IC6: 190000, M1: 140000, M2: 175000, M3: 220000 },
  AE: { IC1: 120000, IC2: 180000, IC3: 240000, IC4: 300000, IC5: 380000, IC6: 460000, M1: 320000, M2: 420000, M3: 520000 },
}

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code)
}

export function jobTitle(department: string, level: Level): string {
  return TITLES[department][level]
}

export type Band = {
  countryCode: string
  jobLevel: Level
  currency: string
  minMinor: number
  midMinor: number
  maxMinor: number
}

export function bandFor(countryCode: string, level: Level): Band {
  const country = countryByCode(countryCode)
  if (!country) throw new Error(`Unknown country ${countryCode}`)
  const mid = BAND_MID[countryCode][level]
  const min = Math.round(mid * 0.8)
  const max = Math.round(mid * 1.25)
  return {
    countryCode,
    jobLevel: level,
    currency: country.currency,
    minMinor: min * 100,
    midMinor: mid * 100,
    maxMinor: max * 100,
  }
}

export function allBands(): Band[] {
  const bands: Band[] = []
  for (const country of COUNTRIES) {
    for (const level of LEVELS) bands.push(bandFor(country.code, level))
  }
  return bands
}
