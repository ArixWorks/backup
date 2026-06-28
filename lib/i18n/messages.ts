/**
 * Web app (client) UI string catalog for all supported locales.
 * Keys are flat dotted strings; use the `t()` helper from the i18n provider.
 */

import type { Locale } from "./locales"

export type MessageKey =
  | "nav.home"
  | "nav.auctions"
  | "nav.flash"
  | "nav.wallet"
  | "nav.orders"
  | "nav.giveaways"
  | "giveaways.title"
  | "giveaways.subtitle"
  | "common.toman"
  | "common.viewAll"
  | "common.loading"
  | "common.back"
  | "common.cancel"
  | "common.done"
  | "common.continue"
  | "common.vip"
  | "lang.selectTitle"
  | "trust.secure"
  | "trust.fast"
  | "trust.support"
  | "tour.skip"
  | "tour.step"
  | "tour.next"
  | "tour.start"
  | "tour.s1.title"
  | "tour.s1.body"
  | "tour.s2.title"
  | "tour.s2.body"
  | "tour.s3.title"
  | "tour.s3.body"
  | "tour.s4.title"
  | "tour.s4.body"
  | "tour.s5.title"
  | "tour.s5.body"
  | "success.title"
  | "success.body"
  | "success.start"
  | "tier.standard"
  | "tier.bronze"
  | "tier.silver"
  | "tier.gold"
  | "tier.diamond"
  | "tier.vip"
  | "membership.title"
  | "membership.discount"
  | "membership.vipExclusive"
  | "home.welcome"
  | "home.balance"
  | "home.topup"
  | "home.quickActions"
  | "home.liveAuctions"
  | "home.flashSales"
  | "home.noAuctions"
  | "home.noFlash"
  | "wallet.title"
  | "wallet.available"
  | "wallet.total"
  | "wallet.frozen"
  | "wallet.transactions"
  | "wallet.noTransactions"
  | "wallet.topup"
  | "wallet.withdraw"
  | "auctions.title"
  | "auctions.subtitle"
  | "auctions.empty"
  | "auctions.live"
  | "auctions.scheduled"
  | "auctions.ended"
  | "auctions.currentBid"
  | "auctions.startsAt"
  | "flash.title"
  | "flash.subtitle"
  | "flash.empty"
  | "detail.back"
  | "detail.description"
  | "detail.tags"
  | "detail.share"
  | "detail.shareCopied"
  | "detail.notFound"
  | "detail.eachFrom"
  | "detail.restockNotice"
  | "search.placeholder"
  | "search.all"
  | "search.noResults"
  | "sort.label"
  | "sort.newest"
  | "sort.priceAsc"
  | "sort.priceDesc"
  | "sort.popular"
  | "reviews.title"
  | "reviews.empty"
  | "reviews.write"
  | "reviews.edit"
  | "reviews.yourRating"
  | "reviews.commentPlaceholder"
  | "reviews.submit"
  | "reviews.delete"
  | "reviews.mustBuy"
  | "reviews.you"
  | "reviews.thanks"
  | "reviews.ratingsCount"
  | "flash.buy"
  | "flash.soldOut"
  | "flash.stock"
  | "flash.sold"
  | "flash.autoDelivery"
  | "flash.manualDelivery"
  | "buy.quantity"
  | "buy.unitPrice"
  | "buy.total"
  | "buy.selectPayment"
  | "buy.payWallet"
  | "buy.comingSoon"
  | "buy.insufficient"
  | "buy.confirm"
  | "buy.success"
  | "buy.deliveryInfo"
  | "buy.pendingManual"
  | "buy.loginFirst"
  | "buy.bulkHint"
  | "buy.subtotal"
  | "coupon.placeholder"
  | "coupon.apply"
  | "coupon.applied"
  | "coupon.remove"
  | "coupon.discount"
  | "coupon.invalid"
  | "coupon.expired"
  | "coupon.notStarted"
  | "coupon.minOrder"
  | "coupon.exhausted"
  | "coupon.userLimit"
  | "orders.title"
  | "orders.empty"
  | "orders.quantity"
  | "watchlist.title"
  | "watchlist.subtitle"
  | "watchlist.empty"
  | "watchlist.browse"
  | "lang.choose"
  | "auth.tagline"
  | "auth.telegramBtn"
  | "auth.secureNote"
  | "auth.privacyTitle"
  | "auth.privacy1"
  | "auth.privacy2"
  | "auth.privacy3"
  | "auth.privacy4"
  | "auth.or"
  | "auth.email"
  | "auth.password"
  | "auth.displayName"
  | "auth.signIn"
  | "auth.signUp"
  | "auth.toSignUp"
  | "auth.toSignIn"
  | "auth.signingIn"
  | "auth.widgetMissing"
  | "auth.logout"
  | "profile.title"
  | "profile.account"
  | "profile.telegram"
  | "profile.email"
  | "profile.role"
  | "profile.notLinked"
  | "profile.language"
  | "join.title"
  | "join.subtitle"
  | "join.notJoined"
  | "join.verified"
  | "join.enter"
  | "join.checkMe"
  | "join.checking"
  | "join.confirmed"
  | "join.retry"
  | "join.failed"
  | "wallet.signInRequired"
  | "wallet.topupDemo"
  | "wallet.amountPlaceholder"
  | "wallet.charge"
  | "wallet.demoNote"
  | "wallet.minTopup"
  | "wallet.topupSuccess"
  | "wallet.topupError"
  | "wallet.rewardsTitle"
  | "wallet.rewardsSubtitle"
  | "notif.title"
  | "notif.subtitle"
  | "notif.signInRequired"
  | "orders.signInRequired"
  | "orders.emptyDesc"
  | "orders.emptyAction"
  | "orders.codeLabel"
  | "orders.deliveryInfo"
  | "orders.refundedNote"
  | "status.pending"
  | "status.paid"
  | "status.delivered"
  | "status.completed"
  | "status.failed"
  | "status.refunded"
  | "status.cancelled"
  | "payload.username"
  | "payload.password"
  | "payload.email"
  | "payload.licenseKey"
  | "payload.code"
  | "payload.note"
  | "payload.url"
  | "account.title"
  | "account.subtitle"
  | "account.activeMethods"
  | "account.noMethods"
  | "account.logoutAll"
  | "account.logoutAllDesc"
  | "account.logoutAllError"
  | "account.methodTelegram"
  | "account.methodPassword"
  | "auctions.emptyDesc"
  | "auctions.finalized"
  | "auctions.cancelled"
  | "giveaways.myWins"
  | "giveaways.empty"
  | "giveaways.emptyDesc"
  | "giveaways.past"
  | "giveaways.all"
  | "giveaways.notFound"
  | "adetail.back"
  | "adetail.bids"
  | "adetail.bidHistory"
  | "adetail.noBids"
  | "adetail.auto"
  | "adetail.topBidNow"
  | "adetail.basePrice"
  | "adetail.startsIn"
  | "adetail.endsIn"
  | "adetail.reserveMet"
  | "adetail.reserveNotMet"
  | "adetail.minIncrement"
  | "adetail.winnersCount"
  | "adetail.endTime"
  | "wins.signInRequired"
  | "wins.copied"
  | "wins.copyFailed"
  | "wins.copy"
  | "wins.pendingManual"
  | "wins.pendingAuto"
  | "wins.walletCredited"
  | "wins.couponTitle"
  | "wins.claimTitle"
  | "wins.position"
  | "wins.empty"
  | "wins.emptyDesc"
  | "wins.emptyAction"

type Catalog = Record<MessageKey, string>

