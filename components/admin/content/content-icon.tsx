"use client"

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

/** Maps registry icon-name strings to Lucide components (client-safe). */
const ICONS: Record<string, LucideIcon> = {
  FileText,
  Newspaper,
  HelpCircle,
  GraduationCap,
  LifeBuoy,
  Scale,
  Server,
  Globe,
}

export function ContentIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || FileText
  return <Icon className={className} />
}
