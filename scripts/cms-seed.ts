import { prisma } from "@/lib/db"
import { createContent, updateContent } from "@/lib/cms/content"
import { createCategory } from "@/lib/cms/taxonomy"

/** Create the category or return the existing one with the same type+slug. */
async function ensureCategory(type: string, name: string, slug: string) {
  const existing = await prisma.contentCategory.findFirst({ where: { type, slug } })
  if (existing) return existing
  return createCategory({ type, name, slug })
}

/**
 * Seeds sample CMS content across the built-in content types so the public
 * pages and admin dashboard have realistic data to render. Idempotent: clears
 * previously seeded CMS rows (by known slugs) before inserting.
 */
async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  if (!admin) throw new Error("No ADMIN user found to attribute seeded content")
  const actor = { id: admin.id }

  const auctionProduct = await prisma.product.findFirst({
    where: { saleMode: "AUCTION" },
    select: { id: true },
  })

  // FAQ category
  const faqCat = await ensureCategory("faq", "عمومی", "general")

  const seeded: { type: string; slug: string; title: string; body: string; publish?: boolean; fields?: Record<string, unknown>; categoryId?: string; nav?: boolean }[] = [
    {
      type: "article",
      slug: "getting-started-with-subio",
      title: "راهنمای شروع کار با ساب‌آی‌او",
      body: "<h2>خوش آمدید</h2><p>در این مقاله با نحوهٔ شروع کار با پلتفرم ساب‌آی‌او آشنا می‌شوید. از ساخت حساب کاربری تا شرکت در مزایده‌ها و خرید محصولات دیجیتال.</p><h2>ساخت حساب</h2><p>برای شروع، ابتدا یک حساب کاربری بسازید و کیف پول خود را شارژ کنید.</p>",
      publish: true,
      nav: true,
      fields: { readingTime: 4 },
    },
    {
      type: "article",
      slug: "how-auctions-work",
      title: "مزایده‌ها چگونه کار می‌کنند؟",
      body: "<h2>سازوکار مزایده</h2><p>در مزایده‌های ساب‌آی‌او هر پیشنهاد باید بالاتر از پیشنهاد قبلی باشد. برندهٔ نهایی در پایان زمان مزایده مشخص می‌شود.</p>",
      publish: true,
      fields: { readingTime: 3 },
    },
    {
      type: "tutorial",
      slug: "charge-wallet",
      title: "آموزش شارژ کیف پول",
      body: "<h2>مراحل شارژ</h2><ol><li>وارد حساب خود شوید.</li><li>به بخش کیف پول بروید.</li><li>مبلغ مورد نظر را وارد و پرداخت را تکمیل کنید.</li></ol>",
      publish: true,
      nav: true,
      fields: { difficulty: "beginner", videoUrl: "" },
    },
    {
      type: "help",
      slug: "payment-issues",
      title: "مشکلات پرداخت",
      body: "<p>اگر در فرایند پرداخت با مشکل مواجه شدید، ابتدا از اتصال اینترنت و موجودی کیف پول خود مطمئن شوید. در صورت تداوم مشکل با پشتیبانی تماس بگیرید.</p>",
      publish: true,
    },
    {
      type: "faq",
      slug: "what-is-subio",
      title: "ساب‌آی‌او چیست؟",
      body: "<p>ساب‌آی‌او یک پلتفرم خرید و مزایدهٔ محصولات دیجیتال است.</p>",
      publish: true,
      categoryId: faqCat.id,
    },
    {
      type: "faq",
      slug: "how-to-withdraw",
      title: "چگونه برداشت وجه انجام دهم؟",
      body: "<p>از بخش کیف پول، گزینهٔ برداشت را انتخاب کرده و اطلاعات حساب خود را وارد کنید.</p>",
      publish: true,
      categoryId: faqCat.id,
    },
    {
      type: "rules",
      slug: "site-rules",
      title: "قوانین و مقررات",
      body: "<h2>قوانین استفاده</h2><p>استفاده از پلتفرم به منزلهٔ پذیرش کامل قوانین است. هرگونه تخلف منجر به مسدودسازی حساب می‌شود.</p>",
      publish: true,
    },
    {
      type: "vps",
      slug: "vps",
      title: "سرور مجازی (VPS)",
      body: "<h2>سرورهای مجازی به‌زودی</h2><p>خدمات سرور مجازی ساب‌آی‌او به‌زودی راه‌اندازی می‌شود. برای اطلاع از زمان دقیق، ما را دنبال کنید.</p>",
      publish: true,
    },
    {
      type: "domain",
      slug: "domain",
      title: "ثبت دامنه",
      body: "<h2>ثبت دامنه به‌زودی</h2><p>امکان ثبت و مدیریت دامنه به‌زودی به پلتفرم اضافه خواهد شد.</p>",
      publish: true,
    },
  ]

  // Clean previous seed rows by slug to stay idempotent.
  await prisma.content.deleteMany({ where: { slug: { in: seeded.map((s) => s.slug) } } })

  const created: Record<string, string> = {}
  for (const s of seeded) {
    const c = await createContent(actor, s.type, {
      title: s.title,
      slug: s.slug,
      body: s.body,
      fields: s.fields ?? {},
      categoryId: s.categoryId ?? null,
      navShow: s.nav ?? false,
      navPlacement: s.nav ? ["SIDEBAR"] : [],
      navLabel: s.nav ? s.title : null,
      status: s.publish ? "PUBLISHED" : "DRAFT",
    })
    created[s.slug] = c.id
  }

  // Wire relations on the "getting started" article: link a related article
  // and (if present) a real auction product — proving cross-entity relations.
  const relations: { targetType: string; targetId: string; relationKey: string; order: number }[] = [
    { targetType: "content", targetId: created["how-auctions-work"], relationKey: "relatedArticles", order: 0 },
  ]
  if (auctionProduct) {
    relations.push({ targetType: "product", targetId: auctionProduct.id, relationKey: "relatedProducts", order: 0 })
  }
  await updateContent(actor, created["getting-started-with-subio"], {
    title: "راهنمای شروع کار با ساب‌آی‌او",
    relations,
  })

  console.log(`[cms-seed] Seeded ${seeded.length} content items.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