const fa: Catalog = {
  "nav.home": "خانه",
  "nav.auctions": "مزایده‌ها",
  "nav.flash": "فروش فوری",
  "nav.wallet": "کیف پول",
  "nav.orders": "سفارش‌ها",
  "nav.giveaways": "قرعه‌کشی",
  "giveaways.title": "قرعه‌کشی‌ها",
  "giveaways.subtitle": "با عضویت در کانال‌ها در قرعه‌کشی‌ها شرکت کن و برنده شو",
  "common.toman": "تومان",
  "common.viewAll": "مشاهده همه",
  "common.loading": "در حال بارگذاری…",
  "common.back": "بازگشت",
  "common.cancel": "انصراف",
  "common.done": "تمام",
  "common.continue": "ادامه",
  "common.vip": "عضویت ویژه",
  "lang.selectTitle": "زبان خود را انتخاب کنید",
  "trust.secure": "امن و مطمئن",
  "trust.fast": "سریع و آسان",
  "trust.support": "پشتیبانی ۲۴/۷",
  "tour.skip": "رد کردن",
  "tour.step": "مرحله {n} از {total}",
  "tour.next": "بعدی",
  "tour.start": "بزن بریم",
  "tour.s1.title": "به فروشگاه خوش آمدید",
  "tour.s1.body": "محصولات دیجیتال، حساب‌ها و کلیدها را مرور کنید. همه‌چیز مرتب و دسته‌بندی‌شده است.",
  "tour.s2.title": "موجودی خود را شارژ کنید",
  "tour.s2.body": "با کیف پول، ارز دیجیتال یا درگاه، موجودی اضافه کنید و سریع‌تر خرید کنید.",
  "tour.s3.title": "خرید محصول",
  "tour.s3.body": "روی هر محصول بزنید تا جزئیات را ببینید و پرداخت کنید. تحویل آنی همین‌جا انجام می‌شود.",
  "tour.s4.title": "در مزایده‌ها شرکت کنید",
  "tour.s4.body": "روی محصولات ویژه پیشنهاد بدهید و با بهترین قیمت برنده شوید — یک امکان منحصربه‌فرد.",
  "tour.s5.title": "هیچ‌چیز را از دست ندهید",
  "tour.s5.body": "برای موجودی مجدد و قرعه‌کشی‌ها اعلان دریافت کنید و همیشه یک قدم جلوتر باشید.",
  "success.title": "همه‌چیز آماده است!",
  "success.body": "تمام شد. از فروشگاه لذت ببرید — شارژ کنید، خرید کنید، تمام.",
  "success.start": "شروع خرید",
  "tier.standard": "استاندارد",
  "tier.bronze": "برنزی",
  "tier.silver": "نقره‌ای",
  "tier.gold": "طلایی",
  "tier.diamond": "دایموند",
  "tier.vip": "وی‌آی‌پی",
  "membership.title": "سطح عضویت",
  "membership.discount": "{n}٪ تخفیف روی محصولات",
  "membership.vipExclusive": "عضویت اختصاصی ویژه",
  "home.welcome": "خوش آمدید",
  "home.balance": "موجودی قابل استفاده",
  "home.topup": "شارژ کیف پول",
  "home.quickActions": "دسترسی سریع",
  "home.liveAuctions": "مزایده‌های فعال",
  "home.flashSales": "فروش فوری",
  "home.noAuctions": "مزایده‌ی فعالی وجود ندارد.",
  "home.noFlash": "فروش فوری فعالی وجود ندارد.",
  "wallet.title": "کیف پول",
  "wallet.available": "موجودی قابل استفاده",
  "wallet.total": "موجودی کل",
  "wallet.frozen": "مسدودشده در مزایده",
  "wallet.transactions": "تراکنش‌ها",
  "wallet.noTransactions": "تراکنشی ثبت نشده است.",
  "wallet.topup": "افزایش موجودی",
  "wallet.withdraw": "برداشت",
  "auctions.title": "مزایده‌ها",
  "auctions.subtitle": "روی محصولات دیجیتال پیشنهاد بدهید؛ مبلغ پیشنهاد تا پایان مزایده مسدود می‌شود.",
  "auctions.empty": "مزایده‌ای یافت نشد.",
  "auctions.live": "در حال برگزاری",
  "auctions.scheduled": "زمان‌بندی‌شده",
  "auctions.ended": "پایان‌یافته",
  "auctions.currentBid": "بالاترین پیشنهاد",
  "auctions.startsAt": "شروع",
  "flash.title": "فروش فوری",
  "flash.subtitle": "خرید آنی با قیمت ثابت؛ محصولات تحویل خودکار بلافاصله پس از پرداخت ارسال می‌شوند.",
  "flash.empty": "فروش فوری فعالی وجود ندارد.",
  "detail.back": "بازگشت به فروش فوری",
  "detail.description": "توضیحات",
  "detail.tags": "برچسب‌ها",
  "detail.share": "اشتراک‌گذاری",
  "detail.shareCopied": "لینک کپی شد",
  "detail.notFound": "این محصول یافت نشد یا دیگر در دسترس نیست.",
  "detail.eachFrom": "هر واحد از",
  "detail.restockNotice": "این محصول تمام شده است. برای اطلاع از موجودی مجدد، اطلاع‌رسانی را فعال کنید.",
  "search.placeholder": "جستجوی محصول…",
  "search.all": "همه",
  "search.noResults": "نتیجه‌ای برای جستجوی شما یافت نشد.",
  "sort.label": "مرتب‌سازی",
  "sort.newest": "جدیدترین",
  "sort.priceAsc": "ارزان‌ترین",
  "sort.priceDesc": "گران‌ترین",
  "sort.popular": "پرفروش‌ترین",
  "reviews.title": "نظرات �� امتیازها",
  "reviews.empty": "هنوز نظری ثبت نشده است. اولین نفر باشید!",
  "reviews.write": "ثبت نظر",
  "reviews.edit": "ویرایش نظر",
  "reviews.yourRating": "امتیاز شما",
  "reviews.commentPlaceholder": "تجربه‌ی خود را بنویسید (اختیاری)…",
  "reviews.submit": "ثبت",
  "reviews.delete": "حذف نظر",
  "reviews.mustBuy": "فقط خریدار��ن این محصول می‌توانند نظر ثبت کنند.",
  "reviews.you": "شما",
  "reviews.thanks": "از ثبت نظر شما متشکریم!",
  "reviews.ratingsCount": "نظر",
  "flash.buy": "خرید",
  "flash.soldOut": "ناموجود",
  "flash.stock": "موجودی",
  "flash.sold": "فروخته‌شده",
  "flash.autoDelivery": "تحویل خودکار",
  "flash.manualDelivery": "تحویل دستی",
  "buy.quantity": "تعداد",
  "buy.unitPrice": "قیمت هر واحد",
  "buy.total": "مبلغ کل",
  "buy.selectPayment": "انتخاب روش پرداخت",
  "buy.payWallet": "پرداخت با کیف پول",
  "buy.comingSoon": "به‌زودی",
  "buy.insufficient": "موجودی کیف پول کافی نیست.",
  "buy.confirm": "تأیید و پرداخت",
  "buy.success": "خرید موفق",
  "buy.deliveryInfo": "اطلاعات تحویل (تحویل خودکار):",
  "buy.pendingManual": "سفارش شما ثبت شد و در انتظار تحویل دستی است. وضعیت را از بخش سفارش‌ها پیگیری کنید.",
  "buy.loginFirst": "ابتدا یک حساب کاربری انتخاب کنید",
  "buy.bulkHint": "تخفیف عمده",
  "buy.subtotal": "جمع جزء",
  "coupon.placeholder": "کد تخفیف",
  "coupon.apply": "اعمال",
  "coupon.applied": "کد تخفیف اعمال شد",
  "coupon.remove": "حذف",
  "coupon.discount": "تخفیف",
  "coupon.invalid": "کد تخفیف نامعتبر است.",
  "coupon.expired": "این کد تخفیف منقضی شده است.",
  "coupon.notStarted": "این کد تخفیف هنوز فعال نشده است.",
  "coupon.minOrder": "مبلغ سفارش برای این کد کافی نیست.",
  "coupon.exhausted": "ظرفیت این کد تخفیف تکمیل شده است.",
  "coupon.userLimit": "شما قبلاً از این کد استفاده کرده‌اید.",
  "orders.title": "سفارش‌های من",
  "orders.empty": "هنوز سفارشی ثبت نکرده‌اید.",
  "orders.quantity": "تعداد",
  "watchlist.title": "لیست پیگیری",
  "watchlist.subtitle": "مزایده‌هایی که دنبال می‌کنید؛ هنگام شروع هر مزایده به شما اطلاع داده می‌شود.",
  "watchlist.empty": "هنوز مزایده‌ای را پیگیری نمی‌کنید.",
  "watchlist.browse": "مشاهده مزایده‌ها",
  "lang.choose": "انتخاب زبان",
  "auth.tagline": "برای ادامه، با حساب تلگرام خود وارد شوید",
  "auth.telegramBtn": "ورود با تلگرام",
  "auth.secureNote": "ورود امن از طریق تلگرام",
  "auth.privacyTitle": "حریم خصوصی و امنیت",
  "auth.privacy1": "از ورود رسمی تلگرام استفاده می‌شود — ما هرگز به حساب یا رمز شما دسترسی نداریم",
  "auth.privacy2": "فقط نام، نام کاربری و عکس پروفایل شما خوانده می‌شود",
  "auth.privacy3": "پیام‌ها و گفتگوهای شما کاملاً برای ما غیرقابل‌دسترس است",
  "auth.privacy4": "تلگرام صحت ورود را پیش از دریافت اطلاعات توسط ما تأیید می‌کند",
  "auth.or": "یا",
  "auth.email": "ایمیل",
  "auth.password": "رمز عبور",
  "auth.displayName": "نام نمایشی (اختیاری)",
  "auth.signIn": "ورود",
  "auth.signUp": "ثبت‌نام",
  "auth.toSignUp": "حساب ندارید؟ ثبت‌نام کنید",
  "auth.toSignIn": "حساب دارید؟ وارد شوید",
  "auth.signingIn": "در حال ورود…",
  "auth.widgetMissing": "ورود تلگرام هنوز پیکربندی نشده است. لطفاً با ایمیل وارد شوید.",
  "auth.logout": "خروج از حساب",
  "profile.title": "پروفایل من",
  "profile.account": "حساب کاربری",
  "profile.telegram": "تلگرام",
  "profile.email": "ایمیل",
  "profile.role": "نقش",
  "profile.notLinked": "متصل نشده",
  "profile.language": "زبان",
  "join.title": "فقط برای اعضا",
  "join.subtitle": "برای استفاده از {brand} روی هر کانال بزن و عضو شو؛ بعد از بازگشت، تیک سبز روشن می‌شود.",
  "join.notJoined": "هنوز عضو نشده‌اید — دوباره امتحان کن",
  "join.verified": "عضویت تأیید شد",
  "join.enter": "ورود به اپ",
  "join.checkMe": "عضو شدم، بررسی کن",
  "join.checking": "در حال بررسی…",
  "join.confirmed": "تأیید شد",
  "join.retry": "دوباره بررسی کن",
  "join.failed": "عضویت همه‌ی کانال‌ها تأیید نشد. ابتدا عضو شو، سپس دوباره بررسی کن.",
  "wallet.signInRequired": "برای مشاهده کیف پول، ابتدا وارد حساب کاربری خود شوید.",
  "wallet.topupDemo": "شارژ کیف پول (دمو)",
  "wallet.amountPlaceholder": "مبلغ به تومان",
  "wallet.charge": "شارژ",
  "wallet.demoNote": "در نسخه واقعی، شارژ از طریق کارت‌به‌کارت و تأیید مدیر انجام می‌شود.",
  "wallet.minTopup": "حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است",
  "wallet.topupSuccess": "کیف پول شارژ شد",
  "wallet.topupError": "خطا در شارژ کیف پول",
  "wallet.rewardsTitle": "باشگاه مشتریان و امتیازها",
  "wallet.rewardsSubtitle": "سطح عضویت، مأموریت‌ها و دستاوردهای خود را ببینید",
  "notif.title": "اعلان‌ها",
  "notif.subtitle": "آخرین رویدادهای حساب شما: موجودی محصولات، سفارش‌ها، مزایده‌ها و تراکنش‌ها.",
  "notif.signInRequired": "برای مشاهده اعلان‌ها، ابتدا وارد حساب کاربری خود شوید.",
  "orders.signInRequired": "برای مشاهده سفارش‌ها، ابتدا وارد حساب کاربری خود شوید.",
  "orders.emptyDesc": "از فروش فوری دیدن کنید و اولین خرید خود را انجام دهید.",
  "orders.emptyAction": "مشاهده فروش فوری",
  "orders.codeLabel": "کد سفارش",
  "orders.deliveryInfo": "اطلاعات تحویل:",
  "orders.refundedNote": "تحویل ناموفق بود و مبلغ به‌صورت خودکار به کیف پول شما بازگشت داده شد.",
  "status.pending": "در انتظار",
  "status.paid": "پرداخت‌شده",
  "status.delivered": "تحویل‌شده",
  "status.completed": "تکمیل‌شده",
  "status.failed": "ناموفق",
  "status.refunded": "بازگشت‌خورده",
  "status.cancelled": "لغوشده",
  "payload.username": "نام کاربری",
  "payload.password": "رمز عبور",
  "payload.email": "ایمیل",
  "payload.licenseKey": "کلید لایسنس",
  "payload.code": "کد",
  "payload.note": "توضیحات",
  "payload.url": "لینک",
  "account.title": "تنظیمات حساب و امنیت",
  "account.subtitle": "روش‌های ورود و امنیت حساب خود را مدیریت کنید",
  "account.activeMethods": "روش‌های ورود فعال",
  "account.noMethods": "هنوز هیچ روش ورود کاملی فعال نیست. برای ایمن‌سازی حساب، ایمیل خود را تأیید کنید یا تلگرام را متصل کنید.",
  "account.logoutAll": "خروج از همه دستگاه‌ها",
  "account.logoutAllDesc": "با این کار همه نشست‌های فعال در سایر دستگاه‌ها باطل می‌شوند و باید دوباره وارد شوید.",
  "account.logoutAllError": "خروج از همه دستگاه‌ها ناموفق بود",
  "account.methodTelegram": "تلگرام",
  "account.methodPassword": "ایمیل و رمز عبور",
  "auctions.emptyDesc": "در حال حاضر مزایده فعالی برگزار نمی‌شود. بعداً دوباره سر بزنید.",
  "auctions.finalized": "تسویه‌شده",
  "auctions.cancelled": "لغوشده",
  "giveaways.myWins": "جوایز من",
  "giveaways.empty": "در حال حاضر قرعه‌کشی فعالی وجود ندارد",
  "giveaways.emptyDesc": "به‌زودی قرعه‌کشی‌های جدید اضافه می‌شود. منتظر بمانید!",
  "giveaways.past": "قرعه‌کشی‌های پیشین",
  "giveaways.all": "همه قرعه‌کشی‌ها",
  "giveaways.notFound": "قرعه‌کشی یافت نشد",
  "adetail.back": "بازگشت به مزایده‌ها",
  "adetail.bids": "{n} پیشنهاد",
  "adetail.bidHistory": "تاریخچه پیشنهادها",
  "adetail.noBids": "هنوز پیشنهادی ثبت نشده است. اولین پیشنهاد را شما ثبت کنید.",
  "adetail.auto": "خودکار",
  "adetail.topBidNow": "بالاترین پیشنهاد فعلی",
  "adetail.basePrice": "قیمت پایه",
  "adetail.startsIn": "شروع تا",
  "adetail.endsIn": "پایان تا",
  "adetail.reserveMet": "قیمت رزرو فروشنده تأمین شده است",
  "adetail.reserveNotMet": "قیمت رزرو هنوز تأمین نشده است",
  "adetail.minIncrement": "حداقل افزایش",
  "adetail.winnersCount": "تعداد برنده",
  "adetail.endTime": "زمان پایان",
  "wins.signInRequired": "برای مشاهده‌ی جوایز، ابتدا وارد حساب کاربری خود شوید.",
  "wins.copied": "کپی شد",
  "wins.copyFailed": "کپی ناموفق بود",
  "wins.copy": "کپی",
  "wins.pendingManual": "در انتظار تحویل دستی: {error}",
  "wins.pendingAuto": "جایزه‌ی شما به‌زودی توسط تیم پشتیبانی تحویل داده می‌شود.",
  "wins.walletCredited": "مبلغ {amount} تومان به کیف پول شما واریز شد.",
  "wins.couponTitle": "کد تخفیف شما",
  "wins.claimTitle": "اطلاعات دریافت جایزه",
  "wins.position": "نفر {n}",
  "wins.empty": "هنوز در هیچ قرعه‌کشی‌ای برنده نشده‌اید",
  "wins.emptyDesc": "در قرعه‌کشی‌های فعال شرکت کنید تا شانس بردن جوایز را داشته باشید.",
  "wins.emptyAction": "مشاهده قرعه‌کشی‌های فعال",
}

