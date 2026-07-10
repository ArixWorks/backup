/**
 * PR4 QA — Wallet & Settlement Lifecycle.
 *
 * Drives the REAL service functions (placeBid, finalizeAuction, payAuctionBalance,
 * acceptSecondChanceOffer, rejectSecondChanceOffer, handleWinnerDefault) against
 * the live DB with tagged, self-cleaning fixtures. Verifies:
 *   1. Full-freeze default → instant SETTLED (regression, unchanged).
 *   2. Deposit mode → PAYMENT_PENDING → pay balance → SETTLED.
 *   3. Default → SECOND_CHANCE → accept → pay → SETTLED.
 *   4. Second-chance REJECT → advance / cancel.
 *   5. Default actions CANCEL / PENALTY / RESTRICT_USER / REOPEN.
 *   6. Multi-winner safety (always full freeze, never pends).
 */
import { PrismaClient } from "@prisma/client"
import { deposit, getBalances } from "../lib/core/wallet"
import {
  placeBid,
  finalizeAuction,
  payAuctionBalance,
  acceptSecondChanceOffer,
  rejectSecondChanceOffer,
  handleWinnerDefault,
} from "../lib/core/auction"

const prisma = new PrismaClient()
const TAG = "qa-pr4"
let pass = 0
let fail = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name + (detail ? ` — ${detail}` : ""))
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const rand = () => Math.random().toString(36).slice(2, 8)

async function mkUser(funds: bigint) {
  const u = await prisma.user.create({
    data: {
      telegramId: `qa-${rand()}-${Math.floor(Math.random() * 1e9)}`,
      displayName: `QA ${rand()}`,
      alias: `qa_${rand()}${Math.floor(Math.random() * 1e6)}`,
      role: "USER",
      status: "ACTIVE",
    },
  })
  await prisma.wallet.create({
    data: { userId: u.id, currency: "IRT", totalBalance: 0n, frozenBalance: 0n },
  })
  if (funds > 0n) await deposit(u.id, funds, prisma, { type: "qa", id: TAG })
  return u
}

async function mkAuction(opts: {
  policyJson?: Record<string, unknown> | null
  quantity?: number
  startPrice?: bigint
  reservePrice?: bigint | null
}) {
  const product = await prisma.product.create({
    data: {
      slug: `${TAG}-${rand()}`,
      title: `QA PR4 ${rand()}`,
      tags: [TAG],
      saleMode: "AUCTION",
      deliveryType: "MANUAL",
      active: true,
    },
  })
  const now = new Date()
  const auction = await prisma.auction.create({
    data: {
      productId: product.id,
      status: "ACTIVE",
      startPrice: opts.startPrice ?? 100000n,
      currentPrice: opts.startPrice ?? 100000n,
      minimumIncrement: 10000n,
      quantity: opts.quantity ?? 1,
      reservePrice: opts.reservePrice ?? null,
      startTime: new Date(now.getTime() - 3600e3),
      endTime: new Date(now.getTime() + 3600e3),
      policyJson: opts.policyJson ? JSON.stringify(opts.policyJson) : null,
    },
  })
  return auction
}

async function endNow(auctionId: string) {
  await prisma.auction.update({
    where: { id: auctionId },
    data: { endTime: new Date(Date.now() - 1000) },
  })
}
async function expireDeadline(auctionId: string) {
  await prisma.auction.update({
    where: { id: auctionId },
    data: { paymentDeadlineAt: new Date(Date.now() - 1000), secondChanceDeadlineAt: new Date(Date.now() - 1000) },
  })
}

const DEPOSIT_POLICY = (action: string, extra: Record<string, unknown> = {}) => ({
  walletFreezeEnabled: true,
  walletFreezeMode: "FIXED_DEPOSIT",
  entryDepositEnabled: true,
  entryDepositAmount: 50000,
  paymentDeadlineMinutes: 30,
  paymentDefaultAction: action,
  secondChanceOfferEnabled: true,
  secondChanceWindowMinutes: 60,
  defaultRestrictionDays: 15,
  ...extra,
})

