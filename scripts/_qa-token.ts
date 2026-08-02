import crypto from "node:crypto"
import { prisma } from "../lib/db"

async function main() {
  const email = process.env.QA_USER_EMAIL
  const u = await prisma.user.findFirst({ where: { email }, select: { id: true, tokenVersion: true } })
  if (!u) {
    console.log("NO_USER")
    process.exit(1)
  }
  const secret = (process.env.AUTH_SECRET || process.env.SESSION_SECRET)!
  const payload = { uid: u.id, ver: u.tokenVersion ?? 0, exp: Math.floor(Date.now() / 1000) + 3600 }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
  console.log("QATOKEN:" + body + "." + sig)
  process.exit(0)
}
main()