const en: Catalog = {
  "nav.home": "Home",
  "nav.auctions": "Auctions",
  "nav.flash": "Flash Sale",
  "nav.wallet": "Wallet",
  "nav.orders": "Orders",
  "nav.giveaways": "Giveaways",
  "giveaways.title": "Giveaways",
  "giveaways.subtitle": "Join the channels, enter the giveaway, and win",
  "common.toman": "Toman",
  "common.viewAll": "View all",
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.done": "Done",
  "common.continue": "Continue",
  "common.vip": "VIP Member",
  "lang.selectTitle": "Select your language",
  "trust.secure": "Secure & Safe",
  "trust.fast": "Fast & Easy",
  "trust.support": "24/7 Support",
  "tour.skip": "Skip",
  "tour.step": "Step {n} of {total}",
  "tour.next": "Next",
  "tour.start": "Let's go",
  "tour.s1.title": "Welcome to the store",
  "tour.s1.body": "Browse digital products, accounts and keys. Everything is neatly organized.",
  "tour.s2.title": "Top up your balance",
  "tour.s2.body": "Add funds via wallet, crypto or gateway and check out faster.",
  "tour.s3.title": "Buy a product",
  "tour.s3.body": "Tap any product to see details and pay. Instant delivery happens right here.",
  "tour.s4.title": "Join the auctions",
  "tour.s4.body": "Bid on special products and win at the best price — a unique feature.",
  "tour.s5.title": "Never miss anything",
  "tour.s5.body": "Get alerts for restocks and giveaways and always stay one step ahead.",
  "success.title": "Everything's ready!",
  "success.body": "All set. Enjoy the store — top up, buy, done.",
  "success.start": "Start shopping",
  "tier.standard": "Standard",
  "tier.bronze": "Bronze",
  "tier.silver": "Silver",
  "tier.gold": "Gold",
  "tier.diamond": "Diamond",
  "tier.vip": "VIP",
  "membership.title": "Membership tier",
  "membership.discount": "{n}% off products",
  "membership.vipExclusive": "Exclusive VIP membership",
  "home.welcome": "Welcome",
  "home.balance": "Available balance",
  "home.topup": "Top up wallet",
  "home.quickActions": "Quick access",
  "home.liveAuctions": "Live auctions",
  "home.flashSales": "Flash sales",
  "home.noAuctions": "No active auctions.",
  "home.noFlash": "No active flash sales.",
  "wallet.title": "Wallet",
  "wallet.available": "Available balance",
  "wallet.total": "Total balance",
  "wallet.frozen": "Frozen in auctions",
  "wallet.transactions": "Transactions",
  "wallet.noTransactions": "No transactions yet.",
  "wallet.topup": "Top up",
  "wallet.withdraw": "Withdraw",
  "auctions.title": "Auctions",
  "auctions.subtitle": "Bid on digital products; your bid is frozen until the auction ends.",
  "auctions.empty": "No auctions found.",
  "auctions.live": "Live",
  "auctions.scheduled": "Scheduled",
  "auctions.ended": "Ended",
  "auctions.currentBid": "Top bid",
  "auctions.startsAt": "Starts",
  "flash.title": "Flash Sale",
  "flash.subtitle": "Instant fixed-price purchase; products are auto-delivered right after payment.",
  "flash.empty": "No active flash sales.",
  "detail.back": "Back to flash sales",
  "detail.description": "Description",
  "detail.tags": "Tags",
  "detail.share": "Share",
  "detail.shareCopied": "Link copied",
  "detail.notFound": "This product was not found or is no longer available.",
  "detail.eachFrom": "Each from",
  "detail.restockNotice": "This product is out of stock. Turn on alerts to be notified when it is back.",
  "search.placeholder": "Search products…",
  "search.all": "All",
  "search.noResults": "No results found for your search.",
  "sort.label": "Sort",
  "sort.newest": "Newest",
  "sort.priceAsc": "Cheapest",
  "sort.priceDesc": "Priciest",
  "sort.popular": "Best selling",
  "reviews.title": "Reviews & ratings",
  "reviews.empty": "No reviews yet. Be the first!",
  "reviews.write": "Write a review",
  "reviews.edit": "Edit your review",
  "reviews.yourRating": "Your rating",
  "reviews.commentPlaceholder": "Share your experience (optional)…",
  "reviews.submit": "Submit",
  "reviews.delete": "Delete review",
  "reviews.mustBuy": "Only buyers of this product can leave a review.",
  "reviews.you": "You",
  "reviews.thanks": "Thanks for your review!",
  "reviews.ratingsCount": "reviews",
  "flash.buy": "Buy",
  "flash.soldOut": "Sold out",
  "flash.stock": "Stock",
  "flash.sold": "Sold",
  "flash.autoDelivery": "Auto delivery",
  "flash.manualDelivery": "Manual delivery",
  "buy.quantity": "Quantity",
  "buy.unitPrice": "Unit price",
  "buy.total": "Total",
  "buy.selectPayment": "Select payment method",
  "buy.payWallet": "Pay with wallet",
  "buy.comingSoon": "Coming soon",
  "buy.insufficient": "Insufficient wallet balance.",
  "buy.confirm": "Confirm & pay",
  "buy.success": "Purchase successful",
  "buy.deliveryInfo": "Delivery info (auto-delivery):",
  "buy.pendingManual": "Your order is placed and awaiting manual delivery. Track it from Orders.",
  "buy.loginFirst": "Select an account first",
  "buy.bulkHint": "Bulk discount",
  "buy.subtotal": "Subtotal",
  "coupon.placeholder": "Discount code",
  "coupon.apply": "Apply",
  "coupon.applied": "Coupon applied",
  "coupon.remove": "Remove",
  "coupon.discount": "Discount",
  "coupon.invalid": "Invalid discount code.",
  "coupon.expired": "This coupon has expired.",
  "coupon.notStarted": "This coupon is not active yet.",
  "coupon.minOrder": "Order total is too low for this coupon.",
  "coupon.exhausted": "This coupon has reached its usage limit.",
  "coupon.userLimit": "You have already used this coupon.",
  "orders.title": "My orders",
  "orders.empty": "You have no orders yet.",
  "orders.quantity": "Qty",
  "watchlist.title": "Watchlist",
  "watchlist.subtitle": "Auctions you follow; you'll be notified when each one starts.",
  "watchlist.empty": "You're not following any auctions yet.",
  "watchlist.browse": "Browse auctions",
  "lang.choose": "Choose language",
  "auth.tagline": "Sign in with your Telegram account to continue",
  "auth.telegramBtn": "Log in with Telegram",
  "auth.secureNote": "Secure login via Telegram",
  "auth.privacyTitle": "Privacy & security",
  "auth.privacy1": "Uses official Telegram Login — we never touch your account or password",
  "auth.privacy2": "We only read your name, username and profile picture",
  "auth.privacy3": "Your messages and chats are completely inaccessible to us",
  "auth.privacy4": "Telegram verifies the login on their end before we receive anything",
  "auth.or": "or",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.displayName": "Display name (optional)",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.toSignUp": "No account? Sign up",
  "auth.toSignIn": "Have an account? Sign in",
  "auth.signingIn": "Signing in…",
  "auth.widgetMissing": "Telegram login isn't configured yet. Please sign in with email.",
  "auth.logout": "Log out",
  "profile.title": "My profile",
  "profile.account": "Account",
  "profile.telegram": "Telegram",
  "profile.email": "Email",
  "profile.role": "Role",
  "profile.notLinked": "Not linked",
  "profile.language": "Language",
  "join.title": "Members only",
  "join.subtitle": "To use {brand}, tap each channel and join; the green tick lights up when you return.",
  "join.notJoined": "Not joined yet — try again",
  "join.verified": "Membership verified",
  "join.enter": "Enter the app",
  "join.checkMe": "I joined, check me",
  "join.checking": "Checking…",
  "join.confirmed": "Verified",
  "join.retry": "Check again",
  "join.failed": "Not all channels were verified. Join first, then check again.",
  "wallet.signInRequired": "Sign in to view your wallet.",
  "wallet.topupDemo": "Top up wallet (demo)",
  "wallet.amountPlaceholder": "Amount in Toman",
  "wallet.charge": "Top up",
  "wallet.demoNote": "In the live version, top-ups are done via card transfer and admin approval.",
  "wallet.minTopup": "The minimum top-up amount is 10,000 Toman",
  "wallet.topupSuccess": "Wallet topped up",
  "wallet.topupError": "Failed to top up wallet",
  "wallet.rewardsTitle": "Rewards club & points",
  "wallet.rewardsSubtitle": "See your membership tier, missions and achievements",
  "notif.title": "Notifications",
  "notif.subtitle": "Your latest account events: product restocks, orders, auctions and transactions.",
  "notif.signInRequired": "Sign in to view your notifications.",
  "orders.signInRequired": "Sign in to view your orders.",
  "orders.emptyDesc": "Visit the flash sale and make your first purchase.",
  "orders.emptyAction": "Browse flash sale",
  "orders.codeLabel": "Order code",
  "orders.deliveryInfo": "Delivery info:",
  "orders.refundedNote": "Delivery failed and the amount was automatically refunded to your wallet.",
  "status.pending": "Pending",
  "status.paid": "Paid",
  "status.delivered": "Delivered",
  "status.completed": "Completed",
  "status.failed": "Failed",
  "status.refunded": "Refunded",
  "status.cancelled": "Cancelled",
  "payload.username": "Username",
  "payload.password": "Password",
  "payload.email": "Email",
  "payload.licenseKey": "License key",
  "payload.code": "Code",
  "payload.note": "Note",
  "payload.url": "Link",
  "account.title": "Account & security settings",
  "account.subtitle": "Manage your login methods and account security",
  "account.activeMethods": "Active login methods",
  "account.noMethods": "No full login method is active yet. To secure your account, verify your email or link Telegram.",
  "account.logoutAll": "Log out of all devices",
  "account.logoutAllDesc": "This invalidates all active sessions on other devices and you'll need to sign in again.",
  "account.logoutAllError": "Failed to log out of all devices",
  "account.methodTelegram": "Telegram",
  "account.methodPassword": "Email & password",
  "auctions.emptyDesc": "No active auctions are running right now. Check back later.",
  "auctions.finalized": "Finalized",
  "auctions.cancelled": "Cancelled",
  "giveaways.myWins": "My prizes",
  "giveaways.empty": "No active giveaways right now",
  "giveaways.emptyDesc": "New giveaways are coming soon. Stay tuned!",
  "giveaways.past": "Past giveaways",
  "giveaways.all": "All giveaways",
  "giveaways.notFound": "Giveaway not found",
  "adetail.back": "Back to auctions",
  "adetail.bids": "{n} bids",
  "adetail.bidHistory": "Bid history",
  "adetail.noBids": "No bids yet. Be the first to place one.",
  "adetail.auto": "auto",
  "adetail.topBidNow": "Current top bid",
  "adetail.basePrice": "Starting price",
  "adetail.startsIn": "Starts in",
  "adetail.endsIn": "Ends in",
  "adetail.reserveMet": "The seller's reserve price has been met",
  "adetail.reserveNotMet": "The reserve price has not been met yet",
  "adetail.minIncrement": "Min. increment",
  "adetail.winnersCount": "Winners",
  "adetail.endTime": "End time",
  "wins.signInRequired": "Sign in to view your prizes.",
  "wins.copied": "Copied",
  "wins.copyFailed": "Copy failed",
  "wins.copy": "Copy",
  "wins.pendingManual": "Awaiting manual delivery: {error}",
  "wins.pendingAuto": "Your prize will be delivered shortly by the support team.",
  "wins.walletCredited": "{amount} Toman was credited to your wallet.",
  "wins.couponTitle": "Your discount code",
  "wins.claimTitle": "Prize claim details",
  "wins.position": "Place {n}",
  "wins.empty": "You haven't won any giveaway yet",
  "wins.emptyDesc": "Enter active giveaways for a chance to win prizes.",
  "wins.emptyAction": "View active giveaways",
}

