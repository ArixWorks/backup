import assert from "node:assert/strict"
import { test } from "node:test"
import { rankAvailable } from "./rank"

const entry = (domain: string) => ({
  domain,
  reason: "",
  asciiDomain: domain,
  status: "AVAILABLE",
  priceIrt: null,
  listPriceIrt: null,
  checkedAt: new Date(0),
})

test("surfaces distinct labels before extra extensions of the same label", () => {
  // Insertion order groups a label's extensions together, which is what used to
  // burn three carousel slots on one idea.
  const ranked = rankAvailable([
    entry("coffira.com"),
    entry("coffira.net"),
    entry("coffira.org"),
    entry("brewza.net"),
    entry("cafeno.net"),
  ])
  assert.deepEqual(
    ranked.slice(0, 3).map((item) => item.domain),
    ["coffira.com", "brewza.net", "cafeno.net"],
  )
})

test("prefers .com within a label and within each pass", () => {
  const ranked = rankAvailable([entry("brewza.org"), entry("brewza.com"), entry("brewza.net")])
  assert.equal(ranked[0].domain, "brewza.com")
})

test("keeps every entry, only reorders", () => {
  const input = [
    entry("a.com"),
    entry("a.net"),
    entry("b.org"),
    entry("c.net"),
    entry("c.com"),
    entry("c.org"),
  ]
  const ranked = rankAvailable(input)
  assert.equal(ranked.length, input.length)
  assert.deepEqual(
    [...ranked.map((item) => item.domain)].sort(),
    [...input.map((item) => item.domain)].sort(),
  )
})

test("handles an empty list", () => {
  assert.deepEqual(rankAvailable([]), [])
})
