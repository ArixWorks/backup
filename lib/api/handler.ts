import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { DomainError, TooManyRequestsError } from "@/lib/core/errors"
import { serialize } from "@/lib/serialize"
import { recordRequest } from "@/lib/monitoring/metrics"
import { captureError } from "@/lib/monitoring/errors"
import { enforceTestAccountMutationBoundary } from "@/lib/auth/test-account"

/** Best-effort extraction of a low-cardinality route label from handler args. */
function routeLabel(args: unknown[]): string | undefined {
  try {
    const req = args[0] as { method?: string; nextUrl?: { pathname?: string }; url?: string }
    const pathname = req?.nextUrl?.pathname ?? (req?.url ? new URL(req.url).pathname : undefined)
    if (!pathname) return undefined
    return `${req?.method ?? "GET"} ${pathname}`
  } catch {
    return undefined
  }
}

/**
 * Wrap a route handler so domain errors, validation errors and unexpected
 * errors are translated into consistent JSON responses. Keeps business logic
 * (which throws typed errors) decoupled from HTTP concerns.
 *
 * Also instruments every API call for the Operations Center: response time,
 * request/error counters, and automatic capture of unhandled (5xx) errors.
 */
export function route<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    const startedAt = Date.now()
    const label = routeLabel(args)
    try {
      const request = args[0]
      if (request instanceof Request) await enforceTestAccountMutationBoundary(request)
      const data = await fn(...args)
      void recordRequest({ ms: Date.now() - startedAt, ok: true, route: label })
      return NextResponse.json({ ok: true, data: serialize(data) })
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        void recordRequest({ ms: Date.now() - startedAt, ok: false, route: label, status: err.status })
        return NextResponse.json(
          { ok: false, error: { code: err.code, message: err.message } },
          { status: err.status, headers: { "Retry-After": String(err.retryAfter) } },
        )
      }
      if (err instanceof DomainError) {
        // Expected/handled business errors are not counted as failures.
        void recordRequest({ ms: Date.now() - startedAt, ok: true, route: label, status: err.status })
        return NextResponse.json(
          { ok: false, error: { code: err.code, message: err.message } },
          { status: err.status },
        )
      }
      if (err instanceof ZodError) {
        void recordRequest({ ms: Date.now() - startedAt, ok: true, route: label, status: 422 })
        return NextResponse.json(
          { ok: false, error: { code: "VALIDATION", message: err.issues[0]?.message || "اطلاعات واردشده معتبر نیست.", issues: err.issues } },
          { status: 422 },
        )
      }
      console.log("[v0] Unhandled API error:", err)
      void recordRequest({ ms: Date.now() - startedAt, ok: false, route: label, status: 500 })
      void captureError({ error: err, source: "API", context: label ? { route: label } : undefined })
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL", message: "Internal server error" } },
        { status: 500 },
      )
    }
  }
}
