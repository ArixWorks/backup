import { requireUser } from "@/lib/auth/session"
import { linkTelegram, unlinkTelegram } from "@/lib/core/auth-account"
import { verifyLoginWidget, verifyInitData } from "@/lib/telegram/verify"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"
import { ValidationError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Link a Telegram identity to the current account. Accepts either a Login
 * Widget payload (web) or Mini App initData. The Telegram signature is verified
 * server-side before linking, and duplicate identities are rejected.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  const user = await requireUser()
  const body = (await req.json()) as Record<string, unknown>

  let result
  if (typeof body.initData === "string") {
    result = verifyInitData(body.initData)
  } else {
    result = verifyLoginWidget(body)
  }
  if (!result.ok || !result.user) {
    throw new ValidationError(result.reason || "اعتبارسنجی تلگرام ناموفق بود")
  }
  return linkTelegram(user.id, result.user)
})

/** Unlink the Telegram identity from the current account. */
export const DELETE = route(async (req: Request) => {
  assertSameOrigin(req)
  const user = await requireUser()
  return unlinkTelegram(user.id)
})
