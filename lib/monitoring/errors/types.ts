import type { ErrorSource } from "@prisma/client"

/**
 * Normalized error payload captured from anywhere in the ecosystem.
 * Provider-agnostic so the same call site works for the DB tracker and Sentry.
 */
export type CapturedError = {
  error: unknown
  source: ErrorSource
  level?: "fatal" | "error" | "warning" | "info"
  /** Stable-ish grouping hint; if omitted we derive one from source+name+message. */
  fingerprint?: string
  message?: string
  context?: Record<string, unknown>
  userId?: string | null
  release?: string | null
  /** Breadcrumb-style trail leading up to the error (forwarded to Sentry). */
  breadcrumbs?: { category?: string; message: string; data?: Record<string, unknown> }[]
}

/**
 * A monitoring backend. Implementations must never throw — capturing an error
 * is best-effort and must not break the request that produced the error.
 */
export interface ErrorTracker {
  readonly name: string
  capture(input: CapturedError): Promise<void>
  /** Optional: flush buffered events (Sentry on serverless). */
  flush?(timeoutMs?: number): Promise<void>
}

/** Extract a readable {name, message, stack} from any thrown value. */
export function describeError(error: unknown): {
  name: string
  message: string
  stack?: string
} {
  if (error instanceof Error) {
    return { name: error.name || "Error", message: error.message, stack: error.stack }
  }
  if (typeof error === "string") return { name: "Error", message: error }
  try {
    return { name: "NonError", message: JSON.stringify(error) }
  } catch {
    return { name: "NonError", message: String(error) }
  }
}

/**
 * Build a deterministic grouping fingerprint. Numbers, UUIDs, hex ids and
 * quoted values are masked so the same logical error groups together even when
 * the message embeds dynamic data.
 */
export function buildFingerprint(source: string, name: string, message: string): string {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/"[^"]*"/g, '"<v>"')
    .replace(/'[^']*'/g, "'<v>'")
    .slice(0, 200)
  return `${source}:${name}:${normalized}`
}
