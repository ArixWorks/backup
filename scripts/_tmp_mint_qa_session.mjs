import { PrismaClient } from "@prisma/client"
import crypto from "node:crypto"

const prisma = new PrismaClient()

function secret() {
  const dedicated = process.env.AUTH_SECRET || process.env.SESSION_SECRET
  if (dedicated) return dedicated
  const fallback = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
  if (!fallback) throw new Error("no secret available")
  return fallback
}
const b64url = (s) => Buffer.from(s).toString("base64url")
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url")

const user = await prisma.user.findFirst({
  where: { isTestAccount: true, role: "USER", status: "ACTIVE" },
  select: { id: true, tokenVersion: true, email: true },
})
if (!user) {
  console.error("NO_QA_USER")
  process.exit(3)
}
const payload = { uid: user.id, ver: user.tokenVersion ?? 0, exp: Math.floor(Date.now() / 1000) + 3600 }
const body = b64url(JSON.stringify(payload))
console.log(`${body}.${sign(body)}`)
await prisma.$disconnect()
