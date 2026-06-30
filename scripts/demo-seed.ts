/**
 * DEMO ADMIN ENVIRONMENT — production-scale sample data.
 *
 *   pnpm exec tsx scripts/demo-seed.ts
 *   # or: pnpm db:seed:demo
 *
 * Populates the WHOLE platform with realistic, internally-consistent data so
 * every admin screen renders meaningful information instead of empty states:
 *   - hundreds of users (with referrals, VIP tiers, loyalty points, streaks)
 *   - wallets + a balanced double-entry ledger (reconciliation stays GREEN)
 *   - products (flash sales + auctions), inventory, reviews
 *   - orders + deliveries across every status
 *   - auctions + bids, watchlists, stock alerts
 *   - giveaways + entries + winners
 *   - wallet transactions (30-day inflow/outflow for the finance charts)
 *   - support tickets + threaded messages
 *   - notifications, coupons + redemptions, audit logs
 *   - deposit / withdrawal / refund queues (pending + resolved)
 *   - gamification (badges, missions, point ledger)
 *   - Operations Center telemetry (metrics, service health, errors, alerts)
 *   - transactional email queue + delivery events
 *
 * Self-contained on purpose (own PrismaClient, no "@/..." aliases or
 * "server-only" imports) so it runs cleanly under tsx in any environment.
 *
 * It WIPES existing demo/transactional data first (same scope as
 * scripts/reset-data.ts) and PRESERVES structural rows it manages itself
 * (currencies, badges, missions, alert rules). Safe to re-run.
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { randomUUID, randomBytes } from "crypto"
import argon2 from "argon2"

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Tunables — scale here. "hundreds" of everything by default.
// ---------------------------------------------------------------------------
const USER_COUNT = 320
const PRODUCT_FLASH = 28
const PRODUCT_AUCTION = 22
const ORDER_COUNT = 720
const GIVEAWAY_COUNT = 12
const TICKET_COUNT = 64
const DEPOSIT_COUNT = 90
const WITHDRAWAL_COUNT = 46
const REFUND_COUNT = 22
const COUPON_COUNT = 16
const AUDIT_COUNT = 320
const EMAIL_COUNT = 130

const RATE_SCALE = 100_000_000n
const DAY = 86_400_000

// ---------------------------------------------------------------------------
// Tiny RNG / helpers
// ---------------------------------------------------------------------------
const id = () => randomUUID()
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const chance = (p: number) => Math.random() < p
const big = (n: number) => BigInt(Math.round(n))
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)
const minsAgo = (n: number) => new Date(Date.now() - n * 60_000)
const slugOf = (p: string) => `${p}-${randomBytes(8).toString("base64url")}`
const pubId = (p: string) => `${p}_${randomBytes(7).toString("base64url")}`

/** "YYYY-MM-DD" in server-local time — matches lib/core/growth.ts dayKey(). */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Insert in chunks so a single statement never gets too large. */
async function insertMany<T>(
  model: { createMany: (a: { data: T[]; skipDuplicates?: boolean }) => Promise<unknown> },
  rows: T[],
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    await model.createMany({ data: rows.slice(i, i + size), skipDuplicates: true })
  }
}

// ---------------------------------------------------------------------------
// Persian-flavoured name pools
// ---------------------------------------------------------------------------
const FIRST = [
  "علی", "رضا", "سارا", "نیلوفر", "محمد", "فاطمه", "حسین", "مریم", "امیر", "زهرا",
  "مهدی", "نگار", "پارسا", "الهام", "سینا", "کیمیا", "آرش", "شیما", "بهنام", "لیلا",
  "سعید", "مینا", "کاوه", "آیدا", "فرهاد", "نازنین", "بابک", "رویا", "پویا", "شبنم",
  "میلاد", "هانیه", "احسان", "سمیرا", "کیان", "تینا", "آرمین", "مهسا", "یاسر", "غزل",
]
const LAST = [
  "محمدی", "احمدی", "رضایی", "کریمی", "موسوی", "حسینی", "جعفری", "قاسمی", "صادقی", "نوری",
  "اکبری", "کاظمی", "رحیمی", "شریفی", "عباسی", "یوسفی", "بیات", "صالحی", "زارع", "فلاحی",
]

const CATEGORIES = ["AI", "VPN", "Streaming", "Music", "Gaming", "Software", "Gift Card", "Hosting"] as const

const FLASH_TITLES: Array<{ title: string; cat: string; price: number }> = [
  { title: "ChatGPT Plus — اشتراک یک‌ماهه", cat: "AI", price: 750_000 },
  { title: "Claude Pro — اشتراک یک‌ماهه", cat: "AI", price: 720_000 },
  { title: "Midjourney Standard — ماهانه", cat: "AI", price: 980_000 },
  { title: "Perplexity Pro — سالانه", cat: "AI", price: 1_900_000 },
  { title: "VPN پرسرعت — ۳ ماهه", cat: "VPN", price: 480_000 },
  { title: "VPN اختصاصی — ۶ ماهه", cat: "VPN", price: 850_000 },
  { title: "Netflix Premium 4K — یک‌ماهه", cat: "Streaming", price: 540_000 },
  { title: "Disney+ — اشتراک سه‌ماهه", cat: "Streaming", price: 690_000 },
  { title: "Spotify Premium — ۶ ماهه", cat: "Music", price: 600_000 },
  { title: "Apple Music — یک‌ساله", cat: "Music", price: 1_450_000 },
  { title: "Steam Wallet — ۲۰ دلاری", cat: "Gift Card", price: 1_350_000 },
  { title: "Google Play — گیفت‌کارت ۲۵ دلاری", cat: "Gift Card", price: 1_680_000 },
  { title: "Xbox Game Pass Ultimate — ماهانه", cat: "Gaming", price: 760_000 },
  { title: "PlayStation Plus — سه‌ماهه", cat: "Gaming", price: 980_000 },
  { title: "Adobe Creative Cloud — ماهانه", cat: "Software", price: 1_250_000 },
  { title: "Microsoft 365 — یک‌ساله", cat: "Software", price: 1_550_000 },
  { title: "JetBrains All Products — سالانه", cat: "Software", price: 2_400_000 },
  { title: "Hosting ابری — پلن استارتر", cat: "Hosting", price: 420_000 },
  { title: "دامنه + هاست — پکیج سالانه", cat: "Hosting", price: 990_000 },
  { title: "Canva Pro — یک‌ساله", cat: "Software", price: 870_000 },
  { title: "Notion Plus — سالانه", cat: "Software", price: 640_000 },
  { title: "YouTube Premium — ۳ ماهه", cat: "Streaming", price: 510_000 },
  { title: "Telegram Premium — یک‌ساله", cat: "Software", price: 1_100_000 },
  { title: "Grammarly Premium — سالانه", cat: "Software", price: 930_000 },
  { title: "ExpressVPN — یک‌ساله", cat: "VPN", price: 1_700_000 },
  { title: "Tidal HiFi — ۶ ماهه", cat: "Music", price: 720_000 },
  { title: "Nitro Discord — سالانه", cat: "Gaming", price: 880_000 },
  { title: "iCloud+ ۲۰۰GB — سالانه", cat: "Software", price: 460_000 },
]

