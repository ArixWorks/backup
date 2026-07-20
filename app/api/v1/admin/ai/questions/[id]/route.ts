import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { moderateQuestion } from "@/lib/core/product-qa"

export const PATCH = route(async (req: Request, context: { params: Promise<{ id: string }> }) => {
  const [admin, params, payload] = await Promise.all([requireAdmin(), context.params, req.json()])
  return moderateQuestion(params.id, payload, admin.id)
})
