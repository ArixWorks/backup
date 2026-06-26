import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getBalances, getAllBalances } from "@/lib/core/wallet"
import { listCurrencies } from "@/lib/core/currencies"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  // Base-currency balances kept at the top level for backward compatibility.
  const [balances, allBalances, currencies] = await Promise.all([
    getBalances(user.id),
    getAllBalances(user.id),
    listCurrencies(),
  ])
  const transactions = await prisma.walletTransaction.findMany({
    where: { wallet: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  return { balances, allBalances, currencies, transactions }
})
