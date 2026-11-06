import { DatabaseSync } from 'node:sqlite'

export function openDatabase(filename: string): DatabaseSync {
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON')
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
  }
  return db
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  throw new Error(`Expected a number from sqlite, got ${typeof value}`)
}
