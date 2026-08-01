import { z } from "zod"

/**
 * Global Zod configuration for the whole product.
 *
 * 1) Persian error messages. The app is Persian-first, and admins need to
 *    understand validation failures (previously raw English messages like
 *    "Invalid cuid" leaked straight into admin toasts). Setting the global
 *    locale makes every default Zod message Persian on both server and client.
 *    Import this module for its side effect early on each runtime:
 *    - server: `lib/api/handler.ts` (every API route goes through `route()`)
 *    - client: `components/providers.tsx`
 */
z.config(z.locales.fa())

/**
 * Validator for references to an existing database row id.
 *
 * Do NOT use `z.string().cuid()` for these. Although the Prisma schema declares
 * `@default(cuid())`, several rows were seeded with 32-char hex ids (e.g.
 * ProductCategory ids like `f7d96cccfd703430710fd632858ba3b5`). Those are valid
 * ids that `.cuid()` rejects because a cuid must start with `c`, which is
 * exactly why "adding a product with a category" failed with "Invalid cuid".
 *
 * These ids are always server-side references that get re-validated against the
 * database (foreign keys / explicit `assertCategory`), so a format check adds no
 * security — it only breaks on legitimate ids. We just require a non-empty,
 * reasonably-shaped token.
 */
export const dbId = z
  .string()
  .trim()
  .min(1, "شناسه نامعتبر است.")
  .max(64, "شناسه نامعتبر است.")
  .regex(/^[A-Za-z0-9_-]+$/, "شناسه نامعتبر است.")

export { z }
