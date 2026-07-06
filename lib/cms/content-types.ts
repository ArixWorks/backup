import type { ContentTypeDef } from "./types"

/**
 * Built-in content types. Each is pure configuration; adding a new type here
 * (or via `registerContentType`) requires NO database or core changes.
 *
 * New future types (blog, news, documentation, changelog, release-notes,
 * landing pages, knowledge base) can be added the same way.
 */

const article: ContentTypeDef = {
  key: "article",
  labelSingular: "مقاله",
  labelPlural: "مقالات",
  description: "مقالات و مطالب وبلاگ",
  icon: "Newspaper",
  routing: { basePath: "/articles", mode: "collection" },
  fields: [
    { key: "readingTime", label: "زمان مطالعه (دقیقه)", type: "number", min: 1, max: 240 },
    { key: "featured", label: "مقاله ویژه", type: "boolean" },
  ],
  taxonomy: { categories: true, tags: true },
  publishing: { scheduling: true },
  relations: [
    { key: "relatedArticles", label: "مقالات مرتبط", targetType: "content:article", multiple: true, max: 6 },
    { key: "relatedProducts", label: "محصولات مرتبط", targetType: "product", multiple: true, max: 6 },
  ],
  navigation: { canAppearInNav: true, defaultPlacement: ["HEADER"], defaultIcon: "Newspaper", defaultShow: false },
  seoDefaults: { titleSuffix: " | مجله" },
  listColumns: ["title", "category", "status", "publishedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const faq: ContentTypeDef = {
  key: "faq",
  labelSingular: "پرسش متداول",
  labelPlural: "پرسش‌های متداول",
  description: "سوالات پرتکرار کاربران",
  icon: "HelpCircle",
  routing: { basePath: "/faq", mode: "collection" },
  fields: [{ key: "highlight", label: "نمایش برجسته", type: "boolean" }],
  taxonomy: { categories: true, tags: false },
  publishing: { scheduling: false },
  relations: [
    { key: "relatedFaqs", label: "پرسش‌های مرتبط", targetType: "content:faq", multiple: true, max: 5 },
  ],
  navigation: { canAppearInNav: true, defaultPlacement: ["FOOTER"], defaultIcon: "HelpCircle", defaultShow: false },
  listColumns: ["title", "category", "status", "order"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const tutorial: ContentTypeDef = {
  key: "tutorial",
  labelSingular: "آموزش",
  labelPlural: "آموزش‌ها",
  description: "راهنماها و آموزش‌های گام‌به‌گام",
  icon: "GraduationCap",
  routing: { basePath: "/tutorials", mode: "collection" },
  fields: [
    {
      key: "difficulty",
      label: "سطح",
      type: "select",
      options: [
        { value: "beginner", label: "مقدماتی" },
        { value: "intermediate", label: "متوسط" },
        { value: "advanced", label: "پیشرفته" },
      ],
      default: "beginner",
    },
    { key: "durationMin", label: "مدت زمان (دقیقه)", type: "number", min: 1, max: 600 },
    { key: "videoUrl", label: "ویدئوی آموزش", type: "url" },
  ],
  taxonomy: { categories: true, tags: true },
  publishing: { scheduling: true },
  relations: [
    { key: "relatedTutorials", label: "آموزش‌های مرتبط", targetType: "content:tutorial", multiple: true, max: 6 },
  ],
  navigation: { canAppearInNav: true, defaultPlacement: ["HEADER"], defaultIcon: "GraduationCap", defaultShow: false },
  listColumns: ["title", "category", "status", "publishedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const help: ContentTypeDef = {
  key: "help",
  labelSingular: "راهنما",
  labelPlural: "مرکز راهنما",
  description: "مقالات پشتیبانی و مرکز راهنما",
  icon: "LifeBuoy",
  routing: { basePath: "/help", mode: "collection" },
  fields: [],
  taxonomy: { categories: true, tags: true },
  publishing: { scheduling: false },
  relations: [
    { key: "relatedHelp", label: "مطالب مرتبط", targetType: "content:help", multiple: true, max: 6 },
  ],
  navigation: { canAppearInNav: true, defaultPlacement: ["FOOTER"], defaultIcon: "LifeBuoy", defaultShow: false },
  listColumns: ["title", "category", "status", "updatedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const rules: ContentTypeDef = {
  key: "rules",
  labelSingular: "قوانین",
  labelPlural: "قوانین و مقررات",
  description: "قوانین و مقررات استفاده از سرویس",
  icon: "Scale",
  routing: { basePath: "/rules", mode: "singleton" },
  fields: [],
  taxonomy: { categories: false, tags: false },
  publishing: { scheduling: false },
  relations: [],
  navigation: { canAppearInNav: true, defaultPlacement: ["FOOTER"], defaultIcon: "Scale", defaultShow: true },
  listColumns: ["title", "status", "updatedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const vps: ContentTypeDef = {
  key: "vps",
  labelSingular: "سرور مجازی",
  labelPlural: "معرفی سرور مجازی",
  description: "محتوای صفحه معرفی سرویس سرور مجازی (منطق خرید بعداً افزوده می‌شود)",
  icon: "Server",
  routing: { basePath: "/vps", mode: "singleton" },
  fields: [
    { key: "heroTitle", label: "عنوان اصلی", type: "text", maxLength: 120 },
    { key: "heroSubtitle", label: "زیرعنوان", type: "textarea", maxLength: 300 },
    { key: "ctaLabel", label: "متن دکمه", type: "text", maxLength: 40 },
  ],
  taxonomy: { categories: false, tags: false },
  publishing: { scheduling: false },
  relations: [],
  navigation: { canAppearInNav: true, defaultPlacement: ["HEADER"], defaultIcon: "Server", defaultShow: true },
  listColumns: ["title", "status", "updatedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

const domain: ContentTypeDef = {
  key: "domain",
  labelSingular: "دامنه",
  labelPlural: "معرفی دامنه",
  description: "محتوای صفحه معرفی سرویس ثبت دامنه (منطق استعلام و ثبت بعداً افزوده می‌شود)",
  icon: "Globe",
  routing: { basePath: "/domains", mode: "singleton" },
  fields: [
    { key: "heroTitle", label: "عنوان اصلی", type: "text", maxLength: 120 },
    { key: "heroSubtitle", label: "زیرعنوان", type: "textarea", maxLength: 300 },
    { key: "ctaLabel", label: "متن دکمه", type: "text", maxLength: 40 },
  ],
  taxonomy: { categories: false, tags: false },
  publishing: { scheduling: false },
  relations: [],
  navigation: { canAppearInNav: true, defaultPlacement: ["HEADER"], defaultIcon: "Globe", defaultShow: true },
  listColumns: ["title", "status", "updatedAt"],
  permissions: ["view", "create", "update", "publish", "delete"],
}

export const BUILT_IN_CONTENT_TYPES: ContentTypeDef[] = [
  article,
  faq,
  tutorial,
  help,
  rules,
  vps,
  domain,
]
