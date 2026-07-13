import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listPendingDeliveries } from "@/lib/core/admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  const [orders, giveawayWinners] = await Promise.all([
    listPendingDeliveries(),
    prisma.giveawayWinner.findMany({
      where: { delivered: false, giveaway: { status: "FINISHED" } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        position: true,
        deliveryError: true,
        createdAt: true,
        giveaway: { select: { id: true, title: true, prizeLabel: true } },
        user: { select: { displayName: true, alias: true } },
      },
    }),
  ])
  return { orders, giveawayWinners }
})
