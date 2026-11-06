import fs from 'node:fs'
import path from 'node:path'
import { openDatabase } from '../src/db/database.ts'
import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 3001)
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'acme.db')

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Run npm run seed first.`)
  process.exit(1)
}

const db = openDatabase(dbPath)
const app = createApp(db)
app.listen(port, '0.0.0.0', () => {
  console.log(`ACME Pay API on http://127.0.0.1:${port}`)
})