const ru: Catalog = {
  "nav.home": "Главная",
  "nav.auctions": "Аукционы",
  "nav.flash": "Распродажа",
  "nav.wallet": "Кошелёк",
  "nav.orders": "Заказы",
  "nav.giveaways": "Розыгрыши",
  "giveaways.title": "Розыгрыши",
  "giveaways.subtitle": "Подпишитесь на каналы, участвуйте в розыгрыше и выигрывайте",
  "common.toman": "Туман",
  "common.viewAll": "Все",
  "common.loading": "Загрузка…",
  "common.back": "Назад",
  "common.cancel": "Отмена",
  "common.done": "Готово",
  "common.continue": "Продолжить",
  "common.vip": "VIP-участник",
  "lang.selectTitle": "Выберите язык",
  "trust.secure": "Безопасно и надёжно",
  "trust.fast": "Быстро и просто",
  "trust.support": "Поддержка 24/7",
  "tour.skip": "Пропустить",
  "tour.step": "Шаг {n} из {total}",
  "tour.next": "Далее",
  "tour.start": "Поехали",
  "tour.s1.title": "Добро пожаловать в магазин",
  "tour.s1.body": "Просматривайте цифровые товары, аккаунты и ключи. Всё аккуратно разложено.",
  "tour.s2.title": "Пополните баланс",
  "tour.s2.body": "Пополняйте кошельком, криптой или через шлюз и покупайте быстрее.",
  "tour.s3.title": "Купите товар",
  "tour.s3.body": "Нажмите на товар, чтобы увидеть детали и оплатить. Доставка мгновенная.",
  "tour.s4.title": "Участвуйте в аукционах",
  "tour.s4.body": "Делайте ставки на особые товары и выигрывайте по лучшей цене — уникальная возможность.",
  "tour.s5.title": "Ничего не пропустите",
  "tour.s5.body": "Получайте уведомления о пополнениях и розыгрышах и будьте на шаг впереди.",
  "success.title": "Всё готово!",
  "success.body": "Готово. Наслаждайтесь магазином — пополняйте, покупайте, готово.",
  "success.start": "Начать покупки",
  "tier.standard": "Стандарт",
  "tier.bronze": "Бронза",
  "tier.silver": "Серебро",
  "tier.gold": "Золото",
  "tier.diamond": "Бриллиант",
  "tier.vip": "VIP",
  "membership.title": "Уровень членства",
  "membership.discount": "Скидка {n}% на товары",
  "membership.vipExclusive": "Эксклюзивное VIP-членство",
  "home.welcome": "Добро пожаловать",
  "home.balance": "Доступный баланс",
  "home.topup": "Пополнить кошелёк",
  "home.quickActions": "Быстрый доступ",
  "home.liveAuctions": "Активные аукционы",
  "home.flashSales": "Распродажи",
  "home.noAuctions": "Нет активных аукцио��ов.",
  "home.noFlash": "Нет активных распродаж.",
  "wallet.title": "Кошелёк",
  "wallet.available": "Доступный баланс",
  "wallet.total": "Общий баланс",
  "wallet.frozen": "Заморожено в аукционах",
  "wallet.transactions": "Транзакции",
  "wallet.noTransactions": "Транзакций пока нет.",
  "wallet.topup": "Пополнить",
  "wallet.withdraw": "Вывести",
  "auctions.title": "Аукционы",
  "auctions.subtitle": "Делайте ставки на цифровые товары; ставка заморожена до конца аукциона.",
  "auctions.empty": "Аукционы не найдены.",
  "auctions.live": "В эфире",
  "auctions.scheduled": "Запланирован",
  "auctions.ended": "Завершён",
  "auctions.currentBid": "Высшая ставка",
  "auctions.startsAt": "Начало",
  "flash.title": "Распродажа",
  "flash.subtitle": "Мгновенная покупка по фиксированной цене; товары доставляются сразу после оплаты.",
  "flash.empty": "Нет активных распродаж.",
  "detail.back": "Назад к распродажам",
  "detail.description": "Описание",
  "detail.tags": "Теги",
  "detail.share": "Поделиться",
  "detail.shareCopied": "Ссылка скопирована",
  "detail.notFound": "Товар не найден или больше недоступен.",
  "detail.eachFrom": "За единицу от",
  "detail.restockNotice": "Товара нет в наличии. Включите уведомления, чтобы узнать о поступлении.",
  "search.placeholder": "Поиск товаров…",
  "search.all": "Все",
  "search.noResults": "По вашему запросу ничего не найдено.",
  "sort.label": "Сортировка",
  "sort.newest": "Новые",
  "sort.priceAsc": "Дешевле",
  "sort.priceDesc": "Дороже",
  "sort.popular": "Популярные",
  "reviews.title": "Отзывы и оценки",
  "reviews.empty": "Отзывов пока нет. Будьте первым!",
  "reviews.write": "Написать отзыв",
  "reviews.edit": "Изменить отзыв",
  "reviews.yourRating": "Ваша оценка",
  "reviews.commentPlaceholder": "Поделитесь впечатлением (необязательно)…",
  "reviews.submit": "Отправить",
  "reviews.delete": "Удалить отзыв",
  "reviews.mustBuy": "Оставить отзыв могут только покупатели этого товара.",
  "reviews.you": "Вы",
  "reviews.thanks": "Спасибо за ваш отзыв!",
  "reviews.ratingsCount": "отзывов",
  "flash.buy": "Купить",
  "flash.soldOut": "Распродано",
  "flash.stock": "В наличии",
  "flash.sold": "Продано",
  "flash.autoDelivery": "Авто-доставка",
  "flash.manualDelivery": "Ручная доставка",
  "buy.quantity": "Количество",
  "buy.unitPrice": "Цена за единицу",
  "buy.total": "Итого",
  "buy.selectPayment": "Выберите способ оплаты",
  "buy.payWallet": "Оплатить кошельком",
  "buy.comingSoon": "Скоро",
  "buy.insufficient": "Недостаточно средств на кошельке.",
  "buy.confirm": "Подтвердить и оплатить",
  "buy.success": "Покупка успешна",
  "buy.deliveryInfo": "Информация о доставке (авто):",
  "buy.pendingManual": "Заказ оформлен и ожидает ручной доставки. Отслеживайте его в разделе «Заказы».",
  "buy.loginFirst": "Сначала выберите аккаунт",
  "buy.bulkHint": "Оптовая скидка",
  "buy.subtotal": "Подытог",
  "coupon.placeholder": "Промокод",
  "coupon.apply": "Применить",
  "coupon.applied": "Промокод применён",
  "coupon.remove": "Убрать",
  "coupon.discount": "Скидка",
  "coupon.invalid": "Недействительный промокод.",
  "coupon.expired": "Срок действия промокода истёк.",
  "coupon.notStarted": "Промокод ещё не активен.",
  "coupon.minOrder": "Сумма заказа слишком мала для этого промокода.",
  "coupon.exhausted": "Лимит использования промокода исчерпан.",
  "coupon.userLimit": "Вы уже использовали этот промокод.",
  "orders.title": "Мои заказы",
  "orders.empty": "У вас пока нет заказов.",
  "orders.quantity": "Кол-во",
  "watchlist.title": "Избранное",
  "watchlist.subtitle": "Аукционы, за которыми вы следите; мы уведомим вас о старте.",
  "watchlist.empty": "Вы пока не следите за аукционами.",
  "watchlist.browse": "Смотреть аукционы",
  "lang.choose": "Выбор языка",
  "auth.tagline": "Войдите через аккаунт Telegram, чтобы продолжить",
  "auth.telegramBtn": "Войти через Telegram",
  "auth.secureNote": "Безопасный вход через Telegram",
  "auth.privacyTitle": "Конфиденциальность и безопасность",
  "auth.privacy1": "Используется официальный вход Telegram — мы не касаемся вашего аккаунта или пароля",
  "auth.privacy2": "Мы читаем только ваше имя, username и фото профиля",
  "auth.privacy3": "Ваши сообщения и чаты полностью недоступны нам",
  "auth.privacy4": "Telegram проверяет вход на своей стороне до того, как мы что-либо получим",
  "auth.or": "или",
  "auth.email": "Эл. почта",
  "auth.password": "Пароль",
  "auth.displayName": "Отображаемое имя (необязательно)",
  "auth.signIn": "Войти",
  "auth.signUp": "Регистрация",
  "auth.toSignUp": "Нет аккаунта? Зарегистрируйтесь",
  "auth.toSignIn": "Есть аккаунт? Войдите",
  "auth.signingIn": "Вход…",
  "auth.widgetMissing": "Вход через Telegram ещё не настроен. Войдите по эл. почте.",
  "auth.logout": "Выйти",
  "profile.title": "Мой профиль",
  "profile.account": "Аккаунт",
  "profile.telegram": "Telegram",
  "profile.email": "Эл. почта",
  "profile.role": "Роль",
  "profile.notLinked": "Не привязан",
  "profile.language": "Язык",
  "join.title": "Только для участников",
  "join.subtitle": "Чтобы пользоваться {brand}, нажмите на каждый канал и подпишитесь; при возврате загорится зелёная галочка.",
  "join.notJoined": "Ещё не подписаны — попробуйте снова",
  "join.verified": "Подписка подтверждена",
  "join.enter": "Войти в приложение",
  "join.checkMe": "Я подписался, проверьте",
  "join.checking": "Проверка…",
  "join.confirmed": "Подтверждено",
  "join.retry": "Проверить снова",
  "join.failed": "Не все каналы подтверждены. Сначала подпишитесь, затем проверьте снова.",
  "wallet.signInRequired": "Войдите, чтобы увидеть кошелёк.",
  "wallet.topupDemo": "Пополнить кошелёк (демо)",
  "wallet.amountPlaceholder": "Сумма в туманах",
  "wallet.charge": "Пополнить",
  "wallet.demoNote": "В реальной версии пополнение выполняется переводом по карте с подтверждением администратора.",
  "wallet.minTopup": "Минимальная сумма пополнения — 10 000 туманов",
  "wallet.topupSuccess": "Кошелёк пополнен",
  "wallet.topupError": "Не удалось пополнить кошелёк",
  "wallet.rewardsTitle": "Клуб лояльности и баллы",
  "wallet.rewardsSubtitle": "Посмотрите свой уровень, задания и достижения",
  "notif.title": "Уведомления",
  "notif.subtitle": "Последние события вашего аккаунта: пополнения товаров, заказы, аукционы и транзакции.",
  "notif.signInRequired": "Войдите, чтобы увидеть уведомления.",
  "orders.signInRequired": "Войдите, чтобы увидеть заказы.",
  "orders.emptyDesc": "Загляните в распродажу и сделайте первую покупку.",
  "orders.emptyAction": "К распродаже",
  "orders.codeLabel": "Код заказа",
  "orders.deliveryInfo": "Информация о доставке:",
  "orders.refundedNote": "Доставка не удалась, и сумма автоматически возвращена в ваш кошелёк.",
  "status.pending": "В ожидании",
  "status.paid": "Оплачено",
  "status.delivered": "Доставлено",
  "status.completed": "Завершено",
  "status.failed": "Не удалось",
  "status.refunded": "Возвращено",
  "status.cancelled": "Отменено",
  "payload.username": "Имя пользователя",
  "payload.password": "Пароль",
  "payload.email": "Эл. почта",
  "payload.licenseKey": "Лицензионный ключ",
  "payload.code": "Код",
  "payload.note": "Примечание",
  "payload.url": "Ссылка",
  "account.title": "Настройки аккаунта и безопасности",
  "account.subtitle": "Управляйте способами входа и безопасностью аккаунта",
  "account.activeMethods": "Активные способы входа",
  "account.noMethods": "Пока нет ни одного полного способа входа. Чтобы защитить аккаунт, подтвердите эл. почту или подключите Telegram.",
  "account.logoutAll": "Выйти на всех устройствах",
  "account.logoutAllDesc": "Это завершит все активные сессии на других устройствах, и вам нужно будет войти заново.",
  "account.logoutAllError": "Не удалось выйти на всех устройствах",
  "account.methodTelegram": "Telegram",
  "account.methodPassword": "Эл. почта и пароль",
  "auctions.emptyDesc": "Сейчас нет активных аукционов. Загляните позже.",
  "auctions.finalized": "Завершён",
  "auctions.cancelled": "Отменён",
  "giveaways.myWins": "Мои призы",
  "giveaways.empty": "Сейчас нет активных розыгрышей",
  "giveaways.emptyDesc": "Новые розыгрыши скоро появятся. Следите за обновлениями!",
  "giveaways.past": "Прошедшие розыгрыши",
  "giveaways.all": "Все розыгрыши",
  "giveaways.notFound": "Розыгрыш не найден",
  "adetail.back": "Назад к аукционам",
  "adetail.bids": "Ставок: {n}",
  "adetail.bidHistory": "История ставок",
  "adetail.noBids": "Ставок пока нет. Сделайте первую.",
  "adetail.auto": "авто",
  "adetail.topBidNow": "Текущая высшая ставка",
  "adetail.basePrice": "Стартовая цена",
  "adetail.startsIn": "Начало через",
  "adetail.endsIn": "Окончание через",
  "adetail.reserveMet": "Резервная цена продавца достигнута",
  "adetail.reserveNotMet": "Резервная цена ещё не достигнута",
  "adetail.minIncrement": "Мин. шаг",
  "adetail.winnersCount": "Победителей",
  "adetail.endTime": "Время окончания",
  "wins.signInRequired": "Войдите, чтобы увидеть свои призы.",
  "wins.copied": "Скопировано",
  "wins.copyFailed": "Не удалось скопировать",
  "wins.copy": "Копировать",
  "wins.pendingManual": "Ожидает ручной выдачи: {error}",
  "wins.pendingAuto": "Ваш приз скоро будет выдан командой поддержки.",
  "wins.walletCredited": "{amount} туманов зачислено на ваш кошелёк.",
  "wins.couponTitle": "Ваш промокод",
  "wins.claimTitle": "Данные для получения приза",
  "wins.position": "Место {n}",
  "wins.empty": "Вы ещё не выиграли ни одного розыгрыша",
  "wins.emptyDesc": "Участвуйте в активных розыгрышах ради шанса на приз.",
  "wins.emptyAction": "Смотреть активные розыгрыши",
}

