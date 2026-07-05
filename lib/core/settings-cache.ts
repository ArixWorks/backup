import "server-only"
import { cache } from "react"
import { unstable_cache } from "next/cache"
import {
  SETTINGS_CACHE_TAG,
  SETTING_KEYS,
  DEFAULT_THEME,
  isThemeId,
  getSetting,
  type ThemeId,
} from "@/lib/core/settings"

/**
 * Cross-request cached active-theme reader for the render hot path (root
 * layout). The theme changes only when an admin picks a new one, so we cache it
 * under the shared settings tag; `invalidateSettingsCache()` busts it on write.
 * `cache()` additionally dedupes the two reads the root layout performs
 * (`generateViewport` + the layout body) into a single lookup per request.
 *
 * This lives in a dedicated `server-only` module so `settings.ts` stays free of
 * top-level `next/cache` imports and remains importable by client components
 * that only need the theme constants.
 */
const readActiveThemeCached = unstable_cache(
  async (): Promise<ThemeId> => {
    const value = await getSetting(SETTING_KEYS.themeActive)
    return isThemeId(value) ? value : DEFAULT_THEME
  },
  ["active-theme"],
  { tags: [SETTINGS_CACHE_TAG], revalidate: 3600 },
)

export const getActiveThemeCached = cache(readActiveThemeCached)
