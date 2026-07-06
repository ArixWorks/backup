import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()
const email = "qa@subio.test"
const password = "QaPass123!"

const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
})

const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, emailVerified: true, onboardedAt: new Date(), status: "ACTIVE", mustChangePassword: false },
  create: {
    email,
    passwordHash,
    emailVerified: true,
    onboardedAt: new Date(),
    profileCompleted: true,
    displayName: "QA Tester",
    alias: "qa-tester",
    status: "ACTIVE",
  },
})
console.log("QA user ready:", user.email, user.id)
await prisma.$disconnect()
