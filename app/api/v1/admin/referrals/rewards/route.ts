import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import type { ReferralRewardStatus } from "@prisma/client"
import {
  listReferralRewards,
  referralRewardStatusCounts,
  approveReward,
  rejectReward,
  blockReward,
} from "@/lib/core/referral"

export const dynamic = "force-dynamic"

const STATUSES: ReferralRewardStatus[] = [
  "PENDING",
  "PENDING_REVIEW",
  "AUTO_APPROVED",
  "APPROVED",
  "REJECTED",
  "BLOCKED",
]

// Level-2 reward queue + per-status counts for the admin review panel.
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const statusParam = url.searchParams.get("status")
  const status = STATUSES.includes(statusParam as ReferralRewardStatus)
    ? (statusParam as ReferralRewardStatus)
    : undefined
  const [rewards, counts] = await Promise.all([
    listReferralRewards({ status }),
    referralRewardStatusCounts(),
  ])
  return { rewards, counts }
})

const actionSchema = z.object({
  rewardId: z.string().min(1),
  action: z.enum(["approve", "reject", "block"]),
  reason: z.string().trim().max(400).optional(),
})

// Approve → credit wallet · Reject → cancel · Block → mark abuse (no credit).
// All actions are audited inside the reward engine.
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { rewardId, action, reason } = actionSchema.parse(await req.json())

  let ok = false
  if (action === "approve") ok = await approveReward(rewardId, admin.id)
  else if (action === "reject") ok = await rejectReward(rewardId, admin.id, reason)
  else ok = await blockReward(rewardId, admin.id, reason)

  return { ok }
})