const AUCTION_TITLES: Array<{ title: string; cat: string; start: number }> = [
  { title: "اکانت قانونی ویندوز ۱۱ Pro", cat: "Software", start: 900_000 },
  { title: "گیفت‌کارت اپل ۱۰۰ دلاری", cat: "Gift Card", start: 4_500_000 },
  { title: "اشتراک یک‌ساله Netflix 4K", cat: "Streaming", start: 1_200_000 },
  { title: "اکانت Steam با ۵۰ بازی", cat: "Gaming", start: 3_800_000 },
  { title: "لایسنس مادام‌العمر Office 2024", cat: "Software", start: 1_500_000 },
  { title: "اشتراک VIP میدجرنی سالانه", cat: "AI", start: 2_100_000 },
  { title: "اکانت ChatGPT Team — ۳ کاربره", cat: "AI", start: 1_800_000 },
  { title: "VPN اختصاصی مادام‌العمر", cat: "VPN", start: 2_600_000 },
  { title: "گیفت‌کارت Google Play ۵۰ دلاری", cat: "Gift Card", start: 2_900_000 },
  { title: "اکانت Spotify Family دائمی", cat: "Music", start: 1_400_000 },
  { title: "PlayStation Plus سالانه + اعتبار", cat: "Gaming", start: 2_200_000 },
  { title: "پکیج کامل Adobe — سالانه", cat: "Software", start: 3_100_000 },
  { title: "اکانت Disney+ چهارساله", cat: "Streaming", start: 1_600_000 },
  { title: "هاست ابری حرفه‌ای — دو ساله", cat: "Hosting", start: 1_900_000 },
  { title: "لایسنس JetBrains مادام‌العمر", cat: "Software", start: 4_200_000 },
  { title: "اکانت Apple Music خانوادگی", cat: "Music", start: 1_050_000 },
  { title: "گیفت‌کارت Steam ۱۰۰ دلاری", cat: "Gift Card", start: 5_900_000 },
  { title: "اشتراک Perplexity Pro سالانه", cat: "AI", start: 1_300_000 },
  { title: "اکانت Xbox Ultimate سالانه", cat: "Gaming", start: 2_700_000 },
  { title: "VPN تیمی — ۱۰ کاربره سالانه", cat: "VPN", start: 2_400_000 },
  { title: "اکانت YouTube Premium دائمی", cat: "Streaming", start: 1_150_000 },
  { title: "بسته کامل Canva Teams سالانه", cat: "Software", start: 1_750_000 },
]

const TIER_POOL = ["STANDARD", "STANDARD", "STANDARD", "BRONZE", "BRONZE", "SILVER", "SILVER", "GOLD", "DIAMOND"] as const
const BADGE_CODES = ["FIRST_PURCHASE", "FIRST_REFERRAL", "GIVEAWAY_WINNER", "PRO_BUYER", "VIP_MEMBER", "ACTIVE_PARTICIPANT", "PROFILE_COMPLETE"]

