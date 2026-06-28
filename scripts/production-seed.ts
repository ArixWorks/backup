/**
 * PRODUCTION structural seed — the only seed you should run on a live database.
 *
 *   pnpm exec tsx scripts/production-seed.ts
 *   # or: pnpm db:seed:prod
 *
 * It is 100% idempotent (safe to run repeatedly) and creates ONLY structural
 * data the app needs to function — NO demo users, products, auctions, wallets
 * or balances:
 *   - Currencies (IRT base + USD/USDT) and initial exchange rates
 *   - Gamification badges & missions
 *
 * App settings (cashback %, tiers, theme, ...) already have safe code-level
 * defaults, so they don't need rows here; admins tune them from the dashboard.
 * Alert rules self-seed lazily on first metric collection.
 *
 * Self-contained on purpose (own PrismaClient, no "@/..." aliases or
 * "server-only" imports) so it runs cleanly under tsx in any environment.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const RATE_SCALE = 100_000_000n

const CURRENCIES = [
  { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0, isBase: true, displayOrder: 0 },
  { code: "USD", name: "دلار آمریکا", symbol: "$", decimals: 2, isBase: false, displayOrder: 1 },
  { code: "USDT", name: "تتر", symbol: "₮", decimals: 2, isBase: false, displayOrder: 2 },
]

// Starter rates (×1e8). Admins update these from the finance dashboard; the
// latest row per pair wins. Only inserted if the pair has no rate yet.
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

async function main() {
  // --- Currencies ---
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: c.code }, create: c, update: c })
  }
  // --- Initial rates (only if missing) ---
  let ratesAdded = 0
  for (const r of INITIAL_RATES) {
    const existing = await prisma.exchangeRate.findFirst({
      where: { baseCode: r.from, quoteCode: r.to },
      orderBy: { createdAt: "desc" },
    })
    if (!existing) {
      await prisma.exchangeRate.create({ data: { baseCode: r.from, quoteCode: r.to, rate: r.rate } })
      ratesAdded++
    }
  }
  // --- Badges & missions ---
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { code: b.code }, create: b, update: b })
  }
  for (const m of MISSIONS) {
    await prisma.mission.upsert({ where: { key: m.key }, create: m as never, update: m as never })
  }

  console.log(
    `[production-seed] currencies=${CURRENCIES.length} ratesAdded=${ratesAdded} badges=${BADGES.length} missions=${MISSIONS.length}`,
  )
  console.log("[production-seed] done — structural data ready. No demo data was created.")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
