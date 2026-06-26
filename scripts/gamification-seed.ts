/**
 * Idempotent seed for gamification badges & missions. Run with:
 *   pnpm exec tsx scripts/gamification-seed.ts
 * Self-contained (no "@/..." aliases or server-only imports) so it runs under tsx.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { code: b.code }, create: b, update: b })
  }
  for (const m of MISSIONS) {
    await prisma.mission.upsert({ where: { key: m.key }, create: m as never, update: m as never })
  }
  console.log(`[seed] badges=${BADGES.length} missions=${MISSIONS.length}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
