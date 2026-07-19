import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { ForbiddenError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

/** Disabled until the complete multi-currency payment lifecycle is production-ready. */
export const POST = route(async () => {
  await requireUser()
  throw new ForbiddenError("تبدیل ارز در حال حاضر غیرفعال است")
})