const CURRENCIES = [
  { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0, isBase: true, displayOrder: 0 },
  { code: "USD", name: "دلار آمریکا", symbol: "$", decimals: 2, isBase: false, displayOrder: 1 },
  { code: "USDT", name: "تتر", symbol: "₮", decimals: 2, isBase: false, displayOrder: 2 },
]
const INITIAL_RATES: Array<{ from: string; to: string; rate: bigint }> = [
  { from: "USD", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USD", rate: 142857n },
  { from: "USDT", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USDT", rate: 142857n },
  { from: "USD", to: "USDT", rate: RATE_SCALE },
  { from: "USDT", to: "USD", rate: RATE_SCALE },
]
const BADGES = [
  { code: "FIRST_PURCHASE", name: "اولین خرید", description: "اولین خرید موفق خود را انجام دادید.", icon: "ShoppingBag", points: 50, displayOrder: 1 },
  { code: "FIRST_REFERRAL", name: "اولین دعوت", description: "اولین دوست خود را با موفقیت دعوت کردید.", icon: "UserPlus", points: 50, displayOrder: 2 },
  { code: "GIVEAWAY_WINNER", name: "برنده قرعه‌کشی", description: "در یک قرعه‌کشی برنده شدید.", icon: "Gift", points: 100, displayOrder: 3 },
  { code: "PRO_BUYER", name: "خریدار حرفه‌ای", description: "به جمع خریداران حرفه‌ای پیوستید.", icon: "Crown", points: 150, displayOrder: 4 },
  { code: "VIP_MEMBER", name: "عضو وی‌آی‌پی", description: "به بالاترین سطح عضویت رسیدید.", icon: "Gem", points: 200, displayOrder: 5 },
  { code: "ACTIVE_PARTICIPANT", name: "مشارکت‌کننده فعال", description: "به‌طور مستمر در پلتفرم فعال بودید.", icon: "Flame", points: 80, displayOrder: 6 },
  { code: "PROFILE_COMPLETE", name: "پروفایل کامل", description: "اطلاعات پروفایل خود را تکمیل کردید.", icon: "BadgeCheck", points: 30, displayOrder: 7 },
]
const MISSIONS = [
  { key: "daily_login", kind: "DAILY", type: "DAILY_LOGIN", title: "ورود روزانه", description: "امروز وارد شوید.", target: 1, rewardPoints: 10, icon: "LogIn", href: null, displayOrder: 1 },
  { key: "daily_flash", kind: "DAILY", type: "VIEW_FLASH_SALE", title: "مشاهده فروش ویژه", description: "یک فروش ویژه را مشاهده کنید.", target: 1, rewardPoints: 5, icon: "Zap", href: "/flash", displayOrder: 2 },
  { key: "daily_bid", kind: "DAILY", type: "PLACE_BID", title: "شرکت در مزایده", description: "روی یک مزایده پیشنهاد ثبت کنید.", target: 1, rewardPoints: 15, icon: "Gavel", href: "/auctions", displayOrder: 3 },
  { key: "weekly_invite", kind: "WEEKLY", type: "INVITE_FRIEND", title: "دعوت دوستان", description: "این هفته یک دوست دعوت کنید.", target: 1, rewardPoints: 50, icon: "UserPlus", href: "/invite", displayOrder: 4 },
  { key: "weekly_giveaway", kind: "WEEKLY", type: "ENTER_GIVEAWAY", title: "شرکت در قرعه‌کشی", description: "این هفته در یک قرعه‌کشی شرکت کنید.", target: 1, rewardPoints: 20, icon: "Gift", href: "/giveaways", displayOrder: 5 },
  { key: "weekly_purchase", kind: "WEEKLY", type: "MAKE_PURCHASE", title: "خرید هفتگی", description: "این هفته یک خرید انجام دهید.", target: 1, rewardPoints: 40, icon: "ShoppingBag", href: "/shop", displayOrder: 6 },
  { key: "onboard_profile", kind: "WEEKLY", type: "COMPLETE_PROFILE", title: "تکمیل پروفایل", description: "اطلاعات پروفایل خود را کامل کنید.", target: 1, rewardPoints: 30, icon: "UserCog", href: "/profile", displayOrder: 7 },
]

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
  console.log("[demo-seed] starting…")

  // ----- 0. Wipe demo/transactional data (children → parents) -------------
  const wipe: Array<[string, () => Promise<unknown>]> = [
    ["emailEvent", () => prisma.emailEvent.deleteMany()],
    ["emailJob", () => prisma.emailJob.deleteMany()],
    ["alertEvent", () => prisma.alertEvent.deleteMany()],
    ["metricSample", () => prisma.metricSample.deleteMany()],
    ["errorEvent", () => prisma.errorEvent.deleteMany()],
    ["serviceHealth", () => prisma.serviceHealth.deleteMany()],
    ["ticketMessage", () => prisma.ticketMessage.deleteMany()],
    ["supportTicket", () => prisma.supportTicket.deleteMany()],
    ["review", () => prisma.review.deleteMany()],
    ["delivery", () => prisma.delivery.deleteMany()],
    ["order", () => prisma.order.deleteMany()],
    ["bid", () => prisma.bid.deleteMany()],
    ["watchlistEntry", () => prisma.watchlistEntry.deleteMany()],
    ["stockAlert", () => prisma.stockAlert.deleteMany()],
    ["auction", () => prisma.auction.deleteMany()],
    ["giveawayWinner", () => prisma.giveawayWinner.deleteMany()],
    ["giveawayEntry", () => prisma.giveawayEntry.deleteMany()],
    ["giveaway", () => prisma.giveaway.deleteMany()],
    ["fixedSale", () => prisma.fixedSale.deleteMany()],
    ["inventoryItem", () => prisma.inventoryItem.deleteMany()],
    ["categoryFollow", () => prisma.categoryFollow.deleteMany()],
    ["product", () => prisma.product.deleteMany()],
    ["couponRedemption", () => prisma.couponRedemption.deleteMany()],
    ["coupon", () => prisma.coupon.deleteMany()],
    ["refundRequest", () => prisma.refundRequest.deleteMany()],
    ["withdrawalRequest", () => prisma.withdrawalRequest.deleteMany()],
    ["depositRequest", () => prisma.depositRequest.deleteMany()],
    ["ledgerLeg", () => prisma.ledgerLeg.deleteMany()],
    ["ledgerEntry", () => prisma.ledgerEntry.deleteMany()],
    ["ledgerAccount", () => prisma.ledgerAccount.deleteMany()],
    ["currencyConversion", () => prisma.currencyConversion.deleteMany()],
    ["walletTransaction", () => prisma.walletTransaction.deleteMany()],
    ["wallet", () => prisma.wallet.deleteMany()],
    ["pointLedger", () => prisma.pointLedger.deleteMany()],
    ["userBadge", () => prisma.userBadge.deleteMany()],
    ["userMission", () => prisma.userMission.deleteMany()],
    ["notification", () => prisma.notification.deleteMany()],
    ["auditLog", () => prisma.auditLog.deleteMany()],
    ["authToken", () => prisma.authToken.deleteMany()],
    ["user", () => prisma.user.deleteMany()],
  ]
  for (const [name, fn] of wipe) {
    try { await fn() } catch (e) { console.warn(`[wipe] ${name}: ${(e as Error).message}`) }
  }
  console.log("[demo-seed] wiped old data")

  // ----- 1. Structural data (idempotent) ----------------------------------
  for (const c of CURRENCIES) await prisma.currency.upsert({ where: { code: c.code }, create: c, update: c })
  for (const r of INITIAL_RATES) {
    const existing = await prisma.exchangeRate.findFirst({ where: { baseCode: r.from, quoteCode: r.to }, orderBy: { createdAt: "desc" } })
    if (!existing) await prisma.exchangeRate.create({ data: { baseCode: r.from, quoteCode: r.to, rate: r.rate } })
  }
  for (const b of BADGES) await prisma.badge.upsert({ where: { code: b.code }, create: b, update: b })
  for (const m of MISSIONS) await prisma.mission.upsert({ where: { key: m.key }, create: m as never, update: m as never })
  const missionRows = await prisma.mission.findMany()
  console.log("[demo-seed] structural ready")

  // ----- 2. Users ----------------------------------------------------------
  type U = {
    id: string; displayName: string; alias: string; role: "USER" | "ADMIN"; index: number
    vipTier: string; vipManual: boolean; isPremium: boolean; status: "ACTIVE" | "BANNED"
    createdAt: Date; lastLoginDay: string | null; loginStreak: number; loyaltyPoints: number
    lifetimePoints: number; totalSpent: bigint; referredById: string | null; converted: boolean
    bal: bigint; frozen: bigint; usd: bigint | null; usdt: bigint | null
  }
  const users: U[] = []

  // Admin (loginable: admin@demo.subio / DemoAdmin!2026)
  const adminHash = await argon2.hash("DemoAdmin!2026", { type: argon2.argon2id })
  const admin: U = {
    id: id(), displayName: "مدیر سیستم", alias: "Admin", role: "ADMIN", index: 0,
    vipTier: "DIAMOND", vipManual: true, isPremium: true, status: "ACTIVE",
    createdAt: daysAgo(180), lastLoginDay: dayKey(new Date()), loginStreak: 42,
    loyaltyPoints: 5000, lifetimePoints: 12000, totalSpent: big(48_000_000),
    referredById: null, converted: false, bal: big(0), frozen: 0n, usd: null, usdt: null,
  }
  users.push(admin)

  for (let i = 1; i <= USER_COUNT; i++) {
    const createdAt = daysAgo(rnd(0, 180))
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / DAY)
    // recency of last login drives DAU / active windows on the growth dashboard
    let lastLoginDay: string | null = null
    const r = Math.random()
    if (r < 0.32) lastLoginDay = dayKey(new Date())
    else if (r < 0.62) lastLoginDay = dayKey(daysAgo(rnd(1, 6)))
    else if (r < 0.82) lastLoginDay = dayKey(daysAgo(rnd(7, 29)))
    else if (r < 0.92) lastLoginDay = dayKey(daysAgo(rnd(30, 90)))
    const tier = pick(TIER_POOL)
    const vipManual = chance(0.05)
    const lifetimePoints = rnd(0, 8000)
    const referredById = i > 12 && chance(0.45) ? users[rnd(1, Math.min(i - 1, users.length - 1))].id : null
    const converted = referredById ? chance(0.6) : false
    users.push({
      id: id(),
      displayName: `${pick(FIRST)} ${pick(LAST)[0]}.`,
      alias: `Bidder#${(1000 + i)}`,
      role: "USER",
      index: i,
      vipTier: tier,
      vipManual,
      isPremium: chance(0.25),
      status: chance(0.04) ? "BANNED" : "ACTIVE",
      createdAt,
      lastLoginDay,
      loginStreak: lastLoginDay ? rnd(1, Math.min(ageDays + 1, 45)) : 0,
      loyaltyPoints: Math.min(lifetimePoints, rnd(0, lifetimePoints || 1)),
      lifetimePoints,
      totalSpent: big(rnd(0, 60) * 1_000_000),
      referredById,
      converted,
      bal: big(rnd(0, 50) * 500_000),
      frozen: chance(0.25) ? big(rnd(1, 8) * 250_000) : 0n,
      usd: chance(0.18) ? big(rnd(5, 400) * 100) : null,
      usdt: chance(0.1) ? big(rnd(5, 300) * 100) : null,
    })
  }

  const userRows: Prisma.UserCreateManyInput[] = users.map((u) => ({
    id: u.id,
    email: u.role === "ADMIN" ? "admin@demo.subio" : `user${u.index}@demo.subio`,
    passwordHash: u.role === "ADMIN" ? adminHash : null,
    emailVerified: u.role === "ADMIN" ? true : chance(0.7),
    lastLoginMethod: chance(0.5) ? "telegram" : "password",
    telegramId: chance(0.7) ? `${500_000_000 + u.index}` : null,
    telegramChatId: chance(0.7) ? `${500_000_000 + u.index}` : null,
    telegramUsername: chance(0.5) ? `tg_user_${u.index}` : null,
    languageCode: "fa",
    isPremium: u.isPremium,
    username: u.role === "ADMIN" ? "admin" : `user${u.index}`,
    displayName: u.displayName,
    alias: u.alias,
    role: u.role as never,
    status: u.status as never,
    createdAt: u.createdAt,
    referralCode: `REF${(100000 + u.index).toString(36).toUpperCase()}`,
    referredById: u.referredById,
    referralRewarded: u.converted,
    referralJoinRewarded: !!u.referredById,
    loyaltyPoints: u.loyaltyPoints,
    lifetimePoints: u.lifetimePoints,
    totalSpent: u.totalSpent,
    vipTier: u.vipTier as never,
    vipSince: u.vipTier !== "STANDARD" ? daysAgo(rnd(0, 60)) : null,
    vipManual: u.vipManual,
    vipManualExpiresAt: u.vipManual ? daysAgo(-rnd(10, 120)) : null,
    lastLoginDay: u.lastLoginDay,
    loginStreak: u.loginStreak,
    profileCompleted: chance(0.65),
    onboardedAt: chance(0.8) ? u.createdAt : null,
  }))
  await insertMany(prisma.user, userRows)
  console.log(`[demo-seed] users: ${userRows.length}`)

  // ----- 3. Wallets + ledger accounts + wallet transactions ----------------
  type WalletPlan = { walletId: string; userId: string; currency: string; total: bigint; frozen: bigint }
  const wallets: WalletPlan[] = []
  for (const u of users) {
    wallets.push({ walletId: id(), userId: u.id, currency: "IRT", total: u.bal, frozen: u.frozen })
    if (u.usd != null) wallets.push({ walletId: id(), userId: u.id, currency: "USD", total: u.usd, frozen: 0n })
    if (u.usdt != null) wallets.push({ walletId: id(), userId: u.id, currency: "USDT", total: u.usdt, frozen: 0n })
  }
  await insertMany(prisma.wallet, wallets.map((w) => ({
    id: w.walletId, userId: w.userId, currency: w.currency,
    totalBalance: w.total, frozenBalance: w.frozen,
    createdAt: daysAgo(rnd(30, 180)),
  })) as Prisma.WalletCreateManyInput[])

  // Ledger accounts that mirror wallet balances so reconciliation rebuilds
  // identical totals. led.total = USER_AVAILABLE + USER_FROZEN, led.frozen = USER_FROZEN.
  const ledgerAccounts: Prisma.LedgerAccountCreateManyInput[] = []
  const perCurrencyUserTotal = new Map<string, bigint>()
  for (const w of wallets) {
    perCurrencyUserTotal.set(w.currency, (perCurrencyUserTotal.get(w.currency) ?? 0n) + w.total)
    ledgerAccounts.push({ id: id(), kind: "USER_AVAILABLE" as never, ownerUserId: w.userId, currency: w.currency, balance: w.total - w.frozen })
    if (w.frozen > 0n) ledgerAccounts.push({ id: id(), kind: "USER_FROZEN" as never, ownerUserId: w.userId, currency: w.currency, balance: w.frozen })
  }
  // System accounts that make each currency zero-sum (assets+liab+equity == 0).
  for (const [currency, tu] of perCurrencyUserTotal) {
    const revenue = (tu * 35n) / 100n // SYS_REVENUE stored negative → shown positive
    const promo = (tu * 5n) / 100n
    const payable = (tu * 8n) / 100n
    // SYS_CASH is the balancing plug so the whole currency sums to zero.
    const cash = -tu - (-revenue + -promo + -payable)
    ledgerAccounts.push(
      { id: id(), kind: "SYS_REVENUE" as never, ownerUserId: null, currency, balance: -revenue },
      { id: id(), kind: "SYS_PROMO_EXPENSE" as never, ownerUserId: null, currency, balance: -promo },
      { id: id(), kind: "SYS_WITHDRAWALS_PAYABLE" as never, ownerUserId: null, currency, balance: -payable },
      { id: id(), kind: "SYS_CASH" as never, ownerUserId: null, currency, balance: cash },
    )
  }
  await insertMany(prisma.ledgerAccount, ledgerAccounts)

  // Wallet transactions — 3–9 per IRT wallet, ending at the wallet's balance,
  // spread across the last ~45 days so the finance inflow/outflow chart fills.
  const TX_TYPES_IN = ["DEPOSIT", "CASHBACK", "REFERRAL_BONUS", "REFUND"] as const
  const TX_TYPES_OUT = ["PURCHASE", "WITHDRAWAL"] as const
  const walletTx: Prisma.WalletTransactionCreateManyInput[] = []
  for (const w of wallets) {
    if (w.currency !== "IRT") continue
    const n = rnd(3, 9)
    const dates = Array.from({ length: n }, () => daysAgo(rnd(0, 45))).sort((a, b) => a.getTime() - b.getTime())
    let running = 0n
    for (let k = 0; k < n; k++) {
      const isLast = k === n - 1
      let type: string
      let delta: bigint
      if (isLast) {
        // final tx forces the running balance to equal the wallet balance
        delta = w.total - running
        type = delta >= 0n ? "DEPOSIT" : "PURCHASE"
      } else if (chance(0.62)) {
        type = pick(TX_TYPES_IN)
        delta = big(rnd(1, 12) * 250_000)
      } else {
        type = pick(TX_TYPES_OUT)
        delta = -big(rnd(1, 6) * 200_000)
        if (running + delta < 0n) { type = "DEPOSIT"; delta = -delta }
      }
      running += delta
      walletTx.push({
        id: id(), walletId: w.walletId, type: type as never, currency: "IRT",
        amount: delta, balanceAfter: running, frozenAfter: isLast ? w.frozen : 0n,
        refType: type === "PURCHASE" ? "order" : type === "DEPOSIT" ? "deposit" : null,
        note: null, createdAt: dates[k],
      })
    }
  }
  await insertMany(prisma.walletTransaction, walletTx)
  console.log(`[demo-seed] wallets: ${wallets.length}, ledgerAccounts: ${ledgerAccounts.length}, walletTx: ${walletTx.length}`)

  // ----- 4. Gamification: point ledger, badges, missions -------------------
  const pointLedger: Prisma.PointLedgerCreateManyInput[] = []
  const userBadges: Prisma.UserBadgeCreateManyInput[] = []
  const userMissions: Prisma.UserMissionCreateManyInput[] = []
  const POINT_REASONS = ["PURCHASE", "REFERRAL", "DAILY_LOGIN", "MISSION_REWARD", "ACHIEVEMENT", "GIVEAWAY_ENTRY", "PROFILE_COMPLETE"] as const
  for (const u of users) {
    let bal = 0
    const n = rnd(1, 5)
    for (let k = 0; k < n; k++) {
      const delta = rnd(5, 200)
      bal += delta
      pointLedger.push({
        id: id(), userId: u.id, delta, balanceAfter: bal,
        reason: pick(POINT_REASONS) as never, refType: null, note: null, createdAt: daysAgo(rnd(0, 90)),
      })
    }
    // badges
    const badgeCount = rnd(0, 3)
    const chosen = new Set<string>()
    for (let k = 0; k < badgeCount; k++) chosen.add(pick(BADGE_CODES))
    for (const code of chosen) userBadges.push({ id: id(), userId: u.id, badgeCode: code, awardedAt: daysAgo(rnd(0, 120)) })
    // mission progress (current period)
    const todayKey = dayKey(new Date())
    for (const m of missionRows) {
      if (!chance(0.4)) continue
      const done = chance(0.5)
      userMissions.push({
        id: id(), userId: u.id, missionId: m.id,
        periodKey: m.kind === "DAILY" ? todayKey : weekKey(new Date()),
        progress: done ? m.target : rnd(0, Math.max(0, m.target - 1)),
        completedAt: done ? daysAgo(0) : null,
        claimedAt: done && chance(0.6) ? daysAgo(0) : null,
      })
    }
  }
  await insertMany(prisma.pointLedger, pointLedger)
  await insertMany(prisma.userBadge, userBadges)
  await insertMany(prisma.userMission, userMissions)
  console.log(`[demo-seed] pointLedger: ${pointLedger.length}, userBadges: ${userBadges.length}, userMissions: ${userMissions.length}`)

  // ----- 5. Products (flash + auctions) + inventory ------------------------
  type Prod = { id: string; title: string; cat: string; mode: "FIXED_PRICE" | "AUCTION"; price: bigint; automatic: boolean }
  const products: Prod[] = []
  const productRows: Prisma.ProductCreateManyInput[] = []
  const fixedSales: Prisma.FixedSaleCreateManyInput[] = []
  const inventory: Prisma.InventoryItemCreateManyInput[] = []

  for (let i = 0; i < PRODUCT_FLASH; i++) {
    const def = FLASH_TITLES[i % FLASH_TITLES.length]
    const pid = id()
    const automatic = chance(0.6)
    const price = big(def.price)
    products.push({ id: pid, title: def.title, cat: def.cat, mode: "FIXED_PRICE", price, automatic })
    productRows.push({
      id: pid, slug: slugOf("flash"), title: def.title,
      description: "تحویل آنی و خودکار پس از پرداخت. گارانتی اصالت و پشتیبانی کامل.",
      category: def.cat, tags: [def.cat.toLowerCase(), "flash"], coverImage: null,
      saleMode: "FIXED_PRICE" as never, deliveryType: (automatic ? "AUTOMATIC" : "MANUAL") as never,
      hidden: chance(0.08), active: true, createdAt: daysAgo(rnd(1, 150)),
    })
    const stock = rnd(3, 60)
    const sold = rnd(0, stock)
    fixedSales.push({
      id: id(), productId: pid, price, stock, soldCount: sold, soldBaseline: rnd(20, 500),
      purchaseLimit: chance(0.4) ? rnd(1, 3) : null,
      bulkMinQty: chance(0.3) ? 3 : null, bulkDiscountPercent: chance(0.3) ? 10 : null,
      startTime: daysAgo(rnd(1, 30)), endTime: chance(0.6) ? daysAgo(-rnd(1, 20)) : null,
    })
    if (automatic) for (let k = 0; k < rnd(4, 12); k++) {
      inventory.push({
        id: id(), productId: pid, username: `acct_${i}_${k}@subio.mail`,
        password: randomUUID().slice(0, 12), licenseKey: chance(0.5) ? randomBytes(8).toString("hex").toUpperCase() : null,
        status: (chance(0.4) ? "DELIVERED" : "AVAILABLE") as never, createdAt: daysAgo(rnd(0, 60)),
      })
    }
  }

  type Auc = { auctionId: string; productId: string; status: string; start: bigint; current: bigint; endTime: Date }
  const auctions: Auc[] = []
  const auctionRows: Prisma.AuctionCreateManyInput[] = []
  const now = Date.now()
  for (let i = 0; i < PRODUCT_AUCTION; i++) {
    const def = AUCTION_TITLES[i % AUCTION_TITLES.length]
    const pid = id()
    const automatic = chance(0.4)
    const start = big(def.start)
    products.push({ id: pid, title: def.title, cat: def.cat, mode: "AUCTION", price: start, automatic })
    productRows.push({
      id: pid, slug: slugOf("auction"), title: def.title,
      description: "مزایده با ضد-اسنایپینگ. برنده پس از پایان مشخص می‌شود.",
      category: def.cat, tags: [def.cat.toLowerCase(), "auction"], coverImage: null,
      saleMode: "AUCTION" as never, deliveryType: (automatic ? "AUTOMATIC" : "MANUAL") as never,
      hidden: false, active: true, createdAt: daysAgo(rnd(1, 90)),
    })
    // status mix: active / scheduled / ended / finalized
    const roll = Math.random()
    let status: string, startTime: Date, endTime: Date
    if (roll < 0.4) { status = "ACTIVE"; startTime = minsAgo(rnd(30, 600)); endTime = new Date(now + rnd(10, 360) * 60_000) }
    else if (roll < 0.55) { status = "SCHEDULED"; startTime = new Date(now + rnd(30, 600) * 60_000); endTime = new Date(now + rnd(700, 2000) * 60_000) }
    else if (roll < 0.78) { status = "FINALIZED"; startTime = daysAgo(rnd(10, 40)); endTime = daysAgo(rnd(1, 9)) }
    else { status = "ENDED"; startTime = daysAgo(rnd(2, 10)); endTime = minsAgo(rnd(30, 600)) }
    const bidsUp = status === "SCHEDULED" ? 0 : rnd(0, 14)
    const current = bidsUp > 0 ? start + big(bidsUp) * (start / 20n + 1n) : (status === "SCHEDULED" ? 0n : start)
    auctions.push({ auctionId: id(), productId: pid, status, start, current, endTime })
    auctionRows.push({
      id: auctions[auctions.length - 1].auctionId, productId: pid, startPrice: start, currentPrice: current,
      minimumIncrement: start / 20n + 1n, reservePrice: chance(0.5) ? start + start / 3n : null,
      buyNowPrice: chance(0.5) ? start * 3n : null, startTime, endTime,
      antiSnipingEnabled: true, antiSnipingSeconds: 120, autoExtend: true,
      quantity: chance(0.2) ? 2 : 1, status: status as never,
      finalizedAt: status === "FINALIZED" ? endTime : null, createdAt: startTime,
    })
    if (automatic) for (let k = 0; k < rnd(1, 3); k++) {
      inventory.push({ id: id(), productId: pid, username: `auc_${i}_${k}@subio.mail`, password: randomUUID().slice(0, 10), status: "AVAILABLE" as never, createdAt: startTime })
    }
  }
  await insertMany(prisma.product, productRows)
  await insertMany(prisma.fixedSale, fixedSales)
  await insertMany(prisma.auction, auctionRows)
  await insertMany(prisma.inventoryItem, inventory)
  console.log(`[demo-seed] products: ${productRows.length}, fixedSales: ${fixedSales.length}, auctions: ${auctionRows.length}, inventory: ${inventory.length}`)

  // ----- 6. Bids + watchlists + stock alerts + category follows ------------
  const realUsers = users.filter((u) => u.role === "USER" && u.status === "ACTIVE")
  const bids: Prisma.BidCreateManyInput[] = []
  const watchlist: Prisma.WatchlistEntryCreateManyInput[] = []
  for (const a of auctions) {
    if (a.status === "SCHEDULED") continue
    const nBids = rnd(0, 14)
    let price = a.start
    const inc = a.start / 20n + 1n
    for (let k = 0; k < nBids; k++) {
      price += inc
      const bidder = pick(realUsers)
      bids.push({ id: id(), auctionId: a.auctionId, userId: bidder.id, amount: price, isAuto: chance(0.2), maxAmount: chance(0.2) ? price + inc * 5n : null, createdAt: minsAgo(rnd(5, 1200)) })
    }
    // watchers
    const wset = new Set<string>()
    for (let k = 0; k < rnd(0, 8); k++) wset.add(pick(realUsers).id)
    for (const uid of wset) watchlist.push({ id: id(), userId: uid, auctionId: a.auctionId, notified: chance(0.3), createdAt: daysAgo(rnd(0, 20)) })
  }
  await insertMany(prisma.bid, bids)
  await insertMany(prisma.watchlistEntry, watchlist)

  const flashProducts = products.filter((p) => p.mode === "FIXED_PRICE")
  const stockAlerts: Prisma.StockAlertCreateManyInput[] = []
  const saSeen = new Set<string>()
  for (let k = 0; k < 220; k++) {
    const u = pick(realUsers); const p = pick(flashProducts); const key = `${u.id}:${p.id}`
    if (saSeen.has(key)) continue; saSeen.add(key)
    stockAlerts.push({ id: id(), userId: u.id, productId: p.id, notified: chance(0.3), createdAt: daysAgo(rnd(0, 40)) })
  }
  await insertMany(prisma.stockAlert, stockAlerts)

  const catFollows: Prisma.CategoryFollowCreateManyInput[] = []
  const cfSeen = new Set<string>()
  for (let k = 0; k < 260; k++) {
    const u = pick(realUsers); const c = pick(CATEGORIES); const key = `${u.id}:${c}`
    if (cfSeen.has(key)) continue; cfSeen.add(key)
    catFollows.push({ id: id(), userId: u.id, category: c, createdAt: daysAgo(rnd(0, 60)) })
  }
  await insertMany(prisma.categoryFollow, catFollows)
  console.log(`[demo-seed] bids: ${bids.length}, watchlist: ${watchlist.length}, stockAlerts: ${stockAlerts.length}, categoryFollows: ${catFollows.length}`)

  // ----- 7. Orders + deliveries + reviews ----------------------------------
  const orders: Prisma.OrderCreateManyInput[] = []
  const deliveries: Prisma.DeliveryCreateManyInput[] = []
  const reviews: Prisma.ReviewCreateManyInput[] = []
  const reviewSeen = new Set<string>()
  const ORDER_STATUS_POOL = ["DELIVERED", "DELIVERED", "DELIVERED", "PAID", "PENDING", "REFUNDED", "CANCELLED"] as const
  const auctionByProduct = new Map(auctions.map((a) => [a.productId, a]))
  for (let i = 0; i < ORDER_COUNT; i++) {
    const u = pick(realUsers)
    const p = pick(products)
    const status = pick(ORDER_STATUS_POOL)
    const auc = auctionByProduct.get(p.id)
    let type: string
    if (p.mode === "AUCTION") type = chance(0.5) ? "AUCTION_WIN" : "BUY_NOW"
    else type = "FIXED_PURCHASE"
    const oid = id()
    const createdAt = daysAgo(rnd(0, 60))
    orders.push({
      id: oid, publicId: pubId("ord"), userId: u.id, productId: p.id,
      auctionId: type === "AUCTION_WIN" && auc ? auc.auctionId : null,
      type: type as never, status: status as never, amount: p.price, quantity: 1, createdAt,
    })
    if (status === "DELIVERED" || status === "REFUNDED") {
      deliveries.push({
        id: id(), orderId: oid, method: (p.automatic ? "AUTOMATIC" : "MANUAL") as never,
        status: "DELIVERED" as never,
        payload: { credentials: p.automatic ? "user / pass delivered" : "تحویل دستی توسط پشتیبانی" },
        deliveredAt: createdAt, createdAt,
      })
      // a delivered order may earn a review (unique per user+product)
      if (status === "DELIVERED" && chance(0.45)) {
        const key = `${u.id}:${p.id}`
        if (!reviewSeen.has(key)) {
          reviewSeen.add(key)
          reviews.push({ id: id(), productId: p.id, userId: u.id, rating: rnd(3, 5), comment: pick(["عالی بود، سریع تحویل شد.", "کیفیت خوب، پیشنهاد می‌کنم.", "پشتیبانی پاسخگو بود.", "ارزش خرید داشت.", "بدون مشکل فعال شد."]), hidden: chance(0.05), createdAt })
        }
      }
    } else if (status === "PAID") {
      deliveries.push({ id: id(), orderId: oid, method: (p.automatic ? "AUTOMATIC" : "MANUAL") as never, status: "PENDING" as never, createdAt })
    }
  }
  await insertMany(prisma.order, orders)
  await insertMany(prisma.delivery, deliveries)
  await insertMany(prisma.review, reviews)
  console.log(`[demo-seed] orders: ${orders.length}, deliveries: ${deliveries.length}, reviews: ${reviews.length}`)

  // ----- 8. Coupons + redemptions ------------------------------------------
  const coupons: Prisma.CouponCreateManyInput[] = []
  const couponIds: string[] = []
  for (let i = 0; i < COUPON_COUNT; i++) {
    const cid = id(); couponIds.push(cid)
    const isPercent = chance(0.6)
    coupons.push({
      id: cid, code: `OFF${randomBytes(3).toString("hex").toUpperCase()}`,
      type: (isPercent ? "PERCENT" : "FIXED") as never,
      value: isPercent ? big(rnd(5, 40)) : big(rnd(1, 5) * 100_000),
      maxDiscount: isPercent ? big(rnd(2, 8) * 100_000) : null, minOrder: big(rnd(0, 3) * 500_000),
      perUserLimit: chance(0.5) ? 1 : null, totalLimit: chance(0.5) ? rnd(50, 500) : null,
      usedCount: rnd(0, 40), active: chance(0.8),
      startsAt: daysAgo(rnd(10, 60)), expiresAt: chance(0.7) ? daysAgo(-rnd(5, 60)) : daysAgo(rnd(1, 10)),
      createdAt: daysAgo(rnd(10, 80)),
    })
  }
  await insertMany(prisma.coupon, coupons)
  // Redemptions tied to distinct orders.
  const redemptions: Prisma.CouponRedemptionCreateManyInput[] = []
  const usedOrders = orders.slice(0, 60)
  for (const o of usedOrders) {
    if (!chance(0.8)) continue
    redemptions.push({ id: id(), couponId: pick(couponIds), userId: o.userId!, orderId: o.id!, amount: big(rnd(1, 5) * 100_000), createdAt: o.createdAt as Date })
  }
  await insertMany(prisma.couponRedemption, redemptions)
  console.log(`[demo-seed] coupons: ${coupons.length}, redemptions: ${redemptions.length}`)

  // ----- 9. Giveaways + entries + winners ----------------------------------
  const giveawayRows: Prisma.GiveawayCreateManyInput[] = []
  const entryRows: Prisma.GiveawayEntryCreateManyInput[] = []
  const winnerRows: Prisma.GiveawayWinnerCreateManyInput[] = []
  const GA_STATUS = ["ACTIVE", "ACTIVE", "SCHEDULED", "FINISHED", "FINISHED", "DRAFT", "LOCKED"] as const
  const GA_PRIZES = [
    { kind: "WALLET", label: "۵۰۰ هزار تومان اعتبار کیف‌پول", amount: 500_000 },
    { kind: "WALLET", label: "۱ میلیون تومان اعتبار", amount: 1_000_000 },
    { kind: "CUSTOM", label: "اشتراک یک‌ساله Netflix 4K", amount: 0 },
    { kind: "CUSTOM", label: "گیفت‌کارت ۵۰ دلاری استیم", amount: 0 },
    { kind: "COUPON", label: "کوپن تخفیف ۳۰٪", amount: 0 },
  ]
  for (let i = 0; i < GIVEAWAY_COUNT; i++) {
    const gid = id()
    const status = pick(GA_STATUS)
    const prize = pick(GA_PRIZES)
    const isFinished = status === "FINISHED"
    const startAt = isFinished ? daysAgo(rnd(20, 50)) : (status === "SCHEDULED" ? daysAgo(-rnd(2, 10)) : daysAgo(rnd(1, 15)))
    const endAt = isFinished ? daysAgo(rnd(5, 19)) : daysAgo(-rnd(1, 14))
    const drawAt = isFinished ? daysAgo(rnd(1, 4)) : daysAgo(-rnd(1, 16))
    const winnersCount = rnd(1, 3)
    giveawayRows.push({
      id: gid, slug: slugOf("ga"), title: `قرعه‌کشی ${prize.label}`, subtitle: "ویژه کاربران فعال",
      description: "برای شرکت در قرعه‌کشی کافیست عضو کانال‌های اعلام‌شده باشید.", prizeLabel: prize.label,
      prizeKind: prize.kind as never, prizeAmount: prize.amount ? big(prize.amount) : null,
      couponType: prize.kind === "COUPON" ? ("PERCENT" as never) : null,
      couponValue: prize.kind === "COUPON" ? 30n : null, couponExpiresInDays: prize.kind === "COUPON" ? 14 : null,
      winnersCount, requiredChannels: [{ id: "-100123", title: "کانال رسمی", url: "https://t.me/subio" }],
      startAt, endAt, drawAt, timezone: "Asia/Tehran", status: status as never,
      visibility: "PUBLIC" as never, autoDraw: chance(0.4),
      drawSeed: isFinished ? randomBytes(8).toString("hex") : null, drawnAt: isFinished ? drawAt : null,
      createdAt: daysAgo(rnd(20, 60)),
    })
    if (status === "DRAFT") continue
    // entries (unique per user)
    const entrants = new Set<string>()
    const target = rnd(20, 70)
    while (entrants.size < target) entrants.add(pick(realUsers).id)
    const entrantList = [...entrants]
    const entryIdByUser = new Map<string, string>()
    for (const uid of entrantList) {
      const eid = id(); entryIdByUser.set(uid, eid)
      entryRows.push({ id: eid, giveawayId: gid, userId: uid, telegramId: `${500_000_000}`, source: (chance(0.5) ? "BOT" : "WEB") as never, eligible: chance(0.92), createdAt: daysAgo(rnd(1, 18)) })
    }
    if (isFinished) {
      const winners = entrantList.slice(0, Math.min(winnersCount, entrantList.length))
      winners.forEach((uid, idx) => {
        winnerRows.push({
          id: id(), giveawayId: gid, entryId: entryIdByUser.get(uid)!, userId: uid, position: idx + 1,
          delivered: chance(0.7), deliveredAt: chance(0.7) ? drawAt : null,
          claimData: prize.kind === "COUPON" ? { code: `WIN${randomBytes(2).toString("hex").toUpperCase()}` } : undefined,
          createdAt: drawAt,
        })
      })
    }
  }
  await insertMany(prisma.giveaway, giveawayRows)
  await insertMany(prisma.giveawayEntry, entryRows)
  await insertMany(prisma.giveawayWinner, winnerRows)
  console.log(`[demo-seed] giveaways: ${giveawayRows.length}, entries: ${entryRows.length}, winners: ${winnerRows.length}`)

  // ----- 10. Deposit / withdrawal / refund queues --------------------------
  const deposits: Prisma.DepositRequestCreateManyInput[] = []
  const depApproved: Array<{ userId: string; cardLast4: string }> = []
  const DEP_STATUS = ["PENDING", "PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED"] as const
  for (let i = 0; i < DEPOSIT_COUNT; i++) {
    const u = pick(realUsers); const status = pick(DEP_STATUS); const last4 = String(rnd(1000, 9999))
    if (status === "APPROVED") depApproved.push({ userId: u.id, cardLast4: last4 })
    deposits.push({
      id: id(), publicId: pubId("dep"), userId: u.id, amount: big(rnd(1, 20) * 250_000),
      status: status as never, cardLast4: last4, reference: "TRX-" + randomBytes(3).toString("hex").toUpperCase(),
      note: "واریز کارت‌به‌کارت", reviewedById: status !== "PENDING" ? admin.id : null,
      reviewedAt: status !== "PENDING" ? daysAgo(rnd(0, 30)) : null,
      rejectReason: status === "REJECTED" ? "رسید نامعتبر بود" : null, createdAt: daysAgo(rnd(0, 45)),
    })
  }
  await insertMany(prisma.depositRequest, deposits)

  const withdrawals: Prisma.WithdrawalRequestCreateManyInput[] = []
  const WD_STATUS = ["PENDING", "PENDING", "APPROVED", "PAID", "PAID", "REJECTED"] as const
  for (let i = 0; i < WITHDRAWAL_COUNT; i++) {
    const u = pick(realUsers); const status = pick(WD_STATUS)
    withdrawals.push({
      id: id(), publicId: pubId("wd"), userId: u.id, amount: big(rnd(1, 12) * 250_000),
      status: status as never, iban: "IR" + String(rnd(10, 99)) + randomBytes(11).toString("hex").replace(/\D/g, "0").slice(0, 22).padEnd(22, "0"),
      cardNumber: `6037-99**-****-${rnd(1000, 9999)}`, note: "درخواست برداشت",
      reviewedById: status !== "PENDING" ? admin.id : null, reviewedAt: status !== "PENDING" ? daysAgo(rnd(0, 25)) : null,
      rejectReason: status === "REJECTED" ? "اطلاعات حساب ناقص" : null, createdAt: daysAgo(rnd(0, 40)),
    })
  }
  await insertMany(prisma.withdrawalRequest, withdrawals)

  const refunds: Prisma.RefundRequestCreateManyInput[] = []
  const RF_STATUS = ["PENDING", "PENDING", "APPROVED", "PAID", "REJECTED"] as const
  for (let i = 0; i < REFUND_COUNT; i++) {
    const u = pick(realUsers); const status = pick(RF_STATUS); const match = depApproved[i % Math.max(1, depApproved.length)]
    const last4 = String(rnd(1000, 9999))
    refunds.push({
      id: id(), publicId: pubId("rf"), userId: u.id, amount: big(rnd(1, 8) * 250_000), status: status as never,
      fullName: `${pick(FIRST)} ${pick(LAST)}`, nationalId: String(rnd(1000000000, 1999999999)),
      nationalCardUrl: "https://example.com/kyc/sample.jpg", cardNumber: `6037-9971-1234-${last4}`, cardLast4: last4,
      iban: null, reason: "انصراف از خرید", matchedDepositId: match ? null : null,
      reviewedById: status !== "PENDING" ? admin.id : null, reviewedAt: status !== "PENDING" ? daysAgo(rnd(0, 20)) : null,
      rejectReason: status === "REJECTED" ? "کارت مقصد با واریزی‌ها هم‌خوان نبود" : null, createdAt: daysAgo(rnd(0, 35)),
    })
  }
  await insertMany(prisma.refundRequest, refunds)
  console.log(`[demo-seed] deposits: ${deposits.length}, withdrawals: ${withdrawals.length}, refunds: ${refunds.length}`)

  // ----- 11. Support tickets + threaded messages ---------------------------
  const tickets: Prisma.SupportTicketCreateManyInput[] = []
  const ticketMsgs: Prisma.TicketMessageCreateManyInput[] = []
  const TK_STATUS = ["OPEN", "OPEN", "ANSWERED", "PENDING", "CLOSED", "CLOSED"] as const
  const TK_CAT = ["GENERAL", "PAYMENT", "ORDER", "REFUND", "TECHNICAL"] as const
  const SUBJECTS = ["مشکل در تحویل سفارش", "تأیید واریز انجام نشد", "سوال درباره مزایده", "درخواست استرداد وجه", "اکانت فعال نمی‌شود", "کد تخفیف کار نمی‌کند", "تغییر ایمیل حساب"]
  for (let i = 0; i < TICKET_COUNT; i++) {
    const u = pick(realUsers); const status = pick(TK_STATUS); const tid = id()
    const created = daysAgo(rnd(0, 40)); let last = created
    tickets.push({ id: tid, publicId: pubId("tk"), userId: u.id, subject: pick(SUBJECTS), category: pick(TK_CAT) as never, status: status as never, lastReplyAt: created, createdAt: created })
    const turns = rnd(1, 5)
    for (let k = 0; k < turns; k++) {
      const fromStaff = k % 2 === 1
      last = new Date(created.getTime() + k * rnd(20, 600) * 60_000)
      ticketMsgs.push({ id: id(), ticketId: tid, authorId: fromStaff ? admin.id : u.id, fromStaff, body: fromStaff ? "سلام، در حال بررسی درخواست شما هستیم. لطفاً اطلاعات بیشتری ارسال کنید." : "سلام، لطفاً مشکل من را بررسی کنید. ممنون.", createdAt: last })
    }
    // fix lastReplyAt to the final message time
    tickets[tickets.length - 1].lastReplyAt = last
  }
  await insertMany(prisma.supportTicket, tickets)
  await insertMany(prisma.ticketMessage, ticketMsgs)
  console.log(`[demo-seed] tickets: ${tickets.length}, ticketMessages: ${ticketMsgs.length}`)

  // ----- 12. Notifications -------------------------------------------------
  const NOTIF_TYPES = ["GENERAL", "ORDER_DELIVERED", "AUCTION_WON", "AUCTION_OUTBID", "DEPOSIT_APPROVED", "CASHBACK", "REFERRAL_BONUS", "GIVEAWAY_WON", "PRICE_DROP", "VIP_UPGRADED", "POINTS_EARNED", "BADGE_AWARDED"] as const
  const notifications: Prisma.NotificationCreateManyInput[] = []
  for (const u of realUsers) {
    for (let k = 0; k < rnd(1, 7); k++) {
      const type = pick(NOTIF_TYPES)
      notifications.push({
        id: id(), userId: u.id, type: type as never,
        title: notifTitle(type), body: "جزئیات بیشتر را در حساب کاربری خود مشاهده کنید.",
        href: "/notifications", read: chance(0.55), archived: chance(0.1), createdAt: daysAgo(rnd(0, 30)),
      })
    }
  }
  await insertMany(prisma.notification, notifications)
  console.log(`[demo-seed] notifications: ${notifications.length}`)

  // ----- 13. Audit log -----------------------------------------------------
  const AUDIT_ACTIONS = [
    ["deposit.approve", "DepositRequest"], ["withdrawal.reject", "WithdrawalRequest"], ["product.create", "Product"],
    ["product.update", "Product"], ["auction.cancel", "Auction"], ["user.ban", "User"], ["coupon.create", "Coupon"],
    ["giveaway.draw", "Giveaway"], ["refund.approve", "RefundRequest"], ["settings.update", "Setting"], ["order.refund", "Order"],
  ] as const
  const auditLogs: Prisma.AuditLogCreateManyInput[] = []
  for (let i = 0; i < AUDIT_COUNT; i++) {
    const [action, entity] = pick(AUDIT_ACTIONS)
    auditLogs.push({ id: id(), actorId: admin.id, action, entity, entityId: id(), meta: { ip: `185.${rnd(1, 254)}.${rnd(1, 254)}.${rnd(1, 254)}` }, createdAt: daysAgo(rnd(0, 60)) })
  }
  await insertMany(prisma.auditLog, auditLogs)
  console.log(`[demo-seed] auditLogs: ${auditLogs.length}`)

  // ----- 14. Operations Center telemetry -----------------------------------
  // Metric samples — 48h @ 30-min intervals for a representative set.
  const METRIC_PLAN: Array<{ name: string; base: number; jitter: number; spikeAt?: number }> = [
    { name: "system.cpu.usage", base: 38, jitter: 22 },
    { name: "system.mem.usage", base: 61, jitter: 12 },
    { name: "system.disk.usage", base: 57, jitter: 4 },
    { name: "app.rps", base: 120, jitter: 90 },
    { name: "app.error_rate", base: 0.8, jitter: 1.4, spikeAt: 12 },
    { name: "app.latency.p95", base: 420, jitter: 380 },
    { name: "app.active_users", base: 240, jitter: 160 },
    { name: "db.latency", base: 28, jitter: 30 },
    { name: "redis.latency", base: 8, jitter: 12 },
    { name: "cache.hit_ratio", base: 88, jitter: 8 },
    { name: "biz.orders_per_min", base: 6, jitter: 6 },
    { name: "biz.revenue_window", base: 4_500_000, jitter: 3_000_000 },
    { name: "biz.active_users", base: 210, jitter: 120 },
    { name: "email.queue.size", base: 12, jitter: 30 },
  ]
  const samples: Prisma.MetricSampleCreateManyInput[] = []
  const points = 96 // 48h * 2
  for (const m of METRIC_PLAN) {
    for (let t = points; t >= 0; t--) {
      const spike = m.spikeAt && t === m.spikeAt ? m.jitter * 2.5 : 0
      const v = Math.max(0, m.base + (Math.random() - 0.5) * m.jitter + spike)
      samples.push({ id: id(), name: m.name, value: Math.round(v * 100) / 100, labels: undefined, capturedAt: minsAgo(t * 30) })
    }
  }
  await insertMany(prisma.metricSample, samples, 1000)

  // Service health snapshots.
  const SERVICES = ["web", "miniapp", "admin", "api", "ws", "queue", "worker", "cron", "postgres", "redis", "nginx", "bot", "webhook", "email", "payments", "external_api"]
  const serviceHealth: Prisma.ServiceHealthCreateManyInput[] = SERVICES.map((s) => {
    const roll = Math.random()
    const status = roll < 0.82 ? "UP" : roll < 0.93 ? "DEGRADED" : "DOWN"
    return { id: id(), service: s, status: status as never, latencyMs: Math.round(rnd(3, 320) * 10) / 10, message: status === "UP" ? "OK" : status === "DEGRADED" ? "تأخیر بالاتر از حد معمول" : "عدم پاسخ‌دهی", checkedAt: minsAgo(rnd(0, 5)) }
  })
  await insertMany(prisma.serviceHealth, serviceHealth)

  // Error events.
  const ERR_SOURCES = ["WEB", "MINIAPP", "BOT", "API", "SERVER_ACTION", "WORKER", "CRON", "WEBHOOK"] as const
  const ERR_NAMES = ["TypeError", "PrismaClientKnownRequestError", "FetchError", "TimeoutError", "ValidationError", "TelegramApiError", "RedisConnectionError"]
  const errors: Prisma.ErrorEventCreateManyInput[] = []
  for (let i = 0; i < 26; i++) {
    const name = pick(ERR_NAMES); const source = pick(ERR_SOURCES); const resolved = chance(0.5)
    errors.push({
      id: id(), level: pick(["error", "error", "warning", "fatal"]), source: source as never, name,
      message: `${name}: ${pick(["unexpected token", "connection reset", "request timed out", "record not found", "rate limit exceeded"])}`,
      stack: `at handler (app/api/route.ts:${rnd(10, 200)}:${rnd(1, 40)})`, fingerprint: `${source}:${name}:${i}`,
      count: rnd(1, 240), resolved, resolvedAt: resolved ? minsAgo(rnd(10, 2000)) : null,
      firstSeenAt: daysAgo(rnd(2, 20)), lastSeenAt: minsAgo(rnd(5, 1440)),
    })
  }
  await insertMany(prisma.errorEvent, errors)

  // Alert rules (a few) + fired alert events.
  const alertRules: Prisma.AlertRuleCreateManyInput[] = [
    { id: id(), name: "CPU بالا", metric: "system.cpu.usage", comparator: "GT" as never, threshold: 90, severity: "CRITICAL" as never, forSeconds: 120 },
    { id: id(), name: "نرخ خطا بالا", metric: "app.error_rate", comparator: "GT" as never, threshold: 5, severity: "CRITICAL" as never, forSeconds: 60 },
    { id: id(), name: "تأخیر API", metric: "app.latency.p95", comparator: "GT" as never, threshold: 2000, severity: "WARNING" as never },
    { id: id(), name: "صف ایمیل", metric: "email.queue.size", comparator: "GT" as never, threshold: 500, severity: "WARNING" as never },
    { id: id(), name: "نرخ Hit کش پایین", metric: "cache.hit_ratio", comparator: "LT" as never, threshold: 50, severity: "WARNING" as never },
  ]
  await insertMany(prisma.alertRule, alertRules)
  const alertEvents: Prisma.AlertEventCreateManyInput[] = []
  for (let i = 0; i < 22; i++) {
    const rule = pick(alertRules); const firing = chance(0.4)
    alertEvents.push({
      id: id(), ruleId: rule.id ?? null, title: rule.name as string, severity: rule.severity as never,
      status: (firing ? "FIRING" : "RESOLVED") as never, metric: rule.metric, value: Math.round(rnd(50, 200) * 10) / 10,
      message: `آستانه «${rule.name}» نقض شد`, acked: chance(0.5), startedAt: minsAgo(rnd(10, 3000)), resolvedAt: firing ? null : minsAgo(rnd(1, 500)),
    })
  }
  await insertMany(prisma.alertEvent, alertEvents)
  console.log(`[demo-seed] metrics: ${samples.length}, serviceHealth: ${serviceHealth.length}, errors: ${errors.length}, alertRules: ${alertRules.length}, alertEvents: ${alertEvents.length}`)

  // ----- 15. Email queue + events ------------------------------------------
  const EMAIL_TEMPLATES = ["WELCOME", "PURCHASE_CONFIRMATION", "WALLET_DEPOSIT_APPROVED", "GIVEAWAY_WINNER", "AUCTION_WINNER", "PASSWORD_RESET", "REFUND_COMPLETED", "VIP_ACTIVATED", "SUPPORT_REPLY"] as const
  const EMAIL_STATUS = ["DELIVERED", "DELIVERED", "DELIVERED", "SENT", "QUEUED", "FAILED", "BOUNCED"] as const
  const EMAIL_SENDERS = ["NOREPLY", "SUPPORT", "BILLING", "SECURITY"] as const
  const emailJobs: Prisma.EmailJobCreateManyInput[] = []
  const emailEvents: Prisma.EmailEventCreateManyInput[] = []
  for (let i = 0; i < EMAIL_COUNT; i++) {
    const u = pick(realUsers); const tpl = pick(EMAIL_TEMPLATES); const status = pick(EMAIL_STATUS); const jid = id()
    const queuedAt = daysAgo(rnd(0, 20))
    const providerId = status !== "QUEUED" ? `re_${randomBytes(8).toString("hex")}` : null
    const opened = status === "DELIVERED" && chance(0.5)
    emailJobs.push({
      id: jid, idempotencyKey: `demo-${i}-${randomBytes(4).toString("hex")}`, template: tpl as never,
      sender: pick(EMAIL_SENDERS) as never, to: `user${u.index}@demo.subio`, locale: "fa",
      subject: emailSubject(tpl), payload: { name: u.displayName }, status: status as never, priority: rnd(1, 9),
      attempts: status === "FAILED" ? 5 : 1, providerId,
      userId: u.id, openCount: opened ? rnd(1, 4) : 0, clickCount: opened && chance(0.4) ? rnd(1, 3) : 0,
      queuedAt, sentAt: status !== "QUEUED" ? queuedAt : null,
      deliveredAt: status === "DELIVERED" ? queuedAt : null, failedAt: status === "FAILED" ? queuedAt : null,
      openedAt: opened ? queuedAt : null, lastError: status === "FAILED" ? "550 mailbox unavailable" : null,
    })
    if (providerId) {
      emailEvents.push({ id: id(), jobId: jid, providerId, type: status === "BOUNCED" ? "email.bounced" : status === "FAILED" ? "email.failed" : "email.delivered", occurredAt: queuedAt })
      if (opened) emailEvents.push({ id: id(), jobId: jid, providerId, type: "email.opened", occurredAt: new Date(queuedAt.getTime() + 3_600_000) })
    }
  }
  await insertMany(prisma.emailJob, emailJobs)
  await insertMany(prisma.emailEvent, emailEvents)
  console.log(`[demo-seed] emailJobs: ${emailJobs.length}, emailEvents: ${emailEvents.length}`)

  console.log("\n[demo-seed] DONE — production-scale demo environment ready.")
  console.log("[demo-seed] Admin login: admin@demo.subio / DemoAdmin!2026")
}

