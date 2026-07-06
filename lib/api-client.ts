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

  let json: any = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // The server returned something that isn't JSON (an HTML error/redirect
      // page, a Vercel auth wall, a proxy 502, etc.). Surface a meaningful,
      // status-aware error instead of a cryptic "Unexpected token '<'".
      const message =
        res.status === 401 || res.status === 403
          ? 'نشست شما منقضی شده یا دسترسی ندارید. لطفاً دوباره وارد شوید.'
          : res.status === 404
            ? 'سرویس مورد نظر یافت نشد.'
            : res.status >= 500
              ? 'خطای سرور. لطفاً کمی بعد دوباره تلاش کنید.'
              : 'پاسخ نامعتبر از سرور دریافت شد. لطفاً دوباره وارد شوید یا صفحه را تازه‌سازی کنید.'
      throw new ApiError(message, 'INVALID_RESPONSE', res.status || 0)
    }
  }

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
