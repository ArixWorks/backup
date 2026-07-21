import { PrismaClient, UserRole } from "@prisma/client"
import { createHash, randomBytes } from "node:crypto"
import argon2 from "argon2"

const prisma = new PrismaClient()

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

type AccountConfig = {
  email: string
  password: string
  role: UserRole
  displayName: string
  aliasPrefix: string
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function stableSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10)
}

async function provision(config: AccountConfig) {
  if (config.password.length < 32) throw new Error(`${config.role} QA password must be at least 32 characters`)

  const email = config.email.toLowerCase()
  const passwordHash = await argon2.hash(config.password, ARGON2_OPTIONS)
  const existing = await prisma.user.findUnique({ where: { email } })
  const alias = `${config.aliasPrefix}#${stableSuffix(email)}`
  const username = `qa_${config.role.toLowerCase()}_${stableSuffix(email)}`

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: config.role,
          status: "ACTIVE",
          emailVerified: true,
          mustChangePassword: false,
          isTestAccount: true,
          displayName: config.displayName,
          alias,
          username,
          telegramId: null,
          telegramChatId: null,
          referredById: null,
          referralCode: null,
          referralRewarded: false,
          referralJoinRewarded: false,
          loyaltyPoints: 0,
          lifetimePoints: 0,
          totalSpent: 0n,
          vipManual: false,
          isPremium: false,
          tokenVersion: { increment: 1 },
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: config.role,
          status: "ACTIVE",
          emailVerified: true,
          mustChangePassword: false,
          isTestAccount: true,
          displayName: config.displayName,
          alias,
          username,
          lastLoginMethod: "password",
          languageCode: "fa",
          localeManual: true,
        },
      })

  await prisma.wallet.upsert({
    where: { userId_currency: { userId: user.id, currency: "IRT" } },
    create: { userId: user.id, currency: "IRT", totalBalance: 0n, frozenBalance: 0n },
    update: { totalBalance: 0n, frozenBalance: 0n, version: { increment: 1 } },
  })

  console.log(`[qa-provision] ${config.role.toLowerCase()} account ready (id=${user.id})`)
}

async function main() {
  await provision({
    email: required("QA_USER_EMAIL"),
    password: required("QA_USER_PASSWORD"),
    role: "USER",
    displayName: "QA User",
    aliasPrefix: "QAUser",
  })
  await provision({
    email: required("QA_ADMIN_EMAIL"),
    password: required("QA_ADMIN_PASSWORD"),
    role: "ADMIN",
    displayName: "QA Admin",
    aliasPrefix: "QAAdmin",
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("[qa-provision] failed:", error instanceof Error ? error.message : "unknown error")
    await prisma.$disconnect()
    process.exit(1)
  })
