import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
let admin = await prisma.user
  .findFirst({ where: { role: "ADMIN" }, select: { id: true, role: true, tokenVersion: true } })
  .catch(() => null)
if (!admin) admin = await prisma.user.findFirst({ select: { id: true, role: true, tokenVersion: true } })
if (!admin) {
  console.log("NO_USER")
  process.exit(1)
}
const secret =
  process.env.AUTH_SECRET || process.env.SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const b64 = (s) => Buffer.from(s).toString("base64url")
const payload = { uid: admin.id, ver: admin.tokenVersion ?? 0, exp: Math.floor(Date.now() / 1000) + 3600 }
const body = b64(JSON.stringify(payload))
const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
console.log("ROLE=" + admin.role)
console.log("TOKEN=" + body + "." + sig)
process.exit(0)