// Roman Hindi (Romanized Hindi) — conversational, Latin script (not Devanagari).
const hi: Catalog = {
  "nav.home": "Home",
  "nav.auctions": "Nilami",
  "nav.flash": "Flash Sale",
  "nav.wallet": "Wallet",
  "nav.orders": "Orders",
  "nav.giveaways": "Giveaway",
  "giveaways.title": "Giveaways",
  "giveaways.subtitle": "Channels join karein, giveaway mein hissa lein aur jeetein",
  "common.toman": "Toman",
  "common.viewAll": "Sabhi dekhein",
  "common.loading": "Load ho raha hai…",
  "common.back": "Wapas",
  "common.cancel": "Cancel karein",
  "common.done": "Ho gaya",
  "common.continue": "Aage badhein",
  "common.vip": "VIP Member",
  "lang.selectTitle": "Apni bhasha chunein",
  "trust.secure": "Surakshit aur safe",
  "trust.fast": "Tez aur aasaan",
  "trust.support": "24/7 Support",
  "tour.skip": "Skip karein",
  "tour.step": "Step {n} / {total}",
  "tour.next": "Aage",
  "tour.start": "Chalo shuru karein",
  "tour.s1.title": "Store mein swagat hai",
  "tour.s1.body": "Digital products, accounts aur keys browse karein. Sab kuch neatly organized hai.",
  "tour.s2.title": "Apna balance top up karein",
  "tour.s2.body": "Wallet, crypto ya gateway se funds add karein aur tezi se kharidein.",
  "tour.s3.title": "Product kharidein",
  "tour.s3.body": "Kisi bhi product par tap karke details dekhein aur pay karein. Instant delivery yahin hoti hai.",
  "tour.s4.title": "Nilami mein hissa lein",
  "tour.s4.body": "Special products par boli lagayein aur best price par jeetein — ek unique feature.",
  "tour.s5.title": "Kuch bhi miss na karein",
  "tour.s5.body": "Restock aur giveaways ke alerts paayein aur hamesha ek step aage rahein.",
  "success.title": "Sab kuch taiyaar hai!",
  "success.body": "Ho gaya. Store ka mazaa lein — top up karein, kharidein, done.",
  "success.start": "Shopping shuru karein",
  "tier.standard": "Standard",
  "tier.bronze": "Bronze",
  "tier.silver": "Silver",
  "tier.gold": "Gold",
  "tier.diamond": "Diamond",
  "tier.vip": "VIP",
  "membership.title": "Membership level",
  "membership.discount": "Products par {n}% ki chhoot",
  "membership.vipExclusive": "Exclusive VIP membership",
  "home.welcome": "Swagat hai",
  "home.balance": "Available balance",
  "home.topup": "Wallet top up karein",
  "home.quickActions": "Quick access",
  "home.liveAuctions": "Live nilami",
  "home.flashSales": "Flash sale",
  "home.noAuctions": "Koi active nilami nahi hai.",
  "home.noFlash": "Koi active flash sale nahi hai.",
  "wallet.title": "Wallet",
  "wallet.available": "Available balance",
  "wallet.total": "Total balance",
  "wallet.frozen": "Nilami mein frozen",
  "wallet.transactions": "Transactions",
  "wallet.noTransactions": "Abhi koi transaction nahi hai.",
  "wallet.topup": "Top up",
  "wallet.withdraw": "Withdraw",
  "auctions.title": "Nilami",
  "auctions.subtitle": "Digital products par boli lagayein; boli nilami khatam hone tak frozen rehti hai.",
  "auctions.empty": "Koi nilami nahi mili.",
  "auctions.live": "Live",
  "auctions.scheduled": "Scheduled",
  "auctions.ended": "Khatam",
  "auctions.currentBid": "Top boli",
  "auctions.startsAt": "Shuru",
  "flash.title": "Flash Sale",
  "flash.subtitle": "Fixed price par turant kharidein; payment ke turant baad products auto-deliver ho jaate hain.",
  "flash.empty": "Koi active flash sale nahi hai.",
  "detail.back": "Flash sale par wapas",
  "detail.description": "Vivaran",
  "detail.tags": "Tags",
  "detail.share": "Share karein",
  "detail.shareCopied": "Link copy ho gaya",
  "detail.notFound": "Yeh product nahi mila ya ab available nahi hai.",
  "detail.eachFrom": "Per unit se",
  "detail.restockNotice": "Yeh product stock mein nahi hai. Wapas aane par notify hone ke liye alert on karein.",
  "search.placeholder": "Products khojein…",
  "search.all": "Sabhi",
  "search.noResults": "Aapki search ke liye koi result nahi mila.",
  "sort.label": "Sort karein",
  "sort.newest": "Newest",
  "sort.priceAsc": "Sabse sasta",
  "sort.priceDesc": "Sabse mehenga",
  "sort.popular": "Sabse zyada bikne wala",
  "reviews.title": "Reviews aur ratings",
  "reviews.empty": "Abhi koi review nahi. Pehle banein!",
  "reviews.write": "Review likhein",
  "reviews.edit": "Apni review edit karein",
  "reviews.yourRating": "Aapki rating",
  "reviews.commentPlaceholder": "Apna experience share karein (optional)…",
  "reviews.submit": "Submit karein",
  "reviews.delete": "Review delete karein",
  "reviews.mustBuy": "Sirf is product ke buyers hi review kar sakte hain.",
  "reviews.you": "Aap",
  "reviews.thanks": "Aapki review ke liye dhanyavaad!",
  "reviews.ratingsCount": "reviews",
  "flash.buy": "Kharidein",
  "flash.soldOut": "Sold out",
  "flash.stock": "Stock",
  "flash.sold": "Bike",
  "flash.autoDelivery": "Auto delivery",
  "flash.manualDelivery": "Manual delivery",
  "buy.quantity": "Quantity",
  "buy.unitPrice": "Per unit price",
  "buy.total": "Total",
  "buy.selectPayment": "Payment method chunein",
  "buy.payWallet": "Wallet se pay karein",
  "buy.comingSoon": "Jald aa raha hai",
  "buy.insufficient": "Wallet mein paryapt balance nahi hai.",
  "buy.confirm": "Confirm karein aur pay karein",
  "buy.success": "Khareed safal",
  "buy.deliveryInfo": "Delivery info (auto):",
  "buy.pendingManual": "Aapka order place ho gaya hai aur manual delivery ka intezaar hai. Orders section mein track karein.",
  "buy.loginFirst": "Pehle ek account chunein",
  "buy.bulkHint": "Bulk discount",
  "buy.subtotal": "Subtotal",
  "coupon.placeholder": "Discount code",
  "coupon.apply": "Apply karein",
  "coupon.applied": "Coupon apply ho gaya",
  "coupon.remove": "Hatayein",
  "coupon.discount": "Discount",
  "coupon.invalid": "Invalid discount code.",
  "coupon.expired": "Yeh coupon expire ho chuka hai.",
  "coupon.notStarted": "Yeh coupon abhi active nahi hai.",
  "coupon.minOrder": "Is coupon ke liye order amount bahut kam hai.",
  "coupon.exhausted": "Is coupon ki usage limit poori ho gayi hai.",
  "coupon.userLimit": "Aap is coupon ka pehle hi use kar chuke hain.",
  "orders.title": "Mere orders",
  "orders.empty": "Abhi aapka koi order nahi hai.",
  "orders.quantity": "Qty",
  "watchlist.title": "Watchlist",
  "watchlist.subtitle": "Jin nilamiyon ko aap follow karte hain; shuru hone par notify karenge.",
  "watchlist.empty": "Aap abhi kisi nilami ko follow nahi kar rahe.",
  "watchlist.browse": "Nilami dekhein",
  "lang.choose": "Bhasha chunein",
  "auth.tagline": "Jaari rakhne ke liye apne Telegram account se sign in karein",
  "auth.telegramBtn": "Telegram se log in karein",
  "auth.secureNote": "Telegram ke zariye secure login",
  "auth.privacyTitle": "Privacy aur security",
  "auth.privacy1": "Official Telegram login — hum aapke account ya password ko kabhi nahi chhoote",
  "auth.privacy2": "Hum sirf aapka naam, username aur profile photo padhte hain",
  "auth.privacy3": "Aapke messages aur chats hamare liye poori tarah inaccessible hain",
  "auth.privacy4": "Kuch bhi receive karne se pehle Telegram apne end par login verify karta hai",
  "auth.or": "ya",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.displayName": "Display name (optional)",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.toSignUp": "Account nahi hai? Sign up karein",
  "auth.toSignIn": "Account hai? Sign in karein",
  "auth.signingIn": "Sign in ho raha hai…",
  "auth.widgetMissing": "Telegram login abhi configure nahi hai. Kripya email se sign in karein.",
  "auth.logout": "Log out",
  "profile.title": "Meri profile",
  "profile.account": "Account",
  "profile.telegram": "Telegram",
  "profile.email": "Email",
  "profile.role": "Role",
  "profile.notLinked": "Link nahi hai",
  "profile.language": "Bhasha",
  "join.title": "Sirf members ke liye",
  "join.subtitle": "{brand} use karne ke liye har channel par tap karke join karein; wapas aane par green tick on ho jaayega.",
  "join.notJoined": "Abhi join nahi kiya — phir se try karein",
  "join.verified": "Membership verify ho gayi",
  "join.enter": "App mein jaayein",
  "join.checkMe": "Maine join kar liya, check karein",
  "join.checking": "Check ho raha hai…",
  "join.confirmed": "Verified",
  "join.retry": "Phir se check karein",
  "join.failed": "Sabhi channels verify nahi hue. Pehle join karein, phir se check karein.",
  "wallet.signInRequired": "Wallet dekhne ke liye sign in karein.",
  "wallet.topupDemo": "Wallet top up karein (demo)",
  "wallet.amountPlaceholder": "Toman mein amount",
  "wallet.charge": "Top up",
  "wallet.demoNote": "Live version mein top-up card transfer aur admin approval se hota hai.",
  "wallet.minTopup": "Minimum top-up amount 10,000 Toman hai",
  "wallet.topupSuccess": "Wallet top up ho gaya",
  "wallet.topupError": "Wallet top up nahi ho saka",
  "wallet.rewardsTitle": "Rewards club aur points",
  "wallet.rewardsSubtitle": "Apna membership tier, missions aur achievements dekhein",
  "notif.title": "Notifications",
  "notif.subtitle": "Aapke account ke latest events: product restock, orders, auctions aur transactions.",
  "notif.signInRequired": "Notifications dekhne ke liye sign in karein.",
  "orders.signInRequired": "Orders dekhne ke liye sign in karein.",
  "orders.emptyDesc": "Flash sale dekhein aur apni pehli purchase karein.",
  "orders.emptyAction": "Flash sale dekhein",
  "orders.codeLabel": "Order code",
  "orders.deliveryInfo": "Delivery info:",
  "orders.refundedNote": "Delivery fail ho gayi aur amount apne aap aapke wallet mein refund ho gaya.",
  "status.pending": "Pending",
  "status.paid": "Paid",
  "status.delivered": "Delivered",
  "status.completed": "Completed",
  "status.failed": "Fail",
  "status.refunded": "Refunded",
  "status.cancelled": "Cancelled",
  "payload.username": "Username",
  "payload.password": "Password",
  "payload.email": "Email",
  "payload.licenseKey": "License key",
  "payload.code": "Code",
  "payload.note": "Note",
  "payload.url": "Link",
  "account.title": "Account aur security settings",
  "account.subtitle": "Apne login methods aur account security manage karein",
  "account.activeMethods": "Active login methods",
  "account.noMethods": "Abhi koi poora login method active nahi hai. Account secure karne ke liye apna email verify karein ya Telegram link karein.",
  "account.logoutAll": "Sabhi devices se logout karein",
  "account.logoutAllDesc": "Isse doosre devices ki sabhi active sessions band ho jaayengi aur aapko dobara sign in karna hoga.",
  "account.logoutAllError": "Sabhi devices se logout nahi ho saka",
  "account.methodTelegram": "Telegram",
  "account.methodPassword": "Email aur password",
  "auctions.emptyDesc": "Abhi koi active nilami nahi chal rahi. Baad mein dobara dekhein.",
  "auctions.finalized": "Finalized",
  "auctions.cancelled": "Cancelled",
  "giveaways.myWins": "Mere prizes",
  "giveaways.empty": "Abhi koi active giveaway nahi hai",
  "giveaways.emptyDesc": "Naye giveaways jald aa rahe hain. Bane rahein!",
  "giveaways.past": "Pichhle giveaways",
  "giveaways.all": "Sabhi giveaways",
  "giveaways.notFound": "Giveaway nahi mila",
  "adetail.back": "Nilami par wapas",
  "adetail.bids": "{n} boli",
  "adetail.bidHistory": "Boli history",
  "adetail.noBids": "Abhi koi boli nahi. Pehli boli aap lagayein.",
  "adetail.auto": "auto",
  "adetail.topBidNow": "Current top boli",
  "adetail.basePrice": "Starting price",
  "adetail.startsIn": "Shuru hone mein",
  "adetail.endsIn": "Khatam hone mein",
  "adetail.reserveMet": "Seller ki reserve price poori ho gayi hai",
  "adetail.reserveNotMet": "Reserve price abhi poori nahi hui hai",
  "adetail.minIncrement": "Min. increment",
  "adetail.winnersCount": "Winners",
  "adetail.endTime": "End time",
  "wins.signInRequired": "Apne prizes dekhne ke liye sign in karein.",
  "wins.copied": "Copy ho gaya",
  "wins.copyFailed": "Copy nahi ho saka",
  "wins.copy": "Copy",
  "wins.pendingManual": "Manual delivery ka intezaar: {error}",
  "wins.pendingAuto": "Aapka prize jald hi support team dwara deliver kiya jaayega.",
  "wins.walletCredited": "{amount} Toman aapke wallet mein credit ho gaya.",
  "wins.couponTitle": "Aapka discount code",
  "wins.claimTitle": "Prize claim details",
  "wins.position": "Position {n}",
  "wins.empty": "Aapne abhi tak koi giveaway nahi jeeta",
  "wins.emptyDesc": "Active giveaways mein hissa lein aur prizes jeetne ka mauka paayein.",
  "wins.emptyAction": "Active giveaways dekhein",
}

export const MESSAGES: Record<Locale, Catalog> = { fa, en, ru, hi }

/** Values used to fill `{placeholder}` tokens inside a catalog string. */
export type MessageVars = Record<string, string | number>

/** Replace `{name}` tokens with provided values; unknown tokens are left intact. */
export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] != null ? String(vars[k]) : `{${k}}`))
}

export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const raw = MESSAGES[locale]?.[key] ?? MESSAGES.fa[key] ?? key
  return interpolate(raw, vars)
}
