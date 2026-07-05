import "server-only"
import { prisma } from "@/lib/db"

/**
 * Prompt library + versioning. Prompts are addressed by a stable `key` and each
 * has an active version pointer with full history (rollback / A-B). Rendering
 * substitutes {{variable}} placeholders. Code can register defaults on boot and
 * admins can edit versions later without a deploy.
 */

export interface RenderedPrompt {
  system?: string
  user: string
  version: number
  config?: Record<string, unknown> | null
}

/** Replace {{var}} placeholders with provided values (missing → empty string). */
export function renderTemplate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name]
    return v === undefined || v === null ? "" : String(v)
  })
}

/**
 * Load a prompt by key and render its active version. Returns null if the key
 * is unknown (callers fall back to an inline default).
 */
export async function loadPrompt(
  key: string,
  vars: Record<string, string | number> = {},
): Promise<RenderedPrompt | null> {
  const tpl = await prisma.aiPromptTemplate.findUnique({ where: { key } })
  if (!tpl) return null
  const version = await prisma.aiPromptVersion.findUnique({
    where: { templateId_version: { templateId: tpl.id, version: tpl.activeVersion } },
  })
  if (!version) return null
  return {
    system: version.systemPrompt ? renderTemplate(version.systemPrompt, vars) : undefined,
    user: renderTemplate(version.userPrompt, vars),
    version: version.version,
    config: (version.config as Record<string, unknown> | null) ?? null,
  }
}

/**
 * Idempotently register a prompt's initial version. Used by features to seed
 * their default prompts on first run without overwriting admin edits.
 */
export async function ensurePrompt(input: {
  key: string
  name: string
  description?: string
  feature?: string
  systemPrompt?: string
  userPrompt: string
}): Promise<void> {
  const existing = await prisma.aiPromptTemplate.findUnique({ where: { key: input.key } })
  if (existing) return
  await prisma.aiPromptTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      feature: input.feature,
      activeVersion: 1,
      versions: {
        create: {
          version: 1,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
        },
      },
    },
  })
}

/** Append a new version and point the template at it (admin edit / rollback). */
export async function addPromptVersion(input: {
  key: string
  systemPrompt?: string
  userPrompt: string
  config?: Record<string, unknown>
  notes?: string
  createdById?: string
  activate?: boolean
}): Promise<number> {
  const tpl = await prisma.aiPromptTemplate.findUnique({
    where: { key: input.key },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  })
  if (!tpl) throw new Error(`Unknown prompt key: ${input.key}`)
  const nextVersion = (tpl.versions[0]?.version ?? 0) + 1
  await prisma.aiPromptVersion.create({
    data: {
      templateId: tpl.id,
      version: nextVersion,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      config: input.config as never,
      notes: input.notes,
      createdById: input.createdById,
    },
  })
  if (input.activate !== false) {
    await prisma.aiPromptTemplate.update({
      where: { id: tpl.id },
      data: { activeVersion: nextVersion },
    })
  }
  return nextVersion
}
