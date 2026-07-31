/**
 * Seed a login-able USER and ADMIN from the QA_* env credentials.
 *
 * Unlike scripts/provision-qa-accounts.ts this does NOT enforce the 32-char QA
 * hardening minimum, so the accounts can be signed into with the exact
 * QA_USER_PASSWORD / QA_ADMIN_PASSWORD values a human types in the preview.
 *
 * Argon2id params mirror lib/auth/password.ts.
 */
import { PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"
import argon2 from "argon2"

const prisma = new PrismaClient()

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function suffix(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10)
}

async function upsertUser({ email, password, role, displayName, aliasPrefix }) {
  const lower = email.toLowerCase()
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS)
  const existing = await prisma.user.findUnique({ where: { email: lower } })
  const base = {
    passwordHash,
    role,
    status: "ACTIVE",
    emailVerified: true,
    mustChangePassword: false,
    lastLoginMethod: "password",
    displayName,
  }
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { ...base, tokenVersion: { increment: 1 } },
      })
    : await prisma.user.create({
        data: {
          email: lower,
          ...base,
          alias: `${aliasPrefix}#${suffix(lower)}`,
          languageCode: "fa",
          onboardedAt: new Date(),
        },
      })

  await prisma.wallet.upsert({
    where: { userId_currency: { userId: user.id, currency: "IRT" } },
    create: { userId: user.id, currency: "IRT", totalBalance: 0n, frozenBalance: 0n },
    update: {},
  })
  console.log(`[seed-login] ${role} ready: ${lower} (id=${user.id})`)
}

async function main() {
  await upsertUser({
    email: required("QA_USER_EMAIL"),
    password: required("QA_USER_PASSWORD"),
    role: "USER",
    displayName: "Test User",
    aliasPrefix: "User",
  })
  await upsertUser({
    email: required("QA_ADMIN_EMAIL"),
    password: required("QA_ADMIN_PASSWORD"),
    role: "ADMIN",
    displayName: "Admin",
    aliasPrefix: "Admin",
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed-login] failed:", e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
