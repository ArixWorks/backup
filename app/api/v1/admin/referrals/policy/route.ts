import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getReferralPolicy, setReferralPolicy } from "@/lib/core/referral"

export const dynamic = "force-dynamic"

// Current Level-2 referral policy (falls back to the engine default).
export const GET = route(async () => {
  await requireAdmin()
  return getReferralPolicy()
})

// Partial policy update. Invariants (trigger level, receiver, wallet mode,
// direct-invite-no-reward) are re-enforced by the engine's normalize().
const patchSchema = z
  .object({
    enabled: z.boolean(),
    directInviteNotification: z.boolean(),
    secondLevelReward: z.boolean(),
    rewardAmount: z.number().int().min(0).max(1_000_000_000),
    currency: z.string().trim().min(1).max(8),
    requireMandatoryChannelMembership: z.boolean(),
    notifyInviterAfterChannelVerification: z.boolean(),
    activateSecondLevelOnlyAfterChannelVerification: z.boolean(),
    requireAntiAbuseApproval: z.boolean(),
    blockScoreThreshold: z.number().int().min(0).max(100),
    reviewScoreThreshold: z.number().int().min(0).max(100),
    flaggedAction: z.enum(["PENDING_REVIEW", "BLOCKED"]),
    minTriggerAccountAgeMin: z.number().int().min(0).max(100_000),
    minBeneficiaryAccountAgeMin: z.number().int().min(0).max(100_000),
    rewardCooldownSec: z.number().int().min(0).max(1_000_000),
    maxRewardsPerBeneficiaryPerDay: z.number().int().min(0).max(100_000),
    maxPerIpHash: z.number().int().min(1).max(1000),
    maxPerSubnetHash: z.number().int().min(1).max(1000),
    maxPerDeviceHash: z.number().int().min(1).max(1000),
  })
  .partial()

export const PUT = route(async (req: Request) => {
  await requireAdmin()
  const patch = patchSchema.parse(await req.json())
  return setReferralPolicy(patch)
})
