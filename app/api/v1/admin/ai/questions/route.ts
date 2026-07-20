import type { ProductQuestionStatus } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { countQuestionsNeedingReview, listQuestionsAdmin } from "@/lib/core/product-qa"

export const dynamic = "force-dynamic"

const STATUSES = new Set<ProductQuestionStatus>(["PENDING_AI", "PENDING_ADMIN", "ANSWERED", "REJECTED", "HIDDEN"])

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const params = new URL(req.url).searchParams
  if (params.get("summary") === "1") {
    return { pending: await countQuestionsNeedingReview() }
  }
  const rawStatus = params.get("status") as ProductQuestionStatus | null
  const status = rawStatus && STATUSES.has(rawStatus) ? rawStatus : undefined
  const search = params.get("search")?.trim().slice(0, 100) || undefined
  return listQuestionsAdmin(status, search)
})