async function run() {
  console.log("\n=== PR4 QA: Wallet & Settlement Lifecycle ===\n")

  // ---- 1. Full-freeze default → instant SETTLED (regression) --------------
  console.log("[1] Full-freeze default (regression)")
  {
    const a = await mkAuction({ policyJson: null })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    const bal = await getBalances(u.id)
    check("full-freeze locks the whole bid", bal.frozenBalance === 200000n, `frozen=${bal.frozenBalance}`)
    await endNow(a.id)
    const res = await finalizeAuction(a.id)
    const after = await prisma.auction.findUnique({ where: { id: a.id } })
    check("finalize → SETTLED instantly", after?.status === "SETTLED", `status=${after?.status}`)
    check("no payment deadline set", after?.paymentDeadlineAt === null)
    const b2 = await getBalances(u.id)
    check("funds captured (300000 left)", b2.totalBalance === 300000n && b2.frozenBalance === 0n, `total=${b2.totalBalance} frozen=${b2.frozenBalance}`)
    const order = await prisma.order.findFirst({ where: { auctionId: a.id } })
    check("order PAID", order?.status === "PAID", `order=${order?.status}`)
    void res
  }

  // ---- 2. Deposit mode → PAYMENT_PENDING → pay → SETTLED ------------------
  console.log("\n[2] Deposit mode → pay balance")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("CANCEL") })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    const bal = await getBalances(u.id)
    check("deposit mode freezes only the deposit (50000)", bal.frozenBalance === 50000n, `frozen=${bal.frozenBalance}`)
    await endNow(a.id)
    await finalizeAuction(a.id)
    const pend = await prisma.auction.findUnique({ where: { id: a.id } })
    check("finalize → PAYMENT_PENDING", pend?.status === "PAYMENT_PENDING", `status=${pend?.status}`)
    check("payment deadline set", pend?.paymentDeadlineAt != null)
    check("winner recorded", pend?.winnerUserId === u.id)
    const pendOrder = await prisma.order.findFirst({ where: { auctionId: a.id } })
    check("order PENDING before payment", pendOrder?.status === "PENDING", `order=${pendOrder?.status}`)
    const pay = await payAuctionBalance({ auctionId: a.id, userId: u.id })
    check("payAuctionBalance ok", pay.paid === true)
    const settled = await prisma.auction.findUnique({ where: { id: a.id } })
    check("→ SETTLED after payment", settled?.status === "SETTLED", `status=${settled?.status}`)
    const b2 = await getBalances(u.id)
    check("full price captured (300000 left, 0 frozen)", b2.totalBalance === 300000n && b2.frozenBalance === 0n, `total=${b2.totalBalance} frozen=${b2.frozenBalance}`)
    const paidOrder = await prisma.order.findFirst({ where: { auctionId: a.id } })
    check("order PAID after payment", paidOrder?.status === "PAID")
    // Idempotency
    const again = await payAuctionBalance({ auctionId: a.id, userId: u.id })
    check("pay is idempotent (alreadySettled)", (again as any).alreadySettled === true)
  }

  // ---- 3. Default → SECOND_CHANCE → accept → pay → SETTLED ----------------
  console.log("\n[3] Default → second chance → accept → pay")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("SECOND_CHANCE") })
    const winner = await mkUser(500000n)
    const runnerUp = await mkUser(500000n)
    await placeBid({ userId: runnerUp.id, auctionId: a.id, amount: 150000n })
    await placeBid({ userId: winner.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    let cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("pending on top winner", cur?.status === "PAYMENT_PENDING" && cur?.winnerUserId === winner.id)
    await expireDeadline(a.id)
    const def = await handleWinnerDefault(a.id)
    check("default handled", (def as any).handled === true)
    cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("second-chance offered to runner-up", cur?.secondChanceUserId === runnerUp.id, `sc=${cur?.secondChanceUserId}`)
    check("still PAYMENT_PENDING (awaiting acceptance)", cur?.status === "PAYMENT_PENDING")
    // defaulted winner's deposit released
    const wbal = await getBalances(winner.id)
    check("defaulted winner deposit released", wbal.frozenBalance === 0n, `frozen=${wbal.frozenBalance}`)
    const evDefault = await prisma.auctionEvent.findFirst({ where: { auctionId: a.id, type: "WINNER_DEFAULTED" } })
    check("WINNER_DEFAULTED event recorded", !!evDefault)
    await acceptSecondChanceOffer({ auctionId: a.id, userId: runnerUp.id })
    cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("runner-up promoted to winner", cur?.winnerUserId === runnerUp.id)
    await payAuctionBalance({ auctionId: a.id, userId: runnerUp.id })
    cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("→ SETTLED after runner-up pays", cur?.status === "SETTLED")
    const rbal = await getBalances(runnerUp.id)
    check("runner-up charged final price (150000)", rbal.totalBalance === 350000n, `total=${rbal.totalBalance}`)
  }

  // ---- 4. Second-chance REJECT → no more bidders → CANCEL ------------------
  console.log("\n[4] Second chance reject → cancel")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("SECOND_CHANCE") })
    const winner = await mkUser(500000n)
    const runnerUp = await mkUser(500000n)
    await placeBid({ userId: runnerUp.id, auctionId: a.id, amount: 150000n })
    await placeBid({ userId: winner.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    await expireDeadline(a.id)
    await handleWinnerDefault(a.id)
    let cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("offer to runner-up", cur?.secondChanceUserId === runnerUp.id)
    await rejectSecondChanceOffer({ auctionId: a.id, userId: runnerUp.id })
    cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("no eligible bidders left → CANCELLED", cur?.status === "CANCELLED", `status=${cur?.status}`)
    const rbal = await getBalances(runnerUp.id)
    check("runner-up hold released on reject", rbal.frozenBalance === 0n)
  }

  // ---- 5a. Default → CANCEL ------------------------------------------------
  console.log("\n[5a] Default action CANCEL")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("CANCEL") })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    await expireDeadline(a.id)
    await handleWinnerDefault(a.id)
    const cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("CANCEL → CANCELLED", cur?.status === "CANCELLED", `status=${cur?.status}`)
    const bal = await getBalances(u.id)
    check("deposit fully released (no capture)", bal.totalBalance === 500000n && bal.frozenBalance === 0n, `total=${bal.totalBalance}`)
  }

  // ---- 5b. Default → PENALTY (forfeit deposit) ----------------------------
  console.log("\n[5b] Default action PENALTY")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("PENALTY") })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    await expireDeadline(a.id)
    await handleWinnerDefault(a.id)
    const cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("PENALTY → CANCELLED", cur?.status === "CANCELLED")
    const bal = await getBalances(u.id)
    check("deposit forfeited (50000 captured → 450000 left)", bal.totalBalance === 450000n && bal.frozenBalance === 0n, `total=${bal.totalBalance} frozen=${bal.frozenBalance}`)
    const ev = await prisma.auctionEvent.findFirst({ where: { auctionId: a.id, type: "PENALTY_APPLIED" } })
    check("PENALTY_APPLIED event", !!ev)
  }

  // ---- 5c. Default → RESTRICT_USER ----------------------------------------
  console.log("\n[5c] Default action RESTRICT_USER")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("RESTRICT_USER") })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    await expireDeadline(a.id)
    await handleWinnerDefault(a.id)
    const cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("RESTRICT → CANCELLED", cur?.status === "CANCELLED")
    const usr = await prisma.user.findUnique({ where: { id: u.id } })
    check("user auctionRestrictedUntil set in future", !!usr?.auctionRestrictedUntil && usr.auctionRestrictedUntil > new Date())
    // Verify the restriction blocks new bids
    const a2 = await mkAuction({ policyJson: null })
    let blocked = false
    try {
      await placeBid({ userId: u.id, auctionId: a2.id, amount: 150000n })
    } catch {
      blocked = true
    }
    check("restricted user cannot bid", blocked)
  }

  // ---- 5d. Default → REOPEN -----------------------------------------------
  console.log("\n[5d] Default action REOPEN")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("REOPEN") })
    const u = await mkUser(500000n)
    await placeBid({ userId: u.id, auctionId: a.id, amount: 200000n })
    await endNow(a.id)
    await finalizeAuction(a.id)
    await expireDeadline(a.id)
    await handleWinnerDefault(a.id)
    const cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("REOPEN → SCHEDULED, winner cleared", cur?.status === "SCHEDULED" && cur?.winnerUserId === null, `status=${cur?.status}`)
    const bal = await getBalances(u.id)
    check("deposit released on reopen", bal.frozenBalance === 0n)
    const ev = await prisma.auctionEvent.findFirst({ where: { auctionId: a.id, type: "AUCTION_REOPENED" } })
    check("AUCTION_REOPENED event", !!ev)
  }

  // ---- 6. Multi-winner safety (deposit policy ignored → full freeze) -------
  console.log("\n[6] Multi-winner safety")
  {
    const a = await mkAuction({ policyJson: DEPOSIT_POLICY("CANCEL"), quantity: 2 })
    const u1 = await mkUser(500000n)
    const u2 = await mkUser(500000n)
    await placeBid({ userId: u1.id, auctionId: a.id, amount: 200000n })
    await placeBid({ userId: u2.id, auctionId: a.id, amount: 220000n })
    const b1 = await getBalances(u1.id)
    check("multi-winner forces full freeze (200000)", b1.frozenBalance === 200000n, `frozen=${b1.frozenBalance}`)
    const b2 = await getBalances(u2.id)
    check("multi-winner forces full freeze for u2 (220000)", b2.frozenBalance === 220000n, `frozen=${b2.frozenBalance}`)
    await endNow(a.id)
    await finalizeAuction(a.id)
    const cur = await prisma.auction.findUnique({ where: { id: a.id } })
    check("multi-winner settles instantly (SETTLED)", cur?.status === "SETTLED", `status=${cur?.status}`)
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  if (failures.length) console.log("FAILURES:\n - " + failures.join("\n - "))
}

