import "server-only"
import { prisma } from "@/lib/db"
import { getProviderDef } from "./providers"
import { decryptSecret, encryptSecret, keyLast4 } from "./crypto"

/**
 * Encrypted provider API-key management. Raw keys are AES-256-GCM encrypted at
 * rest and NEVER returned to any client — the admin UI only ever sees a masked
 * "•••• 1234" hint and the connection status.
 *
 * Key resolution for a provider: DB credential (admin panel) → provider env var.
 * This is the only place decryption happens; callers get a plaintext key solely
 * inside server code paths (the gateway wrapper).
 */

export interface MaskedCredential {
  provider: string
  hasKey: boolean
  /** true when the effective key comes from the DB rather than env. */
  fromDb: boolean
  last4: string | null
  label: string | null
  status: string
  statusDetail: string | null
  lastTestedAt: Date | null
}

/** Resolve the effective plaintext key for a provider (DB first, then env). */
export async function resolveApiKey(provider: string): Promise<string | null> {
  const row = await prisma.aiCredential.findUnique({ where: { provider } })
  if (row?.ciphertext) {
    try {
      return decryptSecret(row.ciphertext)
    } catch {
      // Corrupt/rotated encryption key — fall through to env.
    }
  }
  const def = getProviderDef(provider)
  const envVal = def ? process.env[def.envKey] : undefined
  return envVal || null
}

/** Set (or replace) the encrypted key for a provider. */
export async function setApiKey(
  provider: string,
  rawKey: string,
  actorId?: string,
  label?: string,
): Promise<void> {
  const ciphertext = encryptSecret(rawKey)
  const last4 = keyLast4(rawKey)
  await prisma.aiCredential.upsert({
    where: { provider },
    create: { provider, ciphertext, last4, label, createdById: actorId, updatedById: actorId },
    update: {
      ciphertext,
      last4,
      label,
      updatedById: actorId,
      status: "unknown",
      statusDetail: null,
    },
  })
}

/** Remove a provider's stored key (falls back to env afterwards). */
export async function deleteApiKey(provider: string): Promise<void> {
  await prisma.aiCredential.deleteMany({ where: { provider } })
}

/** Record the outcome of a Test Connection against a provider. */
export async function setCredentialStatus(
  provider: string,
  status: "connected" | "error" | "invalid" | "unknown",
  detail?: string,
): Promise<void> {
  await prisma.aiCredential.updateMany({
    where: { provider },
    data: { status, statusDetail: detail ?? null, lastTestedAt: new Date() },
  })
}

/** Masked view of every provider's credential state for the admin panel. */
export async function listMaskedCredentials(): Promise<MaskedCredential[]> {
  const rows = await prisma.aiCredential.findMany()
  const byProvider = new Map(rows.map((r) => [r.provider, r]))
  const { AI_PROVIDERS } = await import("./providers")
  return AI_PROVIDERS.map((def) => {
    const row = byProvider.get(def.id)
    const envKey = process.env[def.envKey]
    return {
      provider: def.id,
      hasKey: !!(row?.ciphertext || envKey),
      fromDb: !!row?.ciphertext,
      last4: row?.last4 ?? (envKey ? envKey.slice(-4) : null),
      label: row?.label ?? null,
      status: row?.status ?? (envKey ? "unknown" : "unknown"),
      statusDetail: row?.statusDetail ?? null,
      lastTestedAt: row?.lastTestedAt ?? null,
    }
  })
}
