import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ApiError, api } from './api'

export type Meta = {
  today: string
  countries: { code: string; name: string; currency: string }[]
  departments: string[]
  levels: string[]
}

const MetaContext = createContext<Meta | null>(null)

export function useMeta(): Meta {
  const meta = useContext(MetaContext)
  if (!meta) throw new Error('Meta is only available inside the signed-in shell')
  return meta
}

export function Shell() {
  const navigate = useNavigate()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Meta>('/api/meta')
      .then((next) => {
        if (!cancelled) setMeta(next)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        setError(err instanceof Error ? err.message : 'Could not reach the server.')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function logout() {
    await api('/api/logout', { method: 'POST' })
    navigate('/login', { replace: true })
  }

  if (error) {
    return (
      <main className="standalone">
        <p className="banner">{error}</p>
      </main>
    )
  }
  if (!meta) {
    return (
      <main className="standalone">
        <p className="muted">Loading the desk…</p>
      </main>
    )
  }

  return (
    <MetaContext.Provider value={meta}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <strong>ACME Pay</strong>
            <span>Salary desk</span>
          </div>
          <nav>
            <NavLink to="/" end>
              Overview
            </NavLink>
            <NavLink to="/employees">Directory</NavLink>
            <NavLink to="/questions">Questions</NavLink>
          </nav>
          <button type="button" className="text-button" onClick={() => void logout()}>
            Sign out
          </button>
        </aside>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </MetaContext.Provider>
  )
}
