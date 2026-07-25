import assert from "node:assert/strict"
import test from "node:test"
import { getProductDiscount } from "./product-pricing"

test("detects a discount when serialized prices have different digit lengths", () => {
  assert.deepEqual(getProductDiscount("500000", "3190000"), {
    hasDiscount: true,
    percent: 84,
    price: 500000,
    compareAtPrice: 3190000,
  })
})

test("detects the existing Spotify-style serialized discount", () => {
  assert.equal(getProductDiscount("100000", "1100000").percent, 91)
})

test("does not report a discount for equal, lower, missing, or invalid compare-at prices", () => {
  assert.equal(getProductDiscount("500000", "500000").hasDiscount, false)
  assert.equal(getProductDiscount("500000", "400000").hasDiscount, false)
  assert.equal(getProductDiscount("500000", null).hasDiscount, false)
  assert.equal(getProductDiscount("500000", "invalid").hasDiscount, false)
})
