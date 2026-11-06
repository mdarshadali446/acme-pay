import express, { type NextFunction, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import { employeesToCsv } from '../src/domain/csv.ts'
import { localIsoDate } from '../src/domain/dates.ts'
import { MIN_GENDER_CELL, countBandPositions, genderComparisons, summarizeByLevel } from '../src/domain/stats.ts'
import { changeSalary } from '../src/db/change.ts'
import { listEmployees, listEmployeesForExport, listOutliers, loadQuestionRows, payrollSummary, getEmployee } from '../src/db/queries.ts'
import { COUNTRIES, DEPARTMENTS, LEVELS, countryByCode } from '../src/reference.ts'
import { DEMO_PASSWORD, clearSession, hasSession, issueSession, passwordMatches, type SessionStore } from './auth.ts'

export type AppOptions = {
  password?: string
  now?: () => Date
  clientDir?: string
}

function resolvePassword(explicit: string | undefined): string {
  if (explicit) return explicit
  if (process.env.HR_PASSWORD) return process.env.HR_PASSWORD
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Set HR_PASSWORD before starting in production.')
  }
  return DEMO_PASSWORD
}

function clientDirectory(explicit?: string): string | null {
  if (explicit) return explicit
  const here = path.dirname(fileURLToPath(import.meta.url))
  const besideBundle = path.join(here, 'client')
  if (fs.existsSync(path.join(besideBundle, 'index.html'))) return besideBundle
  const fromSource = path.join(here, '..', 'dist', 'client')
  if (fs.existsSync(path.join(fromSource, 'index.html'))) return fromSource
  return null
}

export function createApp(db: DatabaseSync, options: AppOptions = {}) {
  const password = resolvePassword(options.password)
  const now = options.now ?? (() => new Date())
  const sessions: SessionStore = new Map()
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    next()
  })
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, passwordHint: password === DEMO_PASSWORD ? DEMO_PASSWORD : null })
  })

  app.post('/api/login', (req, res) => {
    const given = req.body?.password
    if (typeof given !== 'string' || given.length === 0 || given.length > 200) {
      res.status(400).json({ error: 'Enter the HR password.' })
      return
    }
    if (!passwordMatches(given, password)) {
      res.status(401).json({ error: 'Wrong password.' })
      return
    }
    issueSession(sessions, res, now().getTime())
    res.json({ ok: true })
  })

  app.post('/api/logout', (req, res) => {
    clearSession(sessions, req, res)
    res.json({ ok: true })
  })

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!hasSession(sessions, req, now().getTime())) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }
    next()
  })

  app.get('/api/meta', (_req, res) => {
    res.json({
      today: localIsoDate(now()),
      countries: COUNTRIES.map((country) => ({
        code: country.code,
        name: country.name,
        currency: country.currency,
      })),
      departments: DEPARTMENTS.map((department) => department.name),
      levels: LEVELS,
    })
  })

  app.get('/api/summary', (_req, res) => {
    res.json(payrollSummary(db, localIsoDate(now())))
  })

  app.get('/api/questions', (_req, res) => {
    const rows = loadQuestionRows(db)
    const gender = genderComparisons(rows)
    res.json({
      outsideBand: countBandPositions(rows),
      outliers: listOutliers(db, 8),
      byLevel: summarizeByLevel(rows, LEVELS),
      gender: {
        minCell: MIN_GENDER_CELL,
        suppressed: gender.suppressed,
        rows: gender.shown.map((row) => ({
          ...row,
          countryName: countryByCode(row.countryCode)?.name ?? row.countryCode,
        })),
      },
    })
  })

  app.get('/api/employees.csv', (req, res) => {
    const rows = listEmployeesForExport(db, readDirectoryQuery(req))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="acme-pay.csv"')
    res.send(employeesToCsv(rows))
  })

  app.get('/api/employees', (req, res) => {
    res.json(listEmployees(db, readDirectoryQuery(req)))
  })

  app.get('/api/employees/:id', (req, res) => {
    const id = readId(req.params.id)
    if (id == null) {
      res.status(404).json({ error: 'Employee not found.' })
      return
    }
    const detail = getEmployee(db, id)
    if (!detail) {
      res.status(404).json({ error: 'Employee not found.' })
      return
    }
    res.json(detail)
  })

  app.post('/api/employees/:id/salary', (req, res) => {
    const id = readId(req.params.id)
    if (id == null) {
      res.status(404).json({ error: 'Employee not found.' })
      return
    }
    const body = req.body as Record<string, unknown> | undefined
    if (!body || typeof body.amount !== 'string' || typeof body.effectiveDate !== 'string') {
      res.status(400).json({ error: 'Amount and effective date are required.' })
      return
    }
    const reason = typeof body.reason === 'string' ? body.reason : ''
    const note = typeof body.note === 'string' ? body.note : ''
    const clock = now()
    const result = changeSalary(
      db,
      id,
      { amount: body.amount, effectiveDate: body.effectiveDate, reason, note },
      localIsoDate(clock),
      clock.toISOString(),
    )
    if (!result.ok) {
      res.status(result.status).json({ error: result.error })
      return
    }
    res.json(result.detail)
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' })
  })

  const clientDir = clientDirectory(options.clientDir)
  if (clientDir) {
    app.use(express.static(clientDir))
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'))
    })
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error)
    if (res.headersSent) return
    res.status(500).json({ error: 'Something went wrong on the server.' })
  })

  return app
}

function readId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  return Number(value)
}

function queryString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function readDirectoryQuery(req: Request) {
  const page = Number(req.query.page)
  const pageSize = Number(req.query.pageSize)
  return {
    q: queryString(req.query.q),
    country: queryString(req.query.country),
    department: queryString(req.query.department),
    level: queryString(req.query.level),
    status: queryString(req.query.status),
    band: queryString(req.query.band),
    page: Number.isFinite(page) ? page : undefined,
    pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
  }
}
