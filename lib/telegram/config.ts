import "server-only"
import type { Locale } from "@/lib/i18n/locales"

/**
 * Default, editable bot configuration. Every value here can be overridden at
 * runtime from the admin panel (stored in the BotSetting table) without code
 * changes. Texts support {placeholders} that handlers fill in.
 *
 * Animated emoji: standard emoji automatically animate for Telegram Premium
 * users. For custom (premium) animated emoji we store a `custom_emoji_id` and
 * render it via a MessageEntity of type "custom_emoji" — see renderEmoji().
 */

export type BotTextKey =
  | "welcome"
  | "welcomeBack"
  | "menuPrompt"
  | "walletHeader"
  | "ordersHeader"
  | "ordersEmpty"
  | "flashHeader"
  | "flashEmpty"
  | "watchlistHeader"
  | "watchlistEmpty"
  | "depositPrompt"
  | "depositReceived"
  | "withdrawPrompt"
  | "withdrawReceived"
  | "linkSuccess"
  | "notifAuctionStarted"
  | "notifAuctionWon"
  | "notifOrderDelivered"
  | "notifDepositPending"
  | "notifDepositApproved"
  | "notifDepositRejected"
  | "notifWithdrawApproved"
  | "notifReferralJoined"
  | "notifReferralInviteVerified"
  | "notifReferralL2Reward"
  | "notifReferralPurchase"
  | "notifReferralCommission"
  | "referralHome"
  | "purchaseSuccess"
  | "purchaseFailed"
  | "notRegistered"
  | "help"
  | "productCard"
  | "quantityPrompt"
  | "quantityInvalid"
  | "selectPayment"
  | "insufficientBalance"
  | "paymentComingSoon"
  | "chooseLanguage"
  | "chooseLanguageWelcome"
  | "languageSet"
  | "joinRequired"
  | "accessRevoked"
  | "joinVerified"
  | "joinNotYet"

/** A custom (premium) animated emoji slot. id is the Telegram custom_emoji_id. */
export type CustomEmoji = { id: string; fallback: string }

/**
 * A channel a user MUST be a member of before using the bot (forced join).
 * `id` is what we pass to getChatMember — a public @username or a numeric
 * -100… id. `url` is the join link shown on the button (auto-derived from a
 * public @username when omitted; required for private channels). `title` is the
 * friendly label rendered on the join button.
 */
export type RequiredChannel = { id: string; title: string; url: string }

/**
 * Telegram Bot API 9.4+ button color. Maps to the `style` field of
 * InlineKeyboardButton / KeyboardButton: primary=blue, success=green,
 * danger=red. Omit (undefined) for the default neutral button.
 */
export type ButtonStyle = "primary" | "success" | "danger"

export type BotConfig = {
  /** Public-facing bot/brand name, editable any time. */
  botName: string
  brandName: string
  /** Standard emoji (auto-animate for premium users). */
  emoji: Record<string, string>
  /** Optional custom animated emoji, keyed the same as `emoji`. */
  customEmoji: Record<string, CustomEmoji>
  /** Editable message templates. */
  texts: Record<BotTextKey, string>
  /** Button labels. */
  buttons: Record<string, string>
  /** Per-button color (Bot API 9.4 `style`). Keyed by button key. */
  buttonStyles: Record<string, ButtonStyle>
  /**
   * Per-button custom animated emoji id (Bot API 9.4 `icon_custom_emoji_id`).
   * Renders an animated icon on the button itself. Keyed by button key.
   */
  buttonEmoji: Record<string, string>
  /**
   * Optional single custom emoji id applied to EVERY button that doesn't have
   * its own `buttonEmoji` override. Lets the owner animate all buttons at once.
   */
  buttonEmojiAll: string
  /** Default locale for new users / when Telegram language is unknown. */
  defaultLocale: Locale
  /** Toman per 1 USD, used to display USD prices for non-Persian locales. */
  usdRate: number
  /** Target channel id (numeric like -100... or @username) for channel posts. */
  channelId: string
  /** Channels the user must join before accessing the bot (forced join). */
  requiredChannels: RequiredChannel[]
  /** Cached bot username (from getMe) used to build purchase deep links. */
  botUsername: string
  /** Payment gateway availability. wallet is active; others are coming soon. */
  gateways: {
    wallet: boolean
    binancePay: boolean
    usdt: boolean
    cryptoBot: boolean
  }
  /** Feature toggles. */
  features: {
    miniApp: boolean
    flashBrowse: boolean
    walletInChat: boolean
    deposits: boolean
    withdrawals: boolean
    notifications: boolean
    /** Require channel membership before the bot can be used. */
    forcedJoin: boolean
    /** Browse + bid/buy-now on auctions directly in chat. */
    auctionsInChat: boolean
    /** Profile & tier screen. */
    profile: boolean
    /** Rewards & missions screen. */
    rewards: boolean
    /** In-chat notifications inbox. */
    notificationsInbox: boolean
    /** Support tickets in chat. */
    support: boolean
    /** Apply coupon codes at buy time. */
    coupons: boolean
    /** Allow paying an order directly by top-up (not only wallet balance). */
    perOrderPay: boolean
  }
}

