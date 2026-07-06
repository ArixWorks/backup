import type { ContentTypeDef } from "./types"

/**
 * Plain, JSON-serializable view of a content type for client components.
 * The registry def is already pure data, but this makes the client contract
 * explicit and stable.
 */
export interface SerializedTypeDef {
  key: string
  labelSingular: string
  labelPlural: string
  icon: string
  mode: "collection" | "singleton"
  basePath: string
  fields: ContentTypeDef["fields"]
  taxonomy: ContentTypeDef["taxonomy"]
  publishing: ContentTypeDef["publishing"]
  relations: ContentTypeDef["relations"]
  navigation: ContentTypeDef["navigation"]
}

export function serializeTypeDef(def: ContentTypeDef): SerializedTypeDef {
  return {
    key: def.key,
    labelSingular: def.labelSingular,
    labelPlural: def.labelPlural,
    icon: def.icon,
    mode: def.routing.mode,
    basePath: def.routing.basePath,
    fields: def.fields,
    taxonomy: def.taxonomy,
    publishing: def.publishing,
    relations: def.relations,
    navigation: def.navigation,
  }
}
