import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { claimMission } from "@/lib/core/gamification"
import { ValidationError } from "@/lib/core/errors"

const schema = z.object({ missionId: z.string().min(1) })

/** Claim the reward points for a completed mission in the current period. */
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const { missionId } = schema.parse(await req.json())
  const result = await claimMission(user.id, missionId)
  if (!result.ok) {
    throw new ValidationError(
      result.reason === "already_claimed"
        ? "این پاداش قبلاً دریافت شده است."
        : "این مأموریت هنوز کامل نشده است.",
    )
  }
  return { points: result.points }
})
