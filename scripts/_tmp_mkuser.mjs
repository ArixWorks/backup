import { prisma } from '../lib/db'
import { hashPassword } from '../lib/auth/password'
const email = 'onboard-test@example.com'
const hash = await hashPassword('test12345')
const u = await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash: hash, displayName: 'Onboard Test', alias: 'onboard_tester_' + Math.random().toString(36).slice(2,7), onboardedAt: null },
  update: { passwordHash: hash, onboardedAt: null },
})
console.log('OK user', u.id, 'onboardedAt=', u.onboardedAt)
process.exit(0)
