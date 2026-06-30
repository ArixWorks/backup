"use client"

import { Check, Globe, ChevronDown } from "lucide-react"
import { CONTROL_SURFACE } from "@/components/header/control-button"
import { useI18n } from "@/components/i18n-provider"
import { LOCALES, LOCALE_NAMES, LOCALE_FLAGS } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Header language control — a glass pill matching the wallet/notification
 * controls. The active locale label + chevron reveal once there's horizontal
 * room (≥480px); on narrow phones it collapses to a tidy globe icon so the
 * control cluster never overflows the Telegram webview.
 */
export function HeaderLanguage() {
  const { locale, setLocale, t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("lang.choose")}
        className={cn(CONTROL_SURFACE, "w-9 gap-1.5 min-[480px]:w-auto min-[480px]:px-3")}
      >
        <Globe className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
        <span className="hidden text-sm font-semibold min-[480px]:inline">{LOCALE_NAMES[locale]}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 opacity-70 min-[480px]:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>{LOCALE_FLAGS[l]}</span>
              {LOCALE_NAMES[l]}
            </span>
            {locale === l && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
