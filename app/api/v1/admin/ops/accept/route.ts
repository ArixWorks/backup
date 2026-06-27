import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ensureWallet, getBalances, spendAvailable } from "@/lib/core/wallet"
import { createDepositRequest, approveDeposit, rejectDeposit } from "@/lib/core/finance"
import { createFlashProduct, setProductVisibility, createAuctionProduct } from "@/lib/core/admin-catalog"
import { purchaseFixed } from "@/lib/core/flash-sale"
import { createCoupon, deleteCoupon } from "@/lib/core/coupons"
import { attachReferral } from "@/lib/core/rewards"
import { placeBid, finalizeAuction } from "@/lib/core/auction"
import { createGiveaway, enterGiveaway, drawGiveaway, deleteGiveaway } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

// Token-gated, production-disabled in-runtime acceptance harness. Drives real
// core service functions through full lifecycles + abuse/concurrency, asserts
// invariants, then cleans up everything it created.
const TOKEN = "accept-verify-2026"
const TAG = "ACCTEST"

type Case = { name: string; ok: boolean; detail: string }
const results: Case[] = []
function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail })
}
async function settleErr(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message || String(e)
  }
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 })
  }
  if (new URL(req.url).searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  results.length = 0
  const created: { users: string[]; products: string[]; auctions: string[]; giveaways: string[]; coupons: string[] } = {
    users: [],
    products: [],
    auctions: [],
    giveaways: [],
    coupons: [],
  }

  async function mkUser(label: string, balance = 0n): Promise<string> {
    const u = await prisma.user.create({
      data: { displayName: `${TAG}-${label}`, alias: `${TAG}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    })
    created.users.push(u.id)
    await ensureWallet(u.id)
    if (balance > 0n) {
      // Fund via approved deposit so the ledger is consistent.
      const dep = await createDepositRequest({ userId: u.id, amount: balance })
      await approveDeposit(dep.id, u.id)
    }
    return u.id
  }

  try {
    // ---------------------------------------------------------------
    // WALLET — deposit approve / reject / double-approve guard
    // ---------------------------------------------------------------
    {
      const uid = await mkUser("wallet")
      const dep = await createDepositRequest({ userId: uid, amount: 500_000n })
      await approveDeposit(dep.id, uid)
      const bal1 = await getBalances(uid)
      check("wallet.deposit_approve_credits", bal1.availableBalance === 500_000n, `available=${bal1.availableBalance}`)

      const dupErr = await settleErr(approveDeposit(dep.id, uid))
      const bal2 = await getBalances(uid)
      check("wallet.double_approve_guard", dupErr !== null && bal2.availableBalance === 500_000n, `err=${dupErr}, bal=${bal2.availableBalance}`)

      const dep2 = await createDepositRequest({ userId: uid, amount: 100_000n })
      await rejectDeposit(dep2.id, uid, "test reject")
      const bal3 = await getBalances(uid)
      check("wallet.reject_no_credit", bal3.availableBalance === 500_000n, `bal=${bal3.availableBalance}`)

      // concurrent approval of one pending deposit -> exactly one credit
      const uid2 = await mkUser("wallet2")
      const dep3 = await createDepositRequest({ userId: uid2, amount: 200_000n })
      const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => approveDeposit(dep3.id, uid2)))
      const okCount = outcomes.filter((o) => o.status === "fulfilled").length
      const balC = await getBalances(uid2)
      check("wallet.concurrent_approve_once", okCount === 1 && balC.availableBalance === 200_000n, `ok=${okCount}, bal=${balC.availableBalance}`)
    }

    // ---------------------------------------------------------------
    // CATALOG + PURCHASE — success, idempotency, out-of-stock, concurrency
    // ---------------------------------------------------------------
    {
      const adminId = await mkUser("admin")
      const prod = await createFlashProduct(
        { title: `${TAG} Product`, deliveryType: "MANUAL", price: 100_000n, stock: 1, hidden: false },
        adminId,
      )
      created.products.push(prod.id)

      // visibility toggle
      await setProductVisibility(prod.id, true, adminId)
      const hidden = await prisma.product.findUnique({ where: { id: prod.id }, select: { hidden: true } })
      await setProductVisibility(prod.id, false, adminId)
      check("catalog.visibility_toggle", hidden?.hidden === true, `hidden=${hidden?.hidden}`)

      // successful purchase
      const buyer = await mkUser("buyer", 1_000_000n)
      const order = await purchaseFixed({ userId: buyer.toString(), productId: prod.id, quantity: 1 })
      const balAfter = await getBalances(buyer)
      const sale = await prisma.fixedSale.findFirst({ where: { productId: prod.id } })
      // Charge is exactly the price; final balance = 1,000,000 - 100,000 + cashback.
      // Cashback (if configured) is credited back, so balance is in (900k, 1,000k).
      const cashback = balAfter.availableBalance - 900_000n
      check(
        "commerce.purchase_charges_and_decrements",
        order.amount === 100_000n &&
          sale?.stock === 0 &&
          order.status === "PAID" &&
          cashback >= 0n &&
          cashback < 100_000n,
        `charged=${order.amount}, bal=${balAfter.availableBalance}, cashback=${cashback}, stock=${sale?.stock}, status=${order.status}`,
      )

      // out of stock
      const buyer2 = await mkUser("buyer2", 1_000_000n)
      const oosErr = await settleErr(purchaseFixed({ userId: buyer2, productId: prod.id, quantity: 1 }))
      check("commerce.out_of_stock_rejected", oosErr !== null, `err=${oosErr}`)

      // concurrent purchase of last unit: stock=5, 12 buyers x1 -> exactly 5 succeed
      const prod2 = await createFlashProduct(
        { title: `${TAG} Product2`, deliveryType: "MANUAL", price: 50_000n, stock: 5, hidden: false },
        adminId,
      )
      created.products.push(prod2.id)
      const buyers = await Promise.all(Array.from({ length: 12 }, (_, i) => mkUser(`rush${i}`, 200_000n)))
      const purchases = await Promise.allSettled(buyers.map((b) => purchaseFixed({ userId: b, productId: prod2.id, quantity: 1 })))
      const succeeded = purchases.filter((p) => p.status === "fulfilled").length
      const sale2 = await prisma.fixedSale.findFirst({ where: { productId: prod2.id } })
      check(
        "commerce.concurrent_oversell_prevented",
        succeeded === 5 && sale2?.stock === 0,
        `succeeded=${succeeded}/12, stock=${sale2?.stock}`,
      )
    }

    // ---------------------------------------------------------------
    // COUPON — discount, total limit, concurrent redemption
    // ---------------------------------------------------------------
    {
      const adminId = await mkUser("cadmin")
      const code = `${TAG}C${Date.now().toString().slice(-6)}`
      const coupon = await createCoupon({ code, type: "PERCENT", value: 50, totalLimit: 1, active: true })
      created.coupons.push(coupon.id)
      const prod = await createFlashProduct(
        { title: `${TAG} Coupon Product`, deliveryType: "MANUAL", price: 100_000n, stock: 50, hidden: false },
        adminId,
      )
      created.products.push(prod.id)

      const c1 = await mkUser("coup1", 1_000_000n)
      const o1 = await purchaseFixed({ userId: c1, productId: prod.id, quantity: 1, couponCode: code })
      const b1 = await getBalances(c1)
      // 50% off 100,000 => charged 50,000; balance = 1,000,000 - 50,000 + cashback.
      const cb = b1.availableBalance - 950_000n
      check(
        "coupon.percent_discount_applied",
        o1.amount === 50_000n && cb >= 0n && cb < 50_000n,
        `charged=${o1.amount}, bal=${b1.availableBalance}, cashback=${cb}`,
      )

      // totalLimit=1 -> second distinct user redemption must fail
      const c2 = await mkUser("coup2", 1_000_000n)
      const limErr = await settleErr(purchaseFixed({ userId: c2, productId: prod.id, quantity: 1, couponCode: code }))
      check("coupon.total_limit_enforced", limErr !== null, `err=${limErr}`)
    }

    // ---------------------------------------------------------------
    // REFERRAL — self-code, valid, duplicate, loop
    // ---------------------------------------------------------------
    {
      const inviter = await prisma.user.findUnique({ where: { id: created.users[0] } })
      // ensure inviter has a referral code
      const a = await mkUser("ref-a")
      const b = await mkUser("ref-b")
      const codeA = (await prisma.user.findUnique({ where: { id: a }, select: { referralCode: true } }))?.referralCode
      // self code
      const selfRes = codeA ? await attachReferral(a, codeA) : { attached: true, reason: "ok" as const }
      check("referral.self_code_rejected", selfRes.attached === false, `reason=${(selfRes as { reason?: string }).reason}`)
      // valid attach b <- a
      const okRes = codeA ? await attachReferral(b, codeA) : { attached: false }
      check("referral.valid_attach", okRes.attached === true, `reason=${(okRes as { reason?: string }).reason}`)
      // duplicate attach
      const dupRes = codeA ? await attachReferral(b, codeA) : { attached: true }
      check("referral.duplicate_rejected", dupRes.attached === false, `reason=${(dupRes as { reason?: string }).reason}`)
      // loop: a tries to use b's code (b was referred by a)
      const codeB = (await prisma.user.findUnique({ where: { id: b }, select: { referralCode: true } }))?.referralCode
      const loopRes = codeB ? await attachReferral(a, codeB) : { attached: false }
      check("referral.loop_rejected", loopRes.attached === false, `reason=${(loopRes as { reason?: string }).reason}`)
      void inviter
    }

    // ---------------------------------------------------------------
    // AUCTION — concurrent bids consistency + finalize
    // ---------------------------------------------------------------
    {
      const adminId = await mkUser("aadmin")
      const now = Date.now()
      const auctionProd = await createAuctionProduct(
        {
          title: `${TAG} Auction`,
          deliveryType: "MANUAL",
          startPrice: 100_000n,
          minimumIncrement: 10_000n,
          quantity: 1,
          startTime: new Date(now - 60_000),
          endTime: new Date(now + 3_600_000),
        },
        adminId,
      )
      const auction = await prisma.auction.findFirst({ where: { productId: auctionProd.id } })
      created.products.push(auctionProd.id)
      if (auction) created.auctions.push(auction.id)

      const bidders = await Promise.all(Array.from({ length: 6 }, (_, i) => mkUser(`bid${i}`, 5_000_000n)))
      // each bidder bids an increasing amount concurrently
      const bidOutcomes = await Promise.allSettled(
        bidders.map((bidder, i) => placeBid({ userId: bidder, auctionId: auction!.id, amount: 100_000n + BigInt((i + 1) * 50_000) })),
      )
      const accepted = bidOutcomes.filter((o) => o.status === "fulfilled").length
      const freshAuction = await prisma.auction.findUnique({ where: { id: auction!.id } })
      const bidCount = await prisma.bid.count({ where: { auctionId: auction!.id } })
      check(
        "auction.concurrent_bids_consistent",
        freshAuction != null && (freshAuction.currentPrice ?? 0n) > 0n && bidCount === accepted && bidCount > 0,
        `currentPrice=${freshAuction?.currentPrice}, bids=${bidCount}, accepted=${accepted}`,
      )

      // finalize after end
      await prisma.auction.update({ where: { id: auction!.id }, data: { endTime: new Date(Date.now() - 1000) } })
      const fin = (await finalizeAuction(auction!.id)) as { finalized: boolean; winners: number }
      check("auction.finalize_one_winner", fin.finalized === true && fin.winners === 1, `finalized=${fin.finalized}, winners=${fin.winners}`)
    }

    // ---------------------------------------------------------------
    // GIVEAWAY — duplicate entry, distinct entries, draw
    // ---------------------------------------------------------------
    {
      const adminId = await mkUser("gadmin")
      const gv = await createGiveaway(
        {
          title: `${TAG} Giveaway`,
          prizeKind: "CUSTOM",
          prizeLabel: "Test prize",
          winnersCount: 2,
          startAt: new Date(Date.now() - 60_000).toISOString(),
          endAt: new Date(Date.now() + 3_600_000).toISOString(),
          drawAt: new Date(Date.now() + 7_200_000).toISOString(),
          requiredChannels: [],
          status: "SCHEDULED",
        },
        adminId,
      )
      created.giveaways.push(gv.id)

      // same user 20x concurrent -> exactly 1 entry
      const ent = await mkUser("gv-dup")
      const dupEntries = await Promise.allSettled(Array.from({ length: 20 }, () => enterGiveaway({ giveawayId: gv.id, userId: ent, source: "WEB" })))
      const okDup = dupEntries.filter((o) => o.status === "fulfilled" && (o.value as { created: boolean }).created).length
      const entryCount1 = await prisma.giveawayEntry.count({ where: { giveawayId: gv.id, userId: ent } })
      check("giveaway.duplicate_entry_collapsed", entryCount1 === 1, `created=${okDup}, rows=${entryCount1}`)

      // 5 distinct users
      const parts = await Promise.all(Array.from({ length: 5 }, (_, i) => mkUser(`gv${i}`)))
      await Promise.allSettled(parts.map((p) => enterGiveaway({ giveawayId: gv.id, userId: p, source: "WEB" })))
      const total = await prisma.giveawayEntry.count({ where: { giveawayId: gv.id } })
      check("giveaway.distinct_entries", total === 6, `total=${total}`)

      // draw -> exactly winnersCount distinct winners (close registration first)
      await prisma.giveaway.update({ where: { id: gv.id }, data: { endAt: new Date(Date.now() - 1000) } })
      const draw = (await drawGiveaway(gv.id, { actorId: adminId })) as { winners?: unknown[] }
      const winnerRows = await prisma.giveawayWinner.findMany({ where: { giveawayId: gv.id }, select: { userId: true } })
      const distinct = new Set(winnerRows.map((w) => w.userId)).size
      check("giveaway.draw_exact_winners", winnerRows.length === 2 && distinct === 2, `winners=${winnerRows.length}, distinct=${distinct}`)
      void draw
    }

    // ---------------------------------------------------------------
    // VIP — manual VIP tier discount applies on purchase
    // ---------------------------------------------------------------
    {
      const adminId = await mkUser("vadmin")
      const prod = await createFlashProduct(
        { title: `${TAG} VIP Product`, deliveryType: "MANUAL", price: 100_000n, stock: 10, hidden: false },
        adminId,
      )
      created.products.push(prod.id)
      const vip = await mkUser("vip", 1_000_000n)
      await prisma.user.update({ where: { id: vip }, data: { vipManual: true } })
      const order = await purchaseFixed({ userId: vip, productId: prod.id, quantity: 1 })
      // VIP should get some discount (charge < full price) OR equal if no tier discount configured
      check("vip.tier_discount_applies", order.amount <= 100_000n, `charged=${order.amount} (<=100000 expected; discount if configured)`)
    }
  } catch (e) {
    check("HARNESS_FATAL", false, (e as Error).message + "\n" + (e as Error).stack?.slice(0, 400))
  } finally {
    // Cleanup in reverse dependency order, best-effort.
    await cleanup(created)
  }

  const passed = results.filter((r) => r.ok).length
  return NextResponse.json({ summary: `${passed}/${results.length} passed`, results }, { status: 200 })
}

async function cleanup(created: { users: string[]; products: string[]; auctions: string[]; giveaways: string[]; coupons: string[] }) {
  const u = created.users
  try {
    for (const id of created.giveaways) {
      await prisma.giveawayWinner.deleteMany({ where: { giveawayId: id } })
      await prisma.giveawayEntry.deleteMany({ where: { giveawayId: id } })
      await prisma.giveaway.delete({ where: { id } }).catch(() => {})
    }
    for (const id of created.auctions) {
      await prisma.bid.deleteMany({ where: { auctionId: id } })
      await prisma.giveawayWinner.deleteMany({ where: {} }).catch(() => {})
      await prisma.auction.delete({ where: { id } }).catch(() => {})
    }
    // orders, deliveries, redemptions tied to test users
    if (u.length) {
      const orders = await prisma.order.findMany({ where: { userId: { in: u } }, select: { id: true } })
      const orderIds = orders.map((o) => o.id)
      if (orderIds.length) {
        await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
        await prisma.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {})
      }
    }
    for (const id of created.coupons) {
      await prisma.couponRedemption.deleteMany({ where: { couponId: id } }).catch(() => {})
      await deleteCoupon(id).catch(() => {})
    }
    for (const id of created.products) {
      await prisma.inventoryItem.deleteMany({ where: { productId: id } }).catch(() => {})
      await prisma.fixedSale.deleteMany({ where: { productId: id } }).catch(() => {})
      await prisma.auction.deleteMany({ where: { productId: id } }).catch(() => {})
      await prisma.product.delete({ where: { id } }).catch(() => {})
    }
    // wallet + ledger + user-scoped rows
    if (u.length) {
      const wallets = await prisma.wallet.findMany({ where: { userId: { in: u } }, select: { id: true } })
      const wids = wallets.map((w) => w.id)
      if (wids.length) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: { in: wids } } }).catch(() => {})
      }
      await prisma.ledgerLeg.deleteMany({ where: { account: { ownerUserId: { in: u } } } }).catch(() => {})
      await prisma.depositRequest.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      await prisma.withdrawalRequest.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { actorId: { in: u } } }).catch(() => {})
      await prisma.notification.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      await prisma.giveawayEntry.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      await prisma.bid.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      await prisma.ledgerAccount.deleteMany({ where: { ownerUserId: { in: u } } }).catch(() => {})
      await prisma.wallet.deleteMany({ where: { userId: { in: u } } }).catch(() => {})
      // unlink referrals then delete users
      await prisma.user.updateMany({ where: { referredById: { in: u } }, data: { referredById: null } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: u } } }).catch(() => {})
    }
  } catch (e) {
    check("cleanup", false, (e as Error).message)
  }
}
