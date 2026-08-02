// Admin product QA smoke test. Exercises product create + every edit operation
// against the running dev server using the QA admin session cookie.
// Run: node --env-file-if-exists=/vercel/share/.env.project scripts/qa/admin-product-smoke.mjs "<cookie>"
const BASE = "http://localhost:3000"
const COOKIE = process.argv[2]
if (!COOKIE) throw new Error("pass session cookie as argv[2]")

let pass = 0
let fail = 0
const failures = []

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", cookie: `subio_session=${COOKIE}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function step(name, fn) {
  try {
    const { status, json } = await fn()
    const ok = status >= 200 && status < 300 && (json?.ok !== false)
    if (ok) {
      pass++
      console.log(`  PASS  ${name}  (HTTP ${status})`)
    } else {
      fail++
      const msg = json?.error?.message ?? json?.error ?? JSON.stringify(json)?.slice(0, 120)
      failures.push(`${name}: HTTP ${status} — ${msg}`)
      console.log(`  FAIL  ${name}  (HTTP ${status}) — ${msg}`)
    }
    return json?.data ?? json
  } catch (e) {
    fail++
    failures.push(`${name}: threw ${e.message}`)
    console.log(`  ERROR ${name} — ${e.message}`)
    return null
  }
}

const run = async () => {
  console.log("== Admin product QA smoke ==")

  // 1. Create a FIXED_PRICE product with AUTOMATIC delivery.
  const created = await step("create fixed product", () =>
    call("POST", "/api/v1/admin/products", {
      mode: "FIXED_PRICE",
      title: "QA Smoke Product",
      subtitle: "QA subtitle",
      deliveryType: "AUTOMATIC",
      price: "150000",
      stock: 5,
      hidden: true,
    }),
  )
  const pid = created?.id ?? created?.product?.id
  console.log("  product id:", pid)
  if (!pid) {
    console.log("cannot continue without product id")
    return finish()
  }

  // 2. Field-by-field edits via PATCH.
  await step("edit title/subtitle", () => call("PATCH", `/api/v1/admin/products/${pid}`, { title: "QA Smoke v2", subtitle: "new sub" }))
  await step("edit description", () => call("PATCH", `/api/v1/admin/products/${pid}`, { description: "<p>QA description</p>" }))
  await step("edit tags", () => call("PATCH", `/api/v1/admin/products/${pid}`, { tags: ["qa", "test"] }))
  await step("edit price/stock", () => call("PATCH", `/api/v1/admin/products/${pid}`, { price: "175000", stock: 8 }))
  await step("edit compareAtPrice", () => call("PATCH", `/api/v1/admin/products/${pid}`, { compareAtPrice: "250000" }))
  await step("edit purchaseLimit", () => call("PATCH", `/api/v1/admin/products/${pid}`, { purchaseLimit: 3 }))
  await step("edit bulk pricing", () => call("PATCH", `/api/v1/admin/products/${pid}`, { bulkMinQty: 2, bulkDiscountPercent: 10 }))
  await step("edit availability", () => call("PATCH", `/api/v1/admin/products/${pid}`, { available: true }))
  await step("edit featured", () => call("PATCH", `/api/v1/admin/products/${pid}`, { featured: true, featuredOrder: 1 }))
  await step("edit highlights", () => call("PATCH", `/api/v1/admin/products/${pid}`, { highlights: ["نکته اول", "نکته دوم"] }))
  await step("edit media (cover)", () => call("PATCH", `/api/v1/admin/products/${pid}`, { coverImage: "/placeholder.svg" }))
  await step("edit delivery template", () =>
    call("PATCH", `/api/v1/admin/products/${pid}`, {
      deliveryFields: [
        { key: "email", label: { fa: "ایمیل" }, type: "username", sensitive: false, required: true },
        { key: "pw", label: { fa: "رمز" }, type: "password", sensitive: true, required: true },
      ],
    }),
  )
  await step("clear delivery template", () => call("PATCH", `/api/v1/admin/products/${pid}`, { deliveryFields: null }))
  await step("enable customer input", () =>
    call("PATCH", `/api/v1/admin/products/${pid}`, {
      requiresCustomerInput: true,
      customerInputFields: [{ key: "note", label: { fa: "یادداشت" }, type: "text", sensitive: false, required: false }],
      avgCompletionMinutes: 30,
    }),
  )

  // 3. Variants (sale plans).
  const variant = await step("create variant", () =>
    call("POST", `/api/v1/admin/products/${pid}/variants`, {
      name: "پلن یک‌ماهه",
      price: "120000",
      stock: 3,
      deliveryType: "AUTOMATIC",
    }),
  )
  const vid = variant?.id ?? variant?.variant?.id
  console.log("  variant id:", vid)
  if (vid) {
    await step("edit variant", () => call("PATCH", `/api/v1/admin/variants/${vid}`, { price: "130000", stock: 5 }))
  }

  // 4. Inventory (into the variant pool).
  await step("add inventory", () =>
    call("POST", `/api/v1/admin/products/${pid}/inventory`, {
      variantId: vid || undefined,
      items: [{ fields: { email: "qa1@example.com", pw: "secret1" }, capacity: 1 }],
    }),
  )
  await step("list inventory", () => call("GET", `/api/v1/admin/products/${pid}/inventory${vid ? `?variantId=${vid}` : ""}`))

  // 5. Read back the product to confirm persisted state.
  await step("get product (readback)", () => call("GET", `/api/v1/admin/products/${pid}`))

  // 6. Cleanup — delete the test product (reverse any purchases).
  await step("delete test product", () => call("DELETE", `/api/v1/admin/products/${pid}`, { reversePurchases: true }))

  finish()
}

function finish() {
  console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`)
  if (failures.length) {
    console.log("Failures:")
    for (const f of failures) console.log("  - " + f)
  }
  process.exit(fail > 0 ? 1 : 0)
}

run()
