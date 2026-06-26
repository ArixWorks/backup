import type { WalletTxType } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { queryStatement } from "@/lib/core/statement"
import { BASE_CURRENCY } from "@/lib/core/ledger"

export const dynamic = "force-dynamic"

const TX_TYPES = new Set<string>([
  "DEPOSIT", "WITHDRAWAL", "FREEZE", "UNFREEZE", "PURCHASE", "REFUND",
  "BID_LOCK", "BID_RELEASE", "ADMIN_ADJUSTMENT", "CASHBACK", "REFERRAL_BONUS", "CONVERSION",
])

export const GET = route(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const typeParam = url.searchParams.get("type") ?? undefined
  const { rows, total, take } = await queryStatement({
    userId: user.id,
    currency: url.searchParams.get("currency") || BASE_CURRENCY,
    type: typeParam && TX_TYPES.has(typeParam) ? (typeParam as WalletTxType) : undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    q: url.searchParams.get("q") || undefined,
    take: Number(url.searchParams.get("take")) || 50,
    skip: Number(url.searchParams.get("skip")) || 0,
  })
  return { transactions: rows, total, take }
})
