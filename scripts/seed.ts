import fs from 'node:fs'
import path from 'node:path'
import { openDatabase } from '../src/db/database.ts'
import { generateOrg } from '../src/db/generate.ts'
import { insertBands, insertOrg } from '../src/db/load.ts'
import { applySchema } from '../src/db/schema.ts'

const SNAPSHOT = '2026-11-06'
const COUNT = 10_000
const SEED = 20261106

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'acme.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })
for (const suffix of ['', '-wal', '-shm']) {
  const file = suffix ? `${dbPath}${suffix}` : dbPath
  if (fs.existsSync(file)) fs.rmSync(file)
}

const started = Date.now()
const db = openDatabase(dbPath)
applySchema(db)
const people = generateOrg({ count: COUNT, seed: SEED, asOf: SNAPSHOT })
insertBands(db)
insertOrg(db, people)

const byCountry = new Map<string, number>()
let openRows = 0
for (const person of people) {
  byCountry.set(person.countryCode, (byCountry.get(person.countryCode) ?? 0) + 1)
  openRows += person.records.some((record) => record.endDate == null) ? 1 : 0
}

console.log(`Seeded ${people.length} employees (${openRows} open salaries) in ${Date.now() - started}ms`)
console.log(`Database: ${dbPath}`)
for (const [country, count] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${country}  ${count}`)
}
db.close()
