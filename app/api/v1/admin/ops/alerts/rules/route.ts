import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { METRICS } from "@/lib/monitoring/registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const metricNames = METRICS.map((m) => m.name)

const channelSchema = z.array(z.enum(["telegram", "email", "dashboard"])).min(1)

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  metric: z.string().refine((v) => metricNames.includes(v), "متریک نامعتبر است"),
  comparator: z.enum(["GT", "LT"]).default("GT"),
  threshold: z.number().finite(),
  forSeconds: z.number().int().min(0).max(86_400).default(0),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).default("WARNING"),
  channels: channelSchema.default(["dashboard"]),
  enabled: z.boolean().default(true),
  cooldownSeconds: z.number().int().min(0).max(86_400).default(900),
})

/** GET ops/alerts/rules -> all rules */
export const GET = route(async () => {
  await requireAdmin()
  const rules = await prisma.alertRule.findMany({ orderBy: { createdAt: "desc" } })
  return { rules }
})

/** POST ops/alerts/rules -> create a rule */
export const POST = route(async (req: Request) => {
  await requireAdmin()
  const body = ruleSchema.parse(await req.json())
  const rule = await prisma.alertRule.create({
    data: { ...body, channels: body.channels },
  })
  return rule
})

const updateSchema = ruleSchema.partial().extend({ id: z.string().min(1) })

/** PATCH ops/alerts/rules -> update a rule */
export const PATCH = route(async (req: Request) => {
  await requireAdmin()
  const { id, ...rest } = updateSchema.parse(await req.json())
  const rule = await prisma.alertRule.update({ where: { id }, data: rest })
  return rule
})

/** DELETE ops/alerts/rules?id=... -> remove a rule */
export const DELETE = route(async (req: Request) => {
  await requireAdmin()
  const id = new URL(req.url).searchParams.get("id")
  if (!id) {
    const { ValidationError } = await import("@/lib/core/errors")
    throw new ValidationError("شناسه قانون لازم است")
  }
  await prisma.alertRule.delete({ where: { id } })
  return { id }
})