// ---------------------------------------------------------------------------
// Small content helpers
// ---------------------------------------------------------------------------
function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

function notifTitle(type: string): string {
  const map: Record<string, string> = {
    GENERAL: "اعلان جدید", ORDER_DELIVERED: "سفارش شما تحویل شد", AUCTION_WON: "شما برنده مزایده شدید!",
    AUCTION_OUTBID: "پیشنهاد شما رد شد", DEPOSIT_APPROVED: "واریز شما تأیید شد", CASHBACK: "کش‌بک دریافت کردید",
    REFERRAL_BONUS: "پاداش دعوت دوستان", GIVEAWAY_WON: "برنده قرعه‌کشی شدید!", PRICE_DROP: "کاهش قیمت محصول",
    VIP_UPGRADED: "ارتقاء سطح عضویت", POINTS_EARNED: "امتیاز جدید کسب کردید", BADGE_AWARDED: "نشان جدید دریافت کردید",
  }
  return map[type] ?? "اعلان"
}

function emailSubject(tpl: string): string {
  const map: Record<string, string> = {
    WELCOME: "به Bot Subio خوش آمدید", PURCHASE_CONFIRMATION: "تأیید خرید شما", WALLET_DEPOSIT_APPROVED: "واریز شما تأیید شد",
    GIVEAWAY_WINNER: "تبریک! برنده قرعه‌کشی شدید", AUCTION_WINNER: "شما برنده مزایده شدید", PASSWORD_RESET: "بازنشانی رمز عبور",
    REFUND_COMPLETED: "استرداد وجه انجام شد", VIP_ACTIVATED: "عضویت ویژه فعال شد", SUPPORT_REPLY: "پاسخ پشتیبانی",
  }
  return map[tpl] ?? "اعلان"
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
