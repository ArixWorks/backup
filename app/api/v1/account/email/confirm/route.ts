import { z } from "zod"
import { confirmEmail } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ token: z.string().min(10) })

/** Confirm an email verification token (called from the verify page). */
export const POST = route(async (req: Request) => {
  const body = schema.parse(await req.json())
  return confirmEmail(body.token)
})
