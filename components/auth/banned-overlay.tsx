"use client"

import { motion } from "motion/react"
import { Ban, LogOut } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { useSession } from "@/hooks/use-session"

/**
 * Full-screen, blocking "you are banned" screen. Rendered on top of everything
 * (very high z-index, fixed inset-0) so a user who gets banned mid-session has
 * every section of the app instantly sealed off. The centerpiece is a real 3D
 * prohibition emblem: a stack of extruded layers (translateZ) spinning on the
 * Y axis inside a perspective scene, floating and pulsing — implemented with
 * CSS 3D transforms + motion (no heavy 3D dependency).
 */
export function BannedOverlay() {
  const { t, dir } = useI18n()
  const { logout } = useSession()

  // Extruded "thickness" layers for the emblem — the middle layer holds the
  // icon; the rest build depth in front of and behind it.
  const depthLayers = [-28, -21, -14, -7, 0, 7, 14, 21, 28]

  return (
    <motion.div
      dir={dir}
      role="alertdialog"
      aria-modal="true"
      aria-label={t("banned.title")}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 overflow-hidden bg-background/95 px-6 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Ambient red wash behind the emblem */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(220,38,38,0.28) 0%, transparent 70%)" }}
      />

      {/* 3D scene */}
      <div
        aria-hidden
        className="relative flex h-56 w-56 items-center justify-center"
        style={{ perspective: "900px" }}
      >
        {/* Pulsing halo rings */}
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-red-500/40"
            style={{ width: "100%", height: "100%" }}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: [0.8, 1.35], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: i * 1.2 }}
          />
        ))}

        {/* Floating + spinning extruded emblem */}
        <motion.div
          className="relative"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="relative h-40 w-40"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            {depthLayers.map((z) => {
              const isFace = z === 0
              return (
                <div
                  key={z}
                  className="absolute inset-0 flex items-center justify-center rounded-full"
                  style={{
                    transform: `translateZ(${z}px)`,
                    background: isFace
                      ? "linear-gradient(145deg, #ef4444, #b91c1c)"
                      : "linear-gradient(145deg, #dc2626, #7f1d1d)",
                    boxShadow: isFace
                      ? "0 0 40px rgba(239,68,68,0.55), inset 0 2px 10px rgba(255,255,255,0.25)"
                      : "inset 0 0 12px rgba(0,0,0,0.35)",
                  }}
                >
                  {isFace && <Ban className="h-24 w-24 text-white" strokeWidth={2.5} />}
                </div>
              )
            })}
          </motion.div>
        </motion.div>
      </div>

      {/* Message */}
      <motion.div
        className="relative z-10 max-w-md text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        <h1 className="text-balance text-2xl font-extrabold text-foreground sm:text-3xl">
          {t("banned.title")}
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          {t("banned.message")}
        </p>
      </motion.div>

      {/* Logout */}
      <motion.button
        type="button"
        onClick={() => logout()}
        className="relative z-10 inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <LogOut className="h-4 w-4" />
        {t("banned.logout")}
      </motion.button>
    </motion.div>
  )
}
