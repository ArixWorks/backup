import "server-only"
import { prisma } from "@/lib/db"

/**
 * Default achievement badges. Codes are stable identifiers referenced by the
 * engine (awardBadge). Re-running upserts keeps names/points in sync.
 */
export const DEFAULT_BADGES = [
  { code: "FIRST_PURCHASE", name: "اولین خرید", description: "اولین خرید موفق خود را انجام دادید.", icon: "ShoppingBag", points: 50, displayOrder: 1 },
  { code: "FIRST_REFERRAL", name: "اولین دعوت", description: "اولین دوست خود را با موفقیت دعوت کردید.", icon: "UserPlus", points: 50, displayOrder: 2 },
  { code: "GIVEAWAY_WINNER", name: "برنده قرعه‌کشی", description: "در یک قرعه‌کشی برنده شدید.", icon: "Gift", points: 100, displayOrder: 3 },
  { code: "PRO_BUYER", name: "خریدار حرفه‌ای", description: "به جمع خریداران حرفه‌ای پیوستید.", icon: "Crown", points: 150, displayOrder: 4 },
  { code: "VIP_MEMBER", name: "عضو وی‌آی‌پی", description: "به بالاترین سطح عضویت رسیدید.", icon: "Gem", points: 200, displayOrder: 5 },
  { code: "ACTIVE_PARTICIPANT", name: "مشارکت‌کننده فعال", description: "به‌طور مستمر در پلتفرم فعال بودید.", icon: "Flame", points: 80, displayOrder: 6 },
  { code: "PROFILE_COMPLETE", name: "پروفایل کامل", description: "اطلاعات پروفایل خود را تکمیل کردید.", icon: "BadgeCheck", points: 30, displayOrder: 7 },
] as const

/** Default daily/weekly missions keyed by a stable `key`. */
export const DEFAULT_MISSIONS = [
  { key: "daily_login", kind: "DAILY", type: "DAILY_LOGIN", title: "ورود روزانه", description: "امروز وارد شوید.", target: 1, rewardPoints: 10, icon: "LogIn", href: null, displayOrder: 1 },
  { key: "daily_flash", kind: "DAILY", type: "VIEW_FLASH_SALE", title: "مشاهده فروش ویژه", description: "یک فروش ویژه را مشاهده کنید.", target: 1, rewardPoints: 5, icon: "Zap", href: "/flash", displayOrder: 2 },
  { key: "daily_bid", kind: "DAILY", type: "PLACE_BID", title: "شرکت در مزایده", description: "روی یک مزایده پیشنهاد ثبت کنید.", target: 1, rewardPoints: 15, icon: "Gavel", href: "/auctions", displayOrder: 3 },
  { key: "weekly_invite", kind: "WEEKLY", type: "INVITE_FRIEND", title: "دعوت دوستان", description: "این هفته یک دوست دعوت کنید.", target: 1, rewardPoints: 50, icon: "UserPlus", href: "/invite", displayOrder: 4 },
  { key: "weekly_giveaway", kind: "WEEKLY", type: "ENTER_GIVEAWAY", title: "شرکت در قرعه‌کشی", description: "این هفته در یک قرعه‌کشی شرکت کنید.", target: 1, rewardPoints: 20, icon: "Gift", href: "/giveaways", displayOrder: 5 },
  { key: "weekly_purchase", kind: "WEEKLY", type: "MAKE_PURCHASE", title: "خرید هفتگی", description: "این هفته یک خرید انجام دهید.", target: 1, rewardPoints: 40, icon: "ShoppingBag", href: "/shop", displayOrder: 6 },
  { key: "onboard_profile", kind: "WEEKLY", type: "COMPLETE_PROFILE", title: "تکمیل پروفایل", description: "اطلاعات پروفایل خود را کامل کنید.", target: 1, rewardPoints: 30, icon: "UserCog", href: "/profile", displayOrder: 7 },
] as const

/** Idempotently upsert the default badges and missions. Safe to re-run. */
export async function seedGamification(): Promise<{ badges: number; missions: number }> {
  for (const b of DEFAULT_BADGES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      create: b,
      update: { name: b.name, description: b.description, icon: b.icon, points: b.points, displayOrder: b.displayOrder },
    })
  }
  for (const m of DEFAULT_MISSIONS) {
    await prisma.mission.upsert({
      where: { key: m.key },
      create: m as Parameters<typeof prisma.mission.create>[0]["data"],
      update: {
        kind: m.kind,
        type: m.type,
        title: m.title,
        description: m.description,
        target: m.target,
        rewardPoints: m.rewardPoints,
        icon: m.icon,
        href: m.href,
        displayOrder: m.displayOrder,
      },
    })
  }
  return { badges: DEFAULT_BADGES.length, missions: DEFAULT_MISSIONS.length }
}