async function cleanup() {
  const products = await prisma.product.findMany({ where: { tags: { has: TAG } }, select: { id: true } })
  const pids = products.map((p) => p.id)
  const auctions = await prisma.auction.findMany({ where: { productId: { in: pids } }, select: { id: true } })
  const aids = auctions.map((a) => a.id)
  await prisma.auctionEvent.deleteMany({ where: { auctionId: { in: aids } } })
  await prisma.bid.deleteMany({ where: { auctionId: { in: aids } } })
  await prisma.order.deleteMany({ where: { auctionId: { in: aids } } })
  await prisma.auction.deleteMany({ where: { id: { in: aids } } })
  await prisma.product.deleteMany({ where: { id: { in: pids } } })
  // wallet tx + wallets + users tagged via qa deposit ref / display name
  const users = await prisma.user.findMany({ where: { displayName: { startsWith: "QA " } }, select: { id: true } })
  const uids = users.map((u) => u.id)
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: uids } } } }).catch(() => {})
  await prisma.wallet.deleteMany({ where: { userId: { in: uids } } })
  await prisma.notification.deleteMany({ where: { userId: { in: uids } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: { in: uids } } })
  const remA = await prisma.product.count({ where: { tags: { has: TAG } } })
  console.log(`cleanup: ${remA} qa products remaining; removed ${uids.length} qa users`)
}

run()
  .catch((e) => {
    console.error("HARNESS ERROR:", e)
    fail++
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
    process.exit(fail > 0 ? 1 : 0)
  })
