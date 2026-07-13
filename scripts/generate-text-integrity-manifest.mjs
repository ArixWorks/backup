import { promises as fs } from "node:fs"
import path from "node:path"

const root = process.cwd()
const roots = ["app", "components", "lib"]
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json"])
const suspicious = /\uFFFD|(?:Ã.|Â.|Ø.|Ù.)|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u
const persian = /[\u0600-\u06FF]/u
const entries = []

async function walk(relative) {
  const absolute = path.join(root, relative)
  for (const item of await fs.readdir(absolute, { withFileTypes: true })) {
    const next = path.join(relative, item.name)
    if (item.isDirectory()) await walk(next)
    else if (extensions.has(path.extname(item.name)) && !next.endsWith("source-manifest.json")) {
      const lines = (await fs.readFile(path.join(root, next), "utf8")).split("\n")
      lines.forEach((text, index) => {
        if (persian.test(text) && suspicious.test(text)) entries.push({ path: next, line: index + 1, text: text.trim().slice(0, 2000) })
      })
    }
  }
}

for (const directory of roots) await walk(directory)
await fs.mkdir(path.join(root, "lib/ai/text-integrity"), { recursive: true })
await fs.writeFile(path.join(root, "lib/ai/text-integrity/source-manifest.json"), `${JSON.stringify(entries, null, 2)}\n`)
console.log(`Text integrity manifest: ${entries.length} suspicious source line(s).`)
