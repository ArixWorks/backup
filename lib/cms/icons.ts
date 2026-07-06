import {
  FileText,
  Newspaper,
  HelpCircle,
  GraduationCap,
  LifeBuoy,
  Scale,
  Server,
  Globe,
  type LucideIcon,
} from "lucide-react"

/**
 * Registry icon-name → Lucide component. Server-safe (no "use client"), so it
 * can be used from server components that need the actual icon type (e.g.
 * PageHeader's `icon` prop).
 */
export const CMS_ICONS: Record<string, LucideIcon> = {
  FileText,
  Newspaper,
  HelpCircle,
  GraduationCap,
  LifeBuoy,
  Scale,
  Server,
  Globe,
}

export function resolveCmsIcon(name?: string): LucideIcon {
  return (name && CMS_ICONS[name]) || FileText
}
