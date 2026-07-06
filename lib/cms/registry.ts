import { NotFoundError } from "@/lib/core/errors"
import { BUILT_IN_CONTENT_TYPES } from "./content-types"
import type { ContentTypeDef, RelationTargetType } from "./types"

/**
 * Central content-type registry. Built-in types are registered on module load;
 * additional types can be registered at startup via `registerContentType`
 * without touching the core, database, or routing layer.
 */

const registry = new Map<string, ContentTypeDef>()

export function registerContentType(def: ContentTypeDef): void {
  if (registry.has(def.key)) {
    throw new Error(`Content type "${def.key}" is already registered`)
  }
  registry.set(def.key, def)
}

for (const def of BUILT_IN_CONTENT_TYPES) registerContentType(def)

export function listContentTypes(): ContentTypeDef[] {
  return [...registry.values()]
}

export function getContentType(key: string): ContentTypeDef | undefined {
  return registry.get(key)
}

/** Throwing variant for route handlers / services. */
export function requireContentType(key: string): ContentTypeDef {
  const def = registry.get(key)
  if (!def) throw new NotFoundError(`نوع محتوای «${key}» یافت نشد`)
  return def
}

export function getContentTypeByBasePath(basePath: string): ContentTypeDef | undefined {
  return [...registry.values()].find((d) => d.routing.basePath === basePath)
}

/** Resolve a relation target type to its concrete kind + optional content key. */
export function parseRelationTarget(target: RelationTargetType): {
  kind: "content" | "product" | "auction" | "giveaway"
  contentTypeKey?: string
} {
  if (target.startsWith("content:")) {
    return { kind: "content", contentTypeKey: target.slice("content:".length) }
  }
  return { kind: target as "product" | "auction" | "giveaway" }
}
