import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  status: z.string().optional(),
  template: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

/** Paginated, filterable email log (most recent first). */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const { status, template, q, page, pageSize } = querySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  )

  const where: Prisma.EmailJobWhereInput = {}
  if (status) where.status = status as Prisma.EmailJobWhereInput["status"]
  if (template) where.template = template as Prisma.EmailJobWhereInput["template"]
  if (q) {
    where.OR = [
      { to: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { providerId: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.emailJob.count({ where }),
    prisma.emailJob.findMany({
      where,
      orderBy: { queuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        to: true,
        subject: true,
        template: true,
        sender: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        providerId: true,
        openCount: true,
        clickCount: true,
        queuedAt: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
      },
    }),
  ])

  return { total, page, pageSize, items }
})
