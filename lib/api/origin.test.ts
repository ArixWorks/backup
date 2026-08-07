import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAllowedRequestOrigin, isTrustedPreviewHost } from "./origin"

const SELF = ["myapp.example.com"]
const allowedInPreview = (host: string) => isAllowedRequestOrigin(host, SELF, false)
const allowedInProd = (host: string) => isAllowedRequestOrigin(host, SELF, true)

describe("isAllowedRequestOrigin — own host", () => {
  it("accepts an exact host match in every environment", () => {
    assert.equal(allowedInProd("myapp.example.com"), true)
    assert.equal(allowedInPreview("myapp.example.com"), true)
  })

  it("accepts a match against x-forwarded-host behind a proxy", () => {
    assert.equal(isAllowedRequestOrigin("public.example.com", ["10.0.0.5:3000", "public.example.com"], true), true)
  })

  it("ignores the port when comparing to our own host", () => {
    assert.equal(isAllowedRequestOrigin("myapp.example.com:443", SELF, true), true)
  })

  it("rejects an unrelated host", () => {
    assert.equal(allowedInProd("evil.example.com"), false)
    assert.equal(allowedInPreview("evil.example.com"), false)
  })
})

describe("isAllowedRequestOrigin — editor preview origins", () => {
  // The regression: the apex is what the v0 editor actually sends, and a
  // leading-dot suffix test rejected it, surfacing as a permission error.
  it("accepts the v0 apex origin outside production", () => {
    assert.equal(allowedInPreview("v0.app"), true)
  })

  it("accepts generated preview subdomains outside production", () => {
    for (const host of [
      "preview-abc.v0.app",
      "abc.vusercontent.net",
      "vusercontent.net",
      "v0.dev",
      "x.v0.dev",
      "my-app-git-branch.vercel.app",
    ]) {
      assert.equal(allowedInPreview(host), true, host)
    }
  })

  it("accepts loopback origins outside production", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000"]) {
      assert.equal(allowedInPreview(host), true, host)
    }
  })

  it("trusts NO preview origin in production", () => {
    for (const host of ["v0.app", "preview-abc.v0.app", "abc.vusercontent.net", "localhost:3000"]) {
      assert.equal(allowedInProd(host), false, host)
    }
  })
})

describe("isTrustedPreviewHost — lookalike domains stay untrusted", () => {
  it("does not treat a lookalike registration as a trusted host", () => {
    // A suffix test without a label boundary would wrongly accept these.
    for (const host of ["fakev0.app", "notv0.dev", "myvusercontent.net", "evilvercel.app"]) {
      assert.equal(isTrustedPreviewHost(host), false, host)
    }
  })

  it("does not let a trusted name appear as a left-hand label", () => {
    for (const host of ["v0.app.evil.com", "vusercontent.net.attacker.io"]) {
      assert.equal(isTrustedPreviewHost(host), false, host)
    }
  })

  it("is case-insensitive, since host comparisons are", () => {
    assert.equal(isTrustedPreviewHost("V0.App"), true)
  })

  it("rejects an empty or malformed host", () => {
    assert.equal(isAllowedRequestOrigin("", SELF, false), false)
    assert.equal(isAllowedRequestOrigin("   ", SELF, false), false)
  })
})
