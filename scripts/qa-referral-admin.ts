/**
 * Visual-QA helper for the Referral L2 admin panel on production.
 *
 *   pnpm exec tsx ... scripts/qa-referral-admin.ts mint   # find admin + print 20-min session token
 *   pnpm exec tsx ... scripts/qa-referral-admin.ts seed   # seed ONE PENDING_REVIEW reward (qa-l2 tagged)
 *   pnpm exec tsx ... scripts/qa-referral-admin.ts clean   # remove qa-l2 fixtures
 *
 * The seeded reward + users are tagged `qa-l2-admin-` so `clean` removes them.
 */
import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const TAG = "qa-l2-admin"

function b64url(s: string) {
  return Buffer.from(s).toString("base64url")
}
function signSession(uid: string, ver = 0, ttl = 20 * 60): string {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET
  if (!secret) throw new Error("AUTH_SECRET not set")
  const payload = { uid, ver, exp: Math.floor(Date.now() / 1000) + ttl }
  const body = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

async function mint() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, tokenVersion: true, displayName: true } })
  if (!admin) {
    console.log("NO_ADMIN")
    return
  }
  console.log("ADMIN_ID", admin.id)
  console.log("ADMIN_NAME", admin.displayName)
  console.log("TOKEN", signSession(admin.id, admin.tokenVersion ?? 0))
}

async function seed() {
  const now = Date.now()
  const mk = async (label: string) =>
    (
      await prisma.user.create({
        data: {
          displayName: `QA L2 Admin ${label}`,
          alias: `${TAG}-${now}-${label}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date(now - 3 * 60 * 60 * 1000),
        },
        select: { id: true },
      })
    ).id
  const A = await mk("root")
  const B = await mk("mid")
  const C = await mk("trigger")
  const reward = await prisma.referralReward.create({
    data: {
      triggerKey: `L2:${A}:${C}`,
      beneficiaryId: A,
      middleUserId: B,
      triggerUserId: C,
      amount: 20000n,
      currency: "IRT",
      status: "PENDING_REVIEW",
      riskScore: 60,
      riskReason: "same_ip_burst(4)",
    },
    select: { id: true },
  })
  console.log("SEEDED_REWARD", reward.id, "beneficiary", A)
}

async function clean() {
  const users = await prisma.user.findMany({ where: { alias: { startsWith: `${TAG}-` } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length) {
    await prisma.referralReward.deleteMany({
      where: { OR: [{ beneficiaryId: { in: ids } }, { triggerUserId: { in: ids } }, { middleUserId: { in: ids } }] },
    })
    await prisma.referralRiskSignal.deleteMany({ where: { subjectUserId: { in: ids } } })
    await prisma.referralRelation.deleteMany({
      where: { OR: [{ invitedUserId: { in: ids } }, { parentInviterId: { in: ids } }, { rootInviterId: { in: ids } }] },
    })
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
  console.log("CLEANED", ids.length)
}

async function main() {
  const cmd = process.argv[2]
  try {
    if (cmd === "mint") await mint()
    else if (cmd === "seed") await seed()
    else if (cmd === "clean") await clean()
    else console.log("usage: mint | seed | clean")
  } finally {
    await prisma.$disconnect()
  }
}
void main()
