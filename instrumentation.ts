import type { Instrumentation } from "next"

/**
 * Next.js instrumentation entry point.
 *
 * `register()` runs once when the server boots. `onRequestError` is invoked by
 * Next for every uncaught error in Server Components, route handlers, server
 * actions and middleware — giving the Operations Center full server-side error
 * coverage without touching each call site.
 *
 * Both Sentry init and our capture pipeline are loaded dynamically so builds
 * without Sentry configured never bundle/init it.
 */

export async function register(): Promise<void> {
  // Initialize Sentry server SDK only when a DSN is configured. Works for both
  // Sentry Cloud and a self-hosted instance (DSN-driven).
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (dsn && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    })
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  // Only run in the Node runtime (Prisma/DB tracker is not edge-compatible).
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  try {
    const { captureError } = await import("@/lib/monitoring/errors")
    // Map Next's router context to our ErrorSource taxonomy.
    const kind = (context as { routerKind?: string }).routerKind
    const routeType = (context as { routeType?: string }).routeType
    const source =
      routeType === "route"
        ? "API"
        : routeType === "action"
          ? "SERVER_ACTION"
          : "WEB"
    await captureError({
      error: err,
      source,
      context: {
        path: request.path,
        method: request.method,
        routerKind: kind,
        routeType,
      },
    })
  } catch {
    // never throw from instrumentation
  }
}
