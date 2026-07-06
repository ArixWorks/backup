"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

/**
 * Web-desktop sidebar state.
 *
 *  - `collapsed`: icons-only rail vs full labelled sidebar. Persisted to
 *    localStorage so the user's choice survives reloads. The width itself is a
 *    CSS var (`--active-sidebar-w`) that both the sidebar and the content
 *    padding read, so collapsing animates with zero layout jump.
 *  - `mobileOpen`: the web-mobile nav Drawer (only used below `lg`).
 *
 * This state only affects the web dashboard; the Telegram mini-app never reads
 * it, so it can't disturb that experience.
 */
type SidebarState = {
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarState | null>(null)

const STORAGE_KEY = "shell.sidebar.collapsed"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore persisted collapse preference after mount (desktop-only; no CLS on
  // mobile since the sidebar isn't rendered there).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "1") setCollapsedState(true)
    } catch {
      /* ignore */
    }
  }, [])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider")
  return ctx
}
