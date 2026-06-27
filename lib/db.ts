import { PrismaClient } from "@prisma/client"

// Reuse a single PrismaClient across hot reloads in development and across
// serverless invocations to avoid exhausting the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Bound interactive transactions so a slow/degraded Postgres can never make
    // a request hang indefinitely: wait at most 5s to acquire a connection and
    // allow at most 15s of work inside the transaction before rolling back.
    // (Serializable settlement paths — bids, draws — finish in well under this.)
    transactionOptions: {
      maxWait: 5_000,
      timeout: 15_000,
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
