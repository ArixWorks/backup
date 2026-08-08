import { test } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"
import { sanitizeUpload } from "./validate"

function toFile(bytes: Buffer | string, name: string, type: string): File {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf-8") : bytes
  return new File([new Uint8Array(buf)], name, { type })
}

async function realPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer()
}

test("accepts and re-encodes a genuine PNG", async () => {
  const png = await realPng()
  const res = await sanitizeUpload(toFile(png, "a.png", "image/png"), ["IMAGE", "PDF", "TEXT"])
  assert.equal(res.kind, "IMAGE")
  assert.equal(res.mimeType, "image/png")
  assert.equal(res.width, 8)
  assert.equal(res.height, 8)
})

test("strips an appended polyglot payload from an image", async () => {
  const png = await realPng()
  const payload = Buffer.from("<script>alert(1)</script>PK\x03\x04", "latin1")
  const polyglot = Buffer.concat([png, payload])
  const res = await sanitizeUpload(toFile(polyglot, "evil.png", "image/png"), ["IMAGE"])
  // Re-encoded output must not contain the appended script bytes.
  assert.ok(!res.buffer.toString("latin1").includes("<script>"))
  assert.ok(res.buffer.length > 0)
})

test("rejects a non-image file masquerading as an image", async () => {
  await assert.rejects(
    () => sanitizeUpload(toFile("this is not an image", "fake.png", "image/png"), ["IMAGE"]),
    /مجاز نیست|پشتیبانی نمی‌شود|تصویری معتبر نیست/,
  )
})

test("rejects an executable disguised with a .png extension", async () => {
  const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00])
  await assert.rejects(() => sanitizeUpload(toFile(elf, "malware.png", "image/png"), ["IMAGE", "PDF", "TEXT"]))
})

test("accepts valid UTF-8 text", async () => {
  const res = await sanitizeUpload(toFile("سلام\nhello", "note.txt", "text/plain"), ["IMAGE", "PDF", "TEXT"])
  assert.equal(res.kind, "TEXT")
  assert.equal(res.mimeType, "text/plain; charset=utf-8")
})

test("rejects binary content claiming to be text", async () => {
  const binary = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])
  await assert.rejects(() => sanitizeUpload(toFile(binary, "note.txt", "text/plain"), ["IMAGE", "PDF", "TEXT"]))
})

test("accepts a clean PDF", async () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF", "latin1")
  const res = await sanitizeUpload(toFile(pdf, "doc.pdf", "application/pdf"), ["IMAGE", "PDF", "TEXT"])
  assert.equal(res.kind, "PDF")
  assert.equal(res.mimeType, "application/pdf")
})

test("rejects a PDF containing JavaScript", async () => {
  const pdf = Buffer.from("%PDF-1.4\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF", "latin1")
  await assert.rejects(() => sanitizeUpload(toFile(pdf, "evil.pdf", "application/pdf"), ["IMAGE", "PDF", "TEXT"]), /محتوای فعال/)
})

test("rejects a kind that is not allowed on the surface", async () => {
  const pdf = Buffer.from("%PDF-1.4\n%%EOF", "latin1")
  await assert.rejects(() => sanitizeUpload(toFile(pdf, "doc.pdf", "application/pdf"), ["IMAGE"]), /مجاز نیست/)
})

test("rejects files over the size limit", async () => {
  const big = Buffer.alloc(5 * 1024 * 1024, 0x41)
  await assert.rejects(() => sanitizeUpload(toFile(big, "big.txt", "text/plain"), ["IMAGE", "PDF", "TEXT"]), /۴ مگابایت/)
})
