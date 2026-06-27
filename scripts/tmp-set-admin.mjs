import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const email = "ops-admin@example.com"
const password = "OpsCenter!2026"

const saltBuf = crypto.randomBytes(16)
const salt = saltBuf.toString("hex")
const hash = crypto.scryptSync(password, saltBuf, 64).toString("hex")
const passwordHash = `scrypt$${salt}$${hash}`

// Prefer the account that already holds the test email (idempotent re-runs),
// otherwise fall back to the first admin.
const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
const admin = existing ?? (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, role: true } }))
if (!admin) {
  console.log("[v0] no admin user found")
} else {
  await prisma.user.update({
    where: { id: admin.id },
    data: { email, passwordHash, emailVerified: true, role: "ADMIN" },
  })
  console.log("[v0] admin creds set on", admin.id, "->", email)
}
await prisma.$disconnect()
