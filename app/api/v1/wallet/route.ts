import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getBalances } from "@/lib/core/wallet"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  const balances = await getBalances(user.id)
  const transactions = await prisma.walletTransaction.findMany({
    where: { wallet: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  return { balances, transactions }
})
