import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const u = await p.user.findFirst({ where: { email: process.env.QA_USER_EMAIL }, select: { id: true } })
console.log('qa user', u?.id)
const d = await p.domainOrder.findMany({ where: { userId: u.id }, select: { publicId: true, unicodeDomain: true, status: true }, orderBy: { createdAt: 'desc' }, take: 20 })
console.log('DOMAIN', JSON.stringify(d, null, 1))
await p.$disconnect()
