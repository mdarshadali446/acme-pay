export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const text = await response.text()
  let body: { error?: string } = {}
  if (text) {
    try {
      body = JSON.parse(text) as { error?: string }
    } catch {
      throw new ApiError(response.status, 'The server sent a response I could not read.')
    }
  }
  if (!response.ok) throw new ApiError(response.status, body.error || 'Request failed.')
  return body as T
}
