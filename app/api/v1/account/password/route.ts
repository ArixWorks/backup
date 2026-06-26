import { z } from "zod"
import { requireUser } from "@/lib/auth/session"
import { changePassword } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

/** Change the password for a logged-in user. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  const user = await requireUser()
  const body = schema.parse(await req.json())
  return changePassword({
    userId: user.id,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  })
})
