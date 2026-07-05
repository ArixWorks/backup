import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Durable AI memory store. Entries are namespaced by (scope, scopeId) — e.g.
 * per-user preferences (scope="user"), per-conversation context
 * (scope="conversation"), or global facts (scope="global"). Optional soft
 * expiry supports transient memories. Backs future personalization + agents.
 */

export interface MemoryScope {
  scope?: string
  scopeId?: string
}

export async function rememberValue(
  key: string,
  value: Prisma.InputJsonValue,
  opts: MemoryScope & { expiresInSec?: number } = {},
): Promise<void> {
  const scope = opts.scope ?? "global"
  const scopeId = opts.scopeId ?? "global"
  const expiresAt = opts.expiresInSec ? new Date(Date.now() + opts.expiresInSec * 1000) : null
  await prisma.aiMemory.upsert({
    where: { scope_scopeId_key: { scope, scopeId, key } },
    create: { scope, scopeId, key, value, expiresAt },
    update: { value, expiresAt },
  })
}

export async function recallValue<T = unknown>(
  key: string,
  opts: MemoryScope = {},
): Promise<T | null> {
  const scope = opts.scope ?? "global"
  const scopeId = opts.scopeId ?? "global"
  const row = await prisma.aiMemory.findUnique({
    where: { scope_scopeId_key: { scope, scopeId, key } },
  })
  if (!row) return null
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null
  return row.value as T
}

export async function listMemories(opts: MemoryScope = {}): Promise<
  { key: string; value: unknown; updatedAt: Date }[]
> {
  const scope = opts.scope ?? "global"
  const scopeId = opts.scopeId ?? "global"
  const rows = await prisma.aiMemory.findMany({
    where: {
      scope,
      scopeId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { updatedAt: "desc" },
  })
  return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt }))
}

export async function forgetValue(key: string, opts: MemoryScope = {}): Promise<void> {
  const scope = opts.scope ?? "global"
  const scopeId = opts.scopeId ?? "global"
  await prisma.aiMemory.deleteMany({ where: { scope, scopeId, key } })
}

/** Housekeeping: drop expired memories (call from cron). */
export async function purgeExpiredMemories(): Promise<number> {
  const res = await prisma.aiMemory.deleteMany({
    where: { expiresAt: { not: null, lt: new Date() } },
  })
  return res.count
}
