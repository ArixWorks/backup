import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET ops/errors?resolved=0&source=API&limit=50 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const resolvedParam = url.searchParams.get("resolved")
  const source = url.searchParams.get("source")
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200)

  const where: Record<string, unknown> = {}
  if (resolvedParam === "0") where.resolved = false
  if (resolvedParam === "1") where.resolved = true
  if (source) where.source = source

  const [events, stats] = await Promise.all([
    prisma.errorEvent.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    }),
    prisma.errorEvent.groupBy({
      by: ["source"],
      where: { resolved: false },
      _sum: { count: true },
    }),
  ])

  const bySource = stats.map((s) => ({ source: s.source, count: s._sum.count ?? 0 }))
  const totalUnresolved = bySource.reduce((a, b) => a + b.count, 0)
  return { events, bySource, totalUnresolved }
})

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["resolve", "unresolve"]),
})

/** POST ops/errors  { id, action } */
export const POST = route(async (req: Request) => {
  await requireAdmin()
  const body = actionSchema.parse(await req.json())
  const resolved = body.action === "resolve"
  const updated = await prisma.errorEvent.update({
    where: { id: body.id },
    data: { resolved, resolvedAt: resolved ? new Date() : null },
  })
  return { id: updated.id, resolved: updated.resolved }
})
