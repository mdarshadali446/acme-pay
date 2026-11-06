import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'

const SESSION_MS = 12 * 60 * 60 * 1000

export type SessionStore = Map<string, number>

export function passwordMatches(input: string, expected: string): boolean {
  const salt = 'acme-pay-login'
  const left = scryptSync(input, salt, 32)
  const right = scryptSync(expected, salt, 32)
  return timingSafeEqual(left, right)
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function issueSession(store: SessionStore, res: Response, now: number): void {
  const token = randomBytes(32).toString('hex')
  store.set(token, now + SESSION_MS)
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`)
}

export function clearSession(store: SessionStore, req: Request, res: Response): void {
  const token = readCookie(req.headers.cookie, 'sid')
  if (token) store.delete(token)
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
}

export function hasSession(store: SessionStore, req: Request, now: number): boolean {
  const token = readCookie(req.headers.cookie, 'sid')
  if (!token) return false
  const expires = store.get(token)
  if (!expires || expires <= now) {
    if (token) store.delete(token)
    return false
  }
  return true
}

export const DEMO_PASSWORD = 'pay-ledger'
