import { route } from "@/lib/api/handler"
import { getCurrentUser } from "@/lib/auth/session"
import { getPublicGiveaway } from "@/lib/core/giveaway"
import { NotFoundError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

// Public giveaway detail. If the viewer is logged in, the payload also reflects
// their personal state (entered? eligible? winner? prize claim data).
export const GET = route(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const locale = new URL(req.url).searchParams.get("locale") ?? "fa"
  const user = await getCurrentUser()
  const data = await getPublicGiveaway(slug, user?.id ?? undefined, locale)
  if (!data) throw new NotFoundError("Giveaway not found")
  return data
})
