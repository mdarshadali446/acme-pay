import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api'

export function LoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/health')
      .then((response) => response.json())
      .then((body: { passwordHint?: string | null }) => setHint(body.passwordHint ?? null))
      .catch(() => setHint(null))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="standalone">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">ACME org</p>
        <h1>Pay desk</h1>
        <p className="lede">Base salary for the HR manager. Not payroll, not bonuses.</p>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {hint ? <p className="hint">This demo is still using the default password: {hint}</p> : null}
        {error ? <p className="banner">{error}</p> : null}
        <button type="submit" disabled={busy || password.length === 0}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
