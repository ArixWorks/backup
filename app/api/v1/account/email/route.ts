import { z } from "zod"
import { requireUser } from "@/lib/auth/session"
import { startEmailVerification } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  email: z.string().email(),
  // Optional password for the Telegram-only "Add Email & Password" flow.
  password: z.string().min(8).max(128).optional(),
})

/** Start (or restart) email verification for the current account. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  const user = await requireUser()
  const body = schema.parse(await req.json())
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  return startEmailVerification({
    userId: user.id,
    email: body.email,
    password: body.password,
    origin,
  })
})
