import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type Tx = Prisma.TransactionClient

export interface AuditInput {
  actorId?: string | null
  action: string
  entity: string
  entityId?: string | null
  meta?: Prisma.InputJsonValue
}

/**
 * Append an immutable audit record. Pass a transaction client to keep the
 * audit entry atomic with the mutation it describes.
 */
export async function audit(input: AuditInput, db: Tx = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      meta: input.meta,
    },
  })
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { displayName: true, alias: true, role: true } } },
  })
}
