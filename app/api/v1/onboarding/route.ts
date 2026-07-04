import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * First-run onboarding status for the signed-in user. The client uses this to
 * decide whether to show the onboarding flow (language → tutorial → success).
 *
 * Forced-channel membership is handled separately by the channel gate
 * (GET /api/v1/channels/gate), so it is intentionally not part of this payload.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      needsOnboarding: !user.onboardedAt,
    },
  })
}
