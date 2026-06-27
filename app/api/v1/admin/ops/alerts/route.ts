import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET ops/alerts?status=FIRING&limit=50  -> alert events + open count */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200)

  const where: Record<string, unknown> = {}
  if (status === "FIRING" || status === "RESOLVED") where.status = status

  const [events, firing] = await Promise.all([
    prisma.alertEvent.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { rule: { select: { name: true } } },
    }),
    prisma.alertEvent.count({ where: { status: "FIRING" } }),
  ])
  return { events, firing }
})

const ackSchema = z.object({ id: z.string().min(1) })

/** POST ops/alerts  { id }  -> acknowledge a firing alert */
export const POST = route(async (req: Request) => {
  await requireAdmin()
  const body = ackSchema.parse(await req.json())
  const updated = await prisma.alertEvent.update({
    where: { id: body.id },
    data: { acked: true },
  })
  return { id: updated.id, acked: updated.acked }
})
