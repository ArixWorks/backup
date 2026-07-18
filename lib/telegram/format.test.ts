import assert from "node:assert/strict"
import test from "node:test"
import { renderCustomEmojiCodes } from "./format"

const firstId = "5453957997418004470"
const secondId = "5900186420659622041"

test("renders one custom emoji code in Persian HTML", () => {
  assert.equal(
    renderCustomEmojiCodes(`<b>[${firstId}] محصول جدید</b>`),
    `<b><tg-emoji emoji-id="${firstId}">✨</tg-emoji> محصول جدید</b>`,
  )
})

test("renders multiple custom emoji codes", () => {
  assert.equal(
    renderCustomEmojiCodes(`[${firstId}] تست [${secondId}]`),
    `<tg-emoji emoji-id="${firstId}">✨</tg-emoji> تست <tg-emoji emoji-id="${secondId}">✨</tg-emoji>`,
  )
})

test("preserves existing Telegram emoji tags", () => {
  const existing = `<tg-emoji emoji-id="${firstId}">🔥</tg-emoji>`
  assert.equal(renderCustomEmojiCodes(existing), existing)
})

test("leaves malformed and out-of-range codes visible", () => {
  const value = "[1234] [not-an-id] [123456789012345678901234567890123]"
  assert.equal(renderCustomEmojiCodes(value), value)
})

test("formats media caption content with surrounding HTML", () => {
  assert.equal(
    renderCustomEmojiCodes(`<i>پیشنهاد ویژه [${secondId}]</i>`),
    `<i>پیشنهاد ویژه <tg-emoji emoji-id="${secondId}">✨</tg-emoji></i>`,
  )
})
