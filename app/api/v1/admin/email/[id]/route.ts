import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { retryEmailJob, cancelEmailJob } from "@/lib/email/queue"
import { NotFoundError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

/** Full detail for a single email job, including its lifecycle events. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const job = await prisma.emailJob.findUnique({
    where: { id },
    include: { events: { orderBy: { occurredAt: "desc" }, take: 50 } },
  })
  if (!job) throw new NotFoundError("ایمیل یافت نشد")
  return job
})

const actionSchema = z.object({ action: z.enum(["retry", "cancel"]) })

/** Retry a failed job or cancel a queued one. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const { action } = actionSchema.parse(await req.json())

  const res = action === "retry" ? await retryEmailJob(id) : await cancelEmailJob(id)
  await audit({
    actorId: admin.id,
    action: `email.${action}`,
    entity: "EmailJob",
    entityId: id,
  })
  return res
})
