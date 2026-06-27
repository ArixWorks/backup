import "server-only"
import os from "node:os"
import { readFile } from "node:fs/promises"

/**
 * Real OS-level metrics.
 *
 * - The Node `os` builtin (CPU load/usage, memory, uptime) is ALWAYS available
 *   and is the baseline that works everywhere, including this preview.
 * - `systeminformation` (disk, disk I/O, network bandwidth/latency) is loaded
 *   lazily and only used when present/permitted (e.g. a Linux VPS). When it is
 *   unavailable, those fields return `null` — never a fake number, never a throw.
 * - File-descriptor count is read from `/proc/sys/fs/file-nr` (real on Linux).
 */

export interface SystemSnapshot {
  cpu: { usagePct: number | null; load1: number; load5: number; cores: number }
  mem: { usagePct: number; usedBytes: number; totalBytes: number }
  disk: { usagePct: number | null; readBps: number | null; writeBps: number | null }
  net: { rxBps: number | null; txBps: number | null; latencyMs: number | null }
  fdOpen: number | null
  procCount: number | null
  uptimeSec: number
  /** Which optional sources were actually available this run. */
  sources: { si: boolean; procfs: boolean }
}

/**
 * Real CPU usage % computed from two `os.cpus()` snapshots ~120ms apart.
 * This is genuine utilization (busy vs idle delta), available on every platform.
 */
async function cpuUsagePct(): Promise<number | null> {
  try {
    const sample = () => {
      const cpus = os.cpus()
      let idle = 0
      let total = 0
      for (const c of cpus) {
        idle += c.times.idle
        total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
      }
      return { idle, total }
    }
    const a = sample()
    await new Promise((r) => setTimeout(r, 120))
    const b = sample()
    const idleDelta = b.idle - a.idle
    const totalDelta = b.total - a.total
    if (totalDelta <= 0) return null
    const usage = (1 - idleDelta / totalDelta) * 100
    return Math.max(0, Math.min(100, usage))
  } catch {
    return null
  }
}

async function readFdOpen(): Promise<number | null> {
  try {
    // Linux: first field of /proc/sys/fs/file-nr = allocated file handles.
    const raw = await readFile("/proc/sys/fs/file-nr", "utf8")
    const first = Number(raw.trim().split(/\s+/)[0])
    return Number.isFinite(first) ? first : null
  } catch {
    return null
  }
}

type Si = typeof import("systeminformation")

let siModule: Si | null | undefined
async function loadSi(): Promise<Si | null> {
  if (siModule !== undefined) return siModule
  try {
    siModule = (await import("systeminformation")) as Si
  } catch {
    siModule = null
  }
  return siModule
}

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const cores = os.cpus()?.length || 1
  const [load1, load5] = os.loadavg() // 0,0,0 on Windows; real on Linux/macOS
  const totalBytes = os.totalmem()
  const freeBytes = os.freemem()
  const usedBytes = totalBytes - freeBytes
  const usagePct = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  const snap: SystemSnapshot = {
    cpu: { usagePct: await cpuUsagePct(), load1, load5, cores },
    mem: { usagePct, usedBytes, totalBytes },
    disk: { usagePct: null, readBps: null, writeBps: null },
    net: { rxBps: null, txBps: null, latencyMs: null },
    fdOpen: await readFdOpen(),
    procCount: null,
    uptimeSec: os.uptime(),
    sources: { si: false, procfs: false },
  }
  snap.sources.procfs = snap.fdOpen != null

  const si = await loadSi()
  if (si) {
    snap.sources.si = true
    // Disk usage (largest mounted fs), disk I/O bytes/sec, net bytes/sec,
    // internet latency, process count — each guarded independently.
    const [fsSize, fsStats, netStats, inet, procs] = await Promise.allSettled([
      si.fsSize(),
      si.fsStats(),
      si.networkStats(),
      si.inetLatency(),
      si.processes(),
    ])

    if (fsSize.status === "fulfilled" && Array.isArray(fsSize.value) && fsSize.value.length) {
      // Use the mount with the most used bytes as the representative disk.
      const main = fsSize.value.reduce((a, b) => (b.used > (a?.used ?? -1) ? b : a))
      if (main && Number.isFinite(main.use)) snap.disk.usagePct = main.use
    }
    if (fsStats.status === "fulfilled" && fsStats.value) {
      const rx = (fsStats.value as { rx_sec?: number }).rx_sec
      const wx = (fsStats.value as { wx_sec?: number }).wx_sec
      snap.disk.readBps = typeof rx === "number" && rx >= 0 ? rx : null
      snap.disk.writeBps = typeof wx === "number" && wx >= 0 ? wx : null
    }
    if (netStats.status === "fulfilled" && Array.isArray(netStats.value) && netStats.value.length) {
      let rx = 0
      let tx = 0
      let ok = false
      for (const n of netStats.value) {
        if (typeof n.rx_sec === "number" && n.rx_sec >= 0) { rx += n.rx_sec; ok = true }
        if (typeof n.tx_sec === "number" && n.tx_sec >= 0) { tx += n.tx_sec; ok = true }
      }
      if (ok) { snap.net.rxBps = rx; snap.net.txBps = tx }
    }
    if (inet.status === "fulfilled" && typeof inet.value === "number" && inet.value >= 0) {
      snap.net.latencyMs = inet.value
    }
    if (procs.status === "fulfilled" && procs.value && typeof procs.value.all === "number") {
      snap.procCount = procs.value.all
    }
  }

  return snap
}
