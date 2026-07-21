#!/usr/bin/env node

import { spawnSync } from "node:child_process"

const baseUrl = (process.env.AUDIT_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const email = process.env.QA_USER_EMAIL
const password = process.env.QA_USER_PASSWORD
const locales = (process.env.AUDIT_LOCALES || "en,hi,ru").split(",").map((value) => value.trim()).filter(Boolean)
const session = process.env.AUDIT_BROWSER_SESSION || `locale-audit-${process.pid}`
const routes = [
  "/", "/profile", "/account", "/wallet", "/orders", "/notifications", "/rewards", "/invite",
  "/refunds", "/reports", "/support", "/watchlist", "/flash", "/auctions", "/giveaways",
  "/giveaways/wins", "/domains", "/vps", "/articles", "/tutorials", "/help", "/faq", "/rules",
]

if (!email || !password) {
  console.error("QA_USER_EMAIL and QA_USER_PASSWORD are required.")
  process.exit(2)
}

function browser(args, { allowFailure = false } = {}) {
  const result = spawnSync("agent-browser", ["--session", session, ...args], { encoding: "utf8" })
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `agent-browser ${args.join(" ")} failed`)
  }
  return result.stdout.trim()
}

function open(path) {
  browser(["open", `${baseUrl}${path}`])
  browser(["wait", "500"])
}

const failures = []
const coverage = []

try {
  open("/login")
  browser(["snapshot"])
  browser(["fill", 'input[type="email"]', email])
  browser(["fill", 'input[type="password"]', password])
  browser(["press", "Enter"])
  browser(["wait", "1500"])

  open("/profile")
  const authenticatedUrl = browser(["get", "url"]).split("\n").at(-1) || ""
  const identityVisible = browser(["eval", `Boolean(document.body.innerText.includes(${JSON.stringify(email)}))`])
  if (authenticatedUrl.includes("/login") || !identityVisible.includes("true")) {
    throw new Error(`Authentication assertion failed at ${authenticatedUrl}`)
  }

  for (const locale of locales) {
    browser(["storage", "local", "set", "subio_locale", locale])
    for (const route of routes) {
      open(route)
      const url = browser(["get", "url"]).split("\n").at(-1) || ""
      if (url.includes("/login")) {
        failures.push({ locale, route, type: "auth-redirect", detail: url })
        continue
      }

      const raw = browser(["eval", `JSON.stringify(Array.from(new Set(document.body.innerText.split("\\n").map(s => s.trim()).filter(s => /[\\u0620-\\u064A\\u066E-\\u06D3\\u06FA-\\u06FF]/.test(s)))).slice(0, 50))`])
      let leaks = []
      try { leaks = JSON.parse(JSON.parse(raw.split("\n").at(-1))) } catch { leaks = [raw] }
      coverage.push({ locale, route, url, leaks: leaks.length })
      if (leaks.length) failures.push({ locale, route, type: "persian-copy", detail: leaks })
    }
  }
} catch (error) {
  failures.push({ locale: "auth", route: "/profile", type: "audit-error", detail: error.message })
} finally {
  browser(["close"], { allowFailure: true })
}

console.log(JSON.stringify({ baseUrl, session, coverage, failures }, null, 2))
if (failures.length) process.exit(1)
