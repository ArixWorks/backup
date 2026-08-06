import assert from "node:assert/strict"
import test from "node:test"
import { parseRailwayDomainMessage } from "./railway-parser"

const requested = new Set(["subio.com", "subio.io", "subio.dev"])

test("marks Railway Taken domains as registered", () => {
  const result = parseRailwayDomainMessage({
    type: "domains",
    query: "subio.com",
    domains: {
      "subio.com": { domain: "subio.com", zone: "com", purchasable: false, allowedYears: [1, 2] },
    },
  }, requested)

  assert.equal(result?.get("subio.com")?.status, "REGISTERED")
  assert.equal(result?.get("subio.com")?.providerCode, "TAKEN")
})

test("marks only explicitly priced purchasable domains as available", () => {
  const result = parseRailwayDomainMessage({
    type: "domains",
    domains: {
      "subio.io": { domain: "subio.io", zone: "io", purchasable: true, purchasePrice: 53 },
      "subio.dev": { domain: "subio.dev", zone: "dev", purchasable: true },
    },
  }, requested)

  assert.equal(result?.get("subio.io")?.status, "AVAILABLE")
  assert.equal(result?.has("subio.dev"), false)
})

test("marks premium aftermarket listings as PREMIUM, not available", () => {
  // Verbatim frame Railway returned for hostiva.com, which was sold to a customer
  // for the flat .com price while actually being a $30,925.80 resale listing.
  const result = parseRailwayDomainMessage({
    type: "domains",
    domains: {
      "hostiva.com": {
        domain: "hostiva.com",
        zone: "com",
        purchasable: true,
        purchasePrice: 30925.8,
        renewalPrice: 14.5,
        premium: true,
        allowedYears: [1, 2, 3],
      },
    },
  }, new Set(["hostiva.com"]))

  assert.equal(result?.get("hostiva.com")?.status, "PREMIUM")
  assert.equal(result?.get("hostiva.com")?.providerCode, "PREMIUM")
})

test("reports provider cost so callers can sanity-check the sale price", () => {
  const result = parseRailwayDomainMessage({
    type: "domains",
    domains: { "subio.io": { domain: "subio.io", zone: "io", purchasable: true, purchasePrice: 53 } },
  }, requested)

  assert.equal(result?.get("subio.io")?.status, "AVAILABLE")
  assert.equal(result?.get("subio.io")?.meta.providerPriceUsdCents, 5300)
})

test("ignores unrequested and conflicting domain records", () => {
  const result = parseRailwayDomainMessage({
    type: "domains",
    domains: {
      "attacker.com": { domain: "attacker.com", zone: "com", purchasable: true, purchasePrice: 1 },
      "subio.com": { domain: "different.com", zone: "com", purchasable: true, purchasePrice: 10 },
    },
  }, requested)

  assert.equal(result?.size, 0)
})

test("fails closed when Railway response shape changes", () => {
  assert.equal(parseRailwayDomainMessage({ type: "results", domains: [] }, requested), null)
  assert.equal(parseRailwayDomainMessage({ type: "domains", domains: [] }, requested), null)
  assert.equal(parseRailwayDomainMessage("invalid", requested), null)
})
