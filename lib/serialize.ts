import { NextResponse } from "next/server"

/**
 * Recursively converts BigInt values to strings and Date values to ISO strings
 * so domain objects (money stored as BigInt) can be returned as JSON safely.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return value.toString() as unknown as T
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v)
    }
    return out as T
  }
  return value
}

/** JSON response helper that safely serializes BigInt and Date values. */
export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serialize(data), init)
}
