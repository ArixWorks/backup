/**
 * Bootstrap the primary site admin (email + password).
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='secret' pnpm exec tsx scripts/create-admin.ts
 *
 * Idempotent: if the email already exists it is promoted to ADMIN and its
 * password is reset to the provided value. A base-currency wallet is ensured.
 *
 * Self-contained (own PrismaClient + argon2, no server-only aliases) so it can
 * run under tsx. Argon2id params mirror lib/auth/password.ts.
 */
import { PrismaClient } from "@prisma/client"
import { randomBytes } from "node:crypto"
import argon2 from "argon2"

const prisma = new PrismaClient()

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD || ""
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.")
    process.exit(1)
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS)
  const existing = await prisma.user.findUnique({ where: { email } })

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: true,
          mustChangePassword: false,
          lastLoginMethod: "password",
          // Bump tokenVersion to invalidate any old sessions.
          tokenVersion: { increment: 1 },
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: true,
          lastLoginMethod: "password",
          displayName: "Admin",
          alias: `Admin#${randomBytes(2).toString("hex")}`,
          wallets: { create: { currency: "IRT", totalBalance: 0n } },
        },
      })

  // Ensure a base-currency wallet exists (covers the promote-existing path).
  const wallet = await prisma.wallet.findFirst({ where: { userId: user.id, currency: "IRT" } })
  if (!wallet) {
    await prisma.wallet.create({ data: { userId: user.id, currency: "IRT", totalBalance: 0n } })
  }

  console.log(`[create-admin] ${existing ? "promoted" : "created"} admin: ${email} (id=${user.id})`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
