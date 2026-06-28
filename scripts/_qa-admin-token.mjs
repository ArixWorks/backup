import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const tg = "999000111"
const u = await prisma.user.upsert({
  where: { telegramId: tg },
  update: { role: "ADMIN", status: "ACTIVE" },
  create: {
    telegramId: tg,
    role: "ADMIN",
    status: "ACTIVE",
    firstName: "QA",
    displayName: "QA Admin",
    username: "qa_admin",
    languageCode: "fa",
  },
})
const secret =
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN
const payload = { uid: u.id, ver: u.tokenVersion ?? 0, exp: Math.floor(Date.now() / 1000) + 3600 }
const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
console.log("TOKEN=" + body + "." + sig)
await prisma.$disconnect()