export const DEFAULT_CONFIG: BotConfig = {
  botName: "SubIO",
  brandName: "SubIO",
  emoji: {
    wave: "👋",
    fire: "🔥",
    gavel: "🔨",
    wallet: "💎",
    money: "💰",
    party: "🎉",
    trophy: "🏆",
    box: "📦",
    bell: "🔔",
    eye: "👀",
    rocket: "🚀",
    check: "✅",
    cross: "❌",
    clock: "⏳",
    star: "⭐",
    lightning: "⚡",
    gift: "🎁",
    card: "💳",
    sparkles: "✨",
    warning: "⚠️",
    lock: "🔒",
    chart: "📈",
    cart: "🛒",
    globe: "🌐",
    megaphone: "📣",
    link: "🔗",
    key: "🔑",
    point: "👇",
    horizontal: "↔",
    alarm: "⏰",
    bullet: "▫️",
    next: "▶️",
    previous: "◀️",
    forbidden: "⛔",
    writing: "✍️",
    close: "✖️",
    question: "❓",
    plus: "➕",
    minus: "➖",
    backArrow: "⬅️",
    sos: "🆘",
    clover: "🍀",
    cinema: "🎬",
    target: "🎯",
    dice: "🎲",
    tag: "🏷️",
    user: "👤",
    users: "👥",
    chat: "💬",
    cash: "💵",
    note: "📝",
    announce: "📢",
    refresh: "🔄",
    blue: "🔵",
    emergency: "🚨",
    prohibited: "🚫",
    tools: "🛠",
    shieldText: "🛡",
    shield: "🛡️",
    yellow: "🟡",
    robot: "🤖",
    goldMedal: "🥇",
    receipt: "🧾",
  },
  customEmoji: {},
  texts: {
    welcome:
      "{wave} سلام {name} عزیز!\n\nبه *{brand}* خوش اومدی {sparkles}\nبازار حرفه‌ای محصولات دیجیتال با مزایده زنده و فروشگاه.\n\nاز دکمه‌های پایین استفاده کن یا اپ رو باز کن {rocket}",
    welcomeBack: "{wave} دوباره سلام {name}!\nخوشحالیم که برگشتی {sparkles}",
    menuPrompt: "{star} از منوی زیر یکی رو انتخاب کن:",
    walletHeader:
      "{wallet} *کیف پول شما*\n\n{money} موجودی کل: *{total}*\n{lock} مسدودشده: *{frozen}*\n{check} قابل برداشت: *{available}*",
    ordersHeader: "{box} *سفارش‌های اخیر شما*",
    ordersEmpty: "{box} هنوز سفارشی ثبت نکردی.\nبرای شروع، فروشگاه رو ببین {fire}",
    flashHeader: "{fire} *فروشگاه*\nمحصولات با تحویل آنی:",
    flashEmpty: "{clock} در حال حاضر محصولی در فروشگاه موجود نیست.",
    watchlistHeader: "{eye} *مزایده‌های در حال پیگیری*",
    watchlistEmpty: "{eye} لیست پیگیری خالیه.\nمزایده‌ها رو ببین و دکمه پیگیری رو بزن {bell}",
    depositPrompt:
      "{card} *شارژ کیف پول*\n\nمبلغ موردنظرت رو به تومان بفرست (مثلاً 500000).\nسپس رسید کارت‌به‌کارت بررسی و تأیید می‌شه {check}",
    depositReceived:
      "{check} درخواست واریز *{amount}* تومان ثبت شد.\nپس از تأیید ادمین، کیف پولت شارژ می‌شه {sparkles}",
    withdrawPrompt: "{money} *برداشت وجه*\n\nمبلغ موردنظر برای برداشت رو به تومان بفرست.",
    withdrawReceived:
      "{check} درخواست برداشت *{amount}* تومان ثبت شد.\nپس از بررسی، واریز انجام می‌شه {sparkles}",
    linkSuccess: "{check} حساب تلگرام با موفقیت متصل شد {party}",
    notifAuctionStarted:
      "{bell} *مزایده شروع شد!*\n\n{gavel} {title}\nقیمت پایه: *{price}* تومان\n\nهمین حالا پیشنهاد بده {fire}",
    notifAuctionWon:
      "{trophy} *تبریک! برنده شدی* {party}\n\n{gavel} {title}\nمبلغ نهایی: *{price}* تومان\n\nسفارشت در حال آماده‌سازیه {box}",
    notifOrderDelivered:
      "{gift} *سفارشت تحویل داده شد!* {party}\n\n{box} {title}\nاطلاعات تحویل رو در اپ ببین {sparkles}",
    notifDepositPending:
      "{clock} *درخواست افزایش موجودی ثبت شد*\n\n{money} مبلغ *{amount}* تومان\n\nدرخواستت با موفقیت دریافت شد و در انتظار بررسی ادمینه. نتیجه‌ی نهایی به‌زودی در کیف پولت نمایش داده می‌شه {sparkles}",
    notifDepositApproved:
      "{check} *واریز تأیید شد* {party}\n\n{money} مبلغ *{amount}* تومان به کیف پولت اضافه شد.",
    notifDepositRejected:
      "{cross} *درخواست افزایش موجودی رد شد*\n\n{money} مبلغ *{amount}* تومان\n\n{warning} دلیل: {reason}\n\nدر صورت واریز واقعی، رسید معتبر رو از طریق پشتیبانی ارسال کن.",
    notifWithdrawApproved: "{check} *برداشت شما انجام شد* {sparkles}\n\n{money} مبلغ: *{amount}* تومان",
  notifReferralJoined:
    "{party} *دعوت موفق!*\n\nدوستت *{name}* با لینک تو وارد ربات شد و عضو کانال‌ها شد {sparkles}\n{money} *{bonus}* تومان پاداش به کیف پولت اضافه شد!",
  notifReferralInviteVerified:
    "{party} *دعوت شما تکمیل شد!*\n\nکاربر دعوت‌شده‌ی شما *{name}* ، دعوت شما را پذیرفت و عضو جامعه SubIO شد {sparkles}\n\nپاداش شما زمانی فعال می‌شود که این کاربر یک دعوت معتبر دیگر ثبت کند {fire}",
  notifReferralL2Reward:
    "{trophy} *پاداش دعوت سطح دو!*\n\nاز زنجیره‌ی دعوت شما یک کاربر معتبر جدید عضو شد {party}\n{money} *{amount}* تومان پاداش به کیف پولت اضافه شد!",
  notifReferralPurchase:
    "{trophy} *عالیه!* دوستت *{name}* اولین خریدش رو انجام داد {party}\n\n{money} *{bonus}* تومان پاداش دعوت گرفتی!\nدوستان بیشتری دعوت کن و بیشتر کسب کن {fire}",
  notifReferralCommission:
    "{sparkles} از خرید دوستت *{name}* مبلغ *{amount}* تومان اعتبار گرفتی {money}\nاین پاداش با هر خرید دوستانت تکرار می‌شه!",
  referralHome:
    "{gift} *دعوت دوستان*\n\nلینک اختصاصی تو:\n{link}\n\nبا هر دعوت موفق پاداش می‌گیری و از *هر خرید* دوستانت هم اعتبار دائمی نصیبت می‌شه {fire}\n\n{chart} دعوت‌شده: *{total}* · فعال: *{joined}* · خریدکرده: *{rewarded}*\n{money} مجموع درآمد تو: *{earned}* تومان",
    purchaseSuccess:
      "{party} *خرید موفق!*\n\n{box} {title}\n{money} مبلغ: *{price}*\n\nاطلاعات تحویل در «سفارش‌های من» {gift}",
    purchaseFailed: "{cross} خرید ناموفق بود:\n{reason}",
    notRegistered: "{warning} برای استفاده، اول باید حسابت رو بسازی.\nدستور /start رو بزن {rocket}",
    help: "{star} *راهنمای {brand}*\n\n/start شروع و منوی اصلی\n/wallet کیف پول\n/orders سفارش‌ها\n/flash فروشگاه\n/watchlist پیگیری‌ها\n/language تغییر زبان\n/app باز کردن اپ\n/help این راهنما",
    productCard:
      "{star} *{title}*\n\n{money} قیمت: *{price}*\n{box} موجودی: *{stock}*\n{chart} فروخته‌شده: *{sold}*{bulk}{links}",
    quantityPrompt:
      "{cart} *{title}*\n{money} قیمت هر واحد: *{price}*\n{box} موجودی: *{stock}*{bulk}\n\n{box} چند عدد می‌خوای؟ ({min}–{max})",
    quantityInvalid: "{warning} لطفاً یک عدد بین {min} تا {max} بفرست.",
    selectPayment: "{card} *انتخاب روش پرداخت*\nسفارش {orderTitle} — *{total}*",
    insufficientBalance:
      "{cross} *موجودی ناکافی!*\n\n{money} موجودی: *{balance}*\n{box} مبلغ لازم: *{required}*\n\nابتدا کیف پولت رو شارژ کن.",
    paymentComingSoon: "{clock} این روش پرداخت به‌زودی فعال می‌شه. فعلاً از کیف پول استفاده کن {wallet}",
    chooseLanguage: "{star} زبان مورد نظرت رو انتخاب کن:",
    chooseLanguageWelcome:
      "{globe} سلام! اول زبان مورد نظرت رو انتخاب کن {point}\n{globe} Hi! Please choose your language first {point}",
    languageSet: "{check} زبان با موفقیت تغییر کرد {sparkles}",
    joinRequired:
      "{lock} *عضویت اجباری* {megaphone}\n\nبرای استفاده از *{brand}* اول باید توی کانال‌های زیر عضو بشی {point}\n\nبعد از عضویت، دکمه‌ی *«بررسی عضویت»* رو بزن تا دسترسیت فعال بشه {check}",
    accessRevoked:
      "{warning} *دسترسی شما قطع شد!* {lock}\n\nبه‌نظر می‌رسه از یکی از کانال‌های اجباری خارج شدی {cross}\nبرای دسترسی دوباره به *{brand}*، مجدداً توی کانال‌(های) زیر عضو شو {point}\n\nسپس دکمه‌ی *«بررسی عضویت»* رو بزن {check}",
    joinVerified:
      "{party} *عالی!* عضویتت تأیید شد {sparkles}\n\nحالا به همه‌ی امکانات *{brand}* دسترسی داری {rocket}",
    joinNotYet: "{warning} هنوز توی همه‌ی کانال‌ها عضو نشدی! اول عضو شو بعد بررسی کن.",
  },
  buttons: {
    openApp: "🚀 باز کردن اپ",
    auctions: "🔨 مزایده‌ها",
    flash: "🔥 فروشگاه",
    wallet: "💎 کیف پول",
    orders: "📦 سفارش‌ها",
    watchlist: "👀 پیگیری‌ها",
    invite: "🎁 دعوت دوستان",
    shareInvite: "📣 ارسال لینک دعوت",
    deposit: "💳 شارژ کیف پول",
    withdraw: "💰 برداشت",
    help: "❓ راهنما",
    back: "⬅️ بازگشت",
    buy: "🛒 خرید فوری",
    refresh: "🔄 بروزرسانی",
    buyNow: "🛒 خرید",
    payWallet: "💎 پرداخت با کیف پول",
    payBinance: "🟡 پرداخت با Binance Pay",
    payUsdt: "💵 پرداخت با USDT",
    payCrypto: "🤖 پرداخت با CryptoBot",
    cancel: "❌ انصراف",
    language: "🌐 زبان",
    joinChannel: "📣 عضویت در کانال",
    checkJoin: "✅ بررسی عضویت",
    profile: "👤 پروفایل",
    rewards: "🎯 جوایز و ماموریت‌ها",
    notifications: "🔔 اعلان‌ها",
    support: "🆘 پشتیبانی",
    bid: "🔨 ثبت پیشنهاد",
    buyNowAuction: "🛒 خرید فوری",
    watch: "👀 پیگیری",
    unwatch: "🚫 لغو پیگیری",
    iPaid: "✅ پرداخت کردم",
    uploadReceipt: "🧾 ارسال رسید",
    claim: "🎁 دریافت پاداش",
    markAllRead: "✅ خواندن همه",
    newTicket: "➕ تیکت جدید",
    replyTicket: "✍️ پاسخ",
    closeTicket: "🔒 بستن تیکت",
    applyCoupon: "🏷️ کد تخفیف",
    prev: "◀️ قبلی",
    next: "بعدی ▶️",
    backToList: "⬅️ باز��شت به لیست",
    depCard: "💳 کارت به کارت",
    depTon: "💎 TON",
    depUsdt: "💵 USDT",
    depStars: "⭐ تلگرام استارز",
  },
  buttonStyles: {
    openApp: "success",
    auctions: "primary",
    flash: "danger",
    wallet: "primary",
    orders: "primary",
    watchlist: "primary",
    invite: "success",
    deposit: "success",
    withdraw: "danger",
    help: "primary",
    back: "primary",
    buy: "success",
    refresh: "primary",
    buyNow: "success",
    payWallet: "success",
    payBinance: "primary",
    payUsdt: "primary",
    payCrypto: "primary",
    cancel: "danger",
    language: "primary",
    joinChannel: "primary",
    checkJoin: "success",
    profile: "primary",
    rewards: "success",
    notifications: "primary",
    support: "primary",
  },
  // Verified, universally-available Telegram custom emoji ids (animated for
  // premium bot owners). These render as the button icon via
  // `icon_custom_emoji_id`. Custom emoji ids are global, so these work for any
  // bot whose owner has Telegram Premium.
  buttonEmoji: {
    openApp: "5040016479722931047", // sparkles
    auctions: "6008220984346152956", // megaphone
    flash: "5440841102871517055", // buy-now / cart
    wallet: "6325337334845805326", // wallet
    orders: "5372957680174384345", // orders/box
    watchlist: "6064341363497899398", // analytics / eye
    deposit: "5039789890133296083", // moneybag
    withdraw: "5040025580758631490", // cash
    help: "5201990176175299013", // support / headset
    back: "5352759161945867747", // arrow back
    buy: "6102911544205515696", // cart
    refresh: "5244758760429213978", // refresh
    joinChannel: "6008220984346152956", // megaphone (animated)
    checkJoin: "5244758760429213978", // refresh / re-check (animated)
  },
  buttonEmojiAll: "",
  defaultLocale: "fa",
  usdRate: 100_000,
  channelId: "",
  requiredChannels: [],
  botUsername: "",
  gateways: {
    wallet: true,
    binancePay: false,
    usdt: false,
    cryptoBot: false,
  },
  features: {
    miniApp: true,
    flashBrowse: true,
    walletInChat: true,
    deposits: true,
    withdrawals: true,
    notifications: true,
    forcedJoin: false,
    auctionsInChat: true,
    profile: true,
    rewards: true,
    notificationsInbox: true,
    support: true,
    coupons: true,
    perOrderPay: true,
  },
}
