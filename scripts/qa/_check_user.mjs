import { prisma } from "../../lib/db.ts"
const email = process.env.QA_USER_EMAIL
const u = await prisma.user.findFirst({ where: { email }, select: { id: true, role: true, status: true, passwordHash: true, emailVerified: true } })
console.log(u ? { found: true, id: u.id, role: u.role, status: u.status, hasHash: !!u.passwordHash, emailVerified: u.emailVerified } : { found: false })
await prisma.$disconnect()
