export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function parse(res: Response) {
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new ApiError(
      json?.error?.message ?? 'خطای ناشناخته',
      json?.error?.code ?? 'UNKNOWN',
      res.status,
    )
  }
  return json
}

export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  return parse(res)
}

export async function apiPost<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parse(res)
}

export async function apiPut<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parse(res)
}

export async function apiPatch<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parse(res)
}

export async function apiDelete<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
  return parse(res)
}

export const fetcher = (url: string) => apiGet(url)
