import { ForbiddenError } from "@/lib/core/errors"
import { requireContentType } from "./registry"
import type { ContentCapability } from "./types"

/**
 * Capability check for a content type. Every ADMIN currently passes (the app
 * has a single admin role today), but this is the single choke point where
 * future granular / per-type roles plug in without touching call sites.
 */
export function can(
  actor: { role?: string | null },
  typeKey: string,
  action: ContentCapability,
): boolean {
  const def = requireContentType(typeKey)
  if (!def.permissions.includes(action)) return false
  return actor.role === "ADMIN"
}

export function assertCan(
  actor: { role?: string | null },
  typeKey: string,
  action: ContentCapability,
): void {
  if (!can(actor, typeKey, action)) {
    throw new ForbiddenError("شما اجازه انجام این عملیات را ندارید")
  }
}
