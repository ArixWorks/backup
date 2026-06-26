import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { DomainError, TooManyRequestsError } from "@/lib/core/errors"
import { serialize } from "@/lib/serialize"

/**
 * Wrap a route handler so domain errors, validation errors and unexpected
 * errors are translated into consistent JSON responses. Keeps business logic
 * (which throws typed errors) decoupled from HTTP concerns.
 */
export function route<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      const data = await fn(...args)
      return NextResponse.json({ ok: true, data: serialize(data) })
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        return NextResponse.json(
          { ok: false, error: { code: err.code, message: err.message } },
          { status: err.status, headers: { "Retry-After": String(err.retryAfter) } },
        )
      }
      if (err instanceof DomainError) {
        return NextResponse.json(
          { ok: false, error: { code: err.code, message: err.message } },
          { status: err.status },
        )
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { ok: false, error: { code: "VALIDATION", message: "Invalid input", issues: err.issues } },
          { status: 422 },
        )
      }
      console.log("[v0] Unhandled API error:", err)
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL", message: "Internal server error" } },
        { status: 500 },
      )
    }
  }
}
