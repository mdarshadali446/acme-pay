import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/db/database.ts'
import { generateOrg } from '../src/db/generate.ts'
import { insertBands, insertOrg } from '../src/db/load.ts'
import { applySchema } from '../src/db/schema.ts'
import { createApp } from '../server/app.ts'

function testApp() {
  const db = openDatabase(':memory:')
  applySchema(db)
  insertBands(db)
  insertOrg(db, generateOrg({ count: 120, seed: 11, asOf: '2026-11-06' }))
  const app = createApp(db, {
    password: 'pay-ledger',
    now: () => new Date(2026, 10, 6, 15, 0, 0),
  })
  return { app, db }
}

describe('HTTP API', () => {
  it('hides the demo password once a real one is configured', async () => {
    const { app } = testApp()
    const demo = await request(app).get('/api/health')
    expect(demo.body.passwordHint).toBe('pay-ledger')

    const custom = createApp(openDatabase(':memory:'), { password: 'something-else' })
    const hidden = await request(custom).get('/api/health')
    expect(hidden.body.passwordHint).toBeNull()
  })

  it('requires a session, then serves a person without their gender', async () => {
    const { app } = testApp()
    const locked = await request(app).get('/api/employees')
    expect(locked.status).toBe(401)

    const agent = request.agent(app)
    const bad = await agent.post('/api/login').send({ password: 'nope' })
    expect(bad.status).toBe(401)
    const good = await agent.post('/api/login').send({ password: 'pay-ledger' })
    expect(good.status).toBe(200)

    const found = await agent.get('/api/employees').query({ q: 'E10001', status: 'all' })
    expect(found.body.rows[0].employeeCode).toBe('E10001')
    expect(found.body.rows[0].gender).toBeUndefined()

    const detail = await agent.get(`/api/employees/${found.body.rows[0].id}`)
    expect(detail.status).toBe(200)
    expect(JSON.stringify(detail.body)).not.toContain('"gender"')

    const attacked = await agent.get('/api/employees').query({ q: "%' OR '1'='1", status: 'all' })
    const everyone = await agent.get('/api/employees').query({ status: 'all', pageSize: 100 })
    expect(attacked.body.total).toBeLessThan(everyone.body.total)

    const capped = await agent.get('/api/employees').query({ status: 'all', pageSize: 500 })
    expect(capped.body.pageSize).toBe(100)
    expect(capped.body.rows.length).toBeLessThanOrEqual(100)
  })

  it('rejects a promotion cut and exports the filtered directory', async () => {
    const { app, db } = testApp()
    const agent = request.agent(app)
    await agent.post('/api/login').send({ password: 'pay-ledger' })

    const row = db
      .prepare(
        `SELECT e.id, s.annual_minor FROM employees e
         JOIN salary_records s ON s.employee_id = e.id AND s.end_date IS NULL
         WHERE e.employment_status = 'active' AND s.effective_date < '2026-11-06'
         LIMIT 1`,
      )
      .get() as { id: number | bigint; annual_minor: number | bigint }
    const lower = (Number(row.annual_minor) / 100 - 500).toFixed(2)
    const blocked = await agent.post(`/api/employees/${Number(row.id)}/salary`).send({
      amount: lower,
      effectiveDate: '2026-11-06',
      reason: 'promotion',
      note: 'This should not land',
    })
    expect(blocked.status).toBe(400)

    const terminated = db.prepare(`SELECT id FROM employees WHERE employment_status = 'terminated' LIMIT 1`).get() as {
      id: number | bigint
    }
    const frozen = await agent.post(`/api/employees/${Number(terminated.id)}/salary`).send({
      amount: '1000',
      effectiveDate: '2026-11-06',
      reason: 'adjustment',
      note: '',
    })
    expect(frozen.status).toBe(400)

    db.prepare(`UPDATE employees SET full_name = ? WHERE id = ?`).run('Doe, Jane "JJ"', Number(row.id))
    const csv = await agent.get('/api/employees.csv').query({ status: 'all', q: 'Doe, Jane' })
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.text.startsWith('\uFEFF')).toBe(true)
    expect(csv.text).toContain('"Doe, Jane ""JJ"""')

    const questions = await agent.get('/api/questions')
    expect(questions.status).toBe(200)
    expect(questions.body.outsideBand.below + questions.body.outsideBand.within + questions.body.outsideBand.above).toBeGreaterThan(0)
  })
})
