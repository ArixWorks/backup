import path from "node:path"
// Prisma config files do not auto-load .env, so we load it explicitly to keep
// `env("DATABASE_URL")` in schema.prisma working for the CLI (generate/migrate/seed).
import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
