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
  | "common.vip"
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
  "common.vip": "عضویت ویژه",
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
  "reviews.title": "نظرات و امتیازها",
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
  "common.vip": "VIP Member",
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
  "common.vip": "VIP-участник",
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
  "home.noAuctions": "Нет активных аукционов.",
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
}

const hi: Catalog = {
  "nav.home": "होम",
  "nav.auctions": "नीलामी",
  "nav.flash": "फ्लैश सेल",
  "nav.wallet": "वॉलेट",
  "nav.orders": "ऑर्डर",
  "nav.giveaways": "गिववे",
  "giveaways.title": "गिववे",
  "giveaways.subtitle": "चैनलों से जुड़ें, गिववे में भाग लें और जीतें",
  "common.toman": "तोमान",
  "common.viewAll": "सभी देखें",
  "common.loading": "लोड हो रहा है…",
  "common.back": "वापस",
  "common.cancel": "रद्द करें",
  "common.vip": "VIP सदस्य",
  "tier.standard": "स्टैंडर्ड",
  "tier.bronze": "ब्रॉन्ज़",
  "tier.silver": "सिल्वर",
  "tier.gold": "गोल्ड",
  "tier.diamond": "डायमंड",
  "tier.vip": "VIP",
  "membership.title": "सदस्यता स्तर",
  "membership.discount": "उत्पादों पर {n}% की छूट",
  "membership.vipExclusive": "विशेष VIP सदस्यता",
  "home.welcome": "स्वागत है",
  "home.balance": "उपलब्ध शेष",
  "home.topup": "वॉलेट टॉप अप करें",
  "home.quickActions": "त्वरित पहुँच",
  "home.liveAuctions": "लाइव नीलामी",
  "home.flashSales": "फ्लैश सेल",
  "home.noAuctions": "कोई सक्रिय नीलामी नहीं।",
  "home.noFlash": "कोई सक्रिय फ्लैश सेल नहीं।",
  "wallet.title": "वॉलेट",
  "wallet.available": "उपलब्ध शेष",
  "wallet.total": "कुल शेष",
  "wallet.frozen": "नीलामी में रोका गया",
  "wallet.transactions": "लेन-देन",
  "wallet.noTransactions": "अभी कोई लेन-देन नहीं।",
  "wallet.topup": "टॉप अप",
  "wallet.withdraw": "निकासी",
  "auctions.title": "नीलामी",
  "auctions.subtitle": "डिजिटल उत्पादों पर बोली लगाएँ; बोली नीलामी समाप्त होने तक रोकी जाती है।",
  "auctions.empty": "कोई नीलामी नहीं मिली।",
  "auctions.live": "लाइव",
  "auctions.scheduled": "निर्धारित",
  "auctions.ended": "समाप्त",
  "auctions.currentBid": "शीर्ष बोली",
  "auctions.startsAt": "शुरू",
  "flash.title": "फ्लैश सेल",
  "flash.subtitle": "निश्चित मूल्य पर तुरंत खरीद; भुगतान के तुरंत बाद उत्पाद स्वतः वितरित।",
  "flash.empty": "कोई सक्रिय फ्लैश सेल नहीं।",
  "detail.back": "फ्लैश सेल पर वापस",
  "detail.description": "विवरण",
  "detail.tags": "टैग",
  "detail.share": "साझा करें",
  "detail.shareCopied": "लिंक कॉपी हुआ",
  "detail.notFound": "यह उत्पाद नहीं मिला या अब उपलब्ध नहीं है।",
  "detail.eachFrom": "प्रति इकाई से",
  "detail.restockNotice": "यह उत्पाद स्टॉक में नहीं है। वापस आने पर सूचना पाने के लिए अलर्ट चालू करें।",
  "search.placeholder": "उत्पाद खोजें…",
  "search.all": "सभी",
  "search.noResults": "आपकी खोज के लिए कोई परिणाम नहीं मिला।",
  "sort.label": "क्रमबद्ध करें",
  "sort.newest": "नवीनतम",
  "sort.priceAsc": "सबसे सस्ता",
  "sort.priceDesc": "सबसे महंगा",
  "sort.popular": "सर्वाधिक बिकने वाला",
  "reviews.title": "समीक्षाएँ और रेटिंग",
  "reviews.empty": "अभी कोई समीक्षा नहीं। पहले बनें!",
  "reviews.write": "समीक्षा लिखें",
  "reviews.edit": "अपनी समीक्षा संपादित करें",
  "reviews.yourRating": "आपकी रेटिंग",
  "reviews.commentPlaceholder": "अपना अनुभव साझा करें (वैकल्पिक)…",
  "reviews.submit": "सबमिट करें",
  "reviews.delete": "समीक्षा हटाएँ",
  "reviews.mustBuy": "केवल इस उत्पाद के खरीदार ही समीक्षा कर सकते हैं।",
  "reviews.you": "आप",
  "reviews.thanks": "आपकी समीक्षा के लिए धन्यवाद!",
  "reviews.ratingsCount": "समीक्षाएँ",
  "flash.buy": "खरीदें",
  "flash.soldOut": "बिक गया",
  "flash.stock": "स्ट���क",
  "flash.sold": "बिके",
  "flash.autoDelivery": "स्वतः डिलीवरी",
  "flash.manualDelivery": "मैनुअल डिलीवरी",
  "buy.quantity": "मात्रा",
  "buy.unitPrice": "प्रति इकाई मूल्य",
  "buy.total": "कुल",
  "buy.selectPayment": "भुगतान विधि चुनें",
  "buy.payWallet": "वॉलेट से भुगतान कर���ं",
  "buy.comingSoon": "जल्द आ रहा है",
  "buy.insufficient": "वॉलेट में पर्याप्त शेष नहीं।",
  "buy.confirm": "पुष्टि करें और भुगतान करें",
  "buy.success": "खरीद सफल",
  "buy.deliveryInfo": "डिलीवरी जानकारी (स्वतः):",
  "buy.pendingManual": "आपका ऑर्डर दर्ज हो गया है और मैनुअल डिलीवरी की प्रतीक्षा में है। ऑर्डर अनुभाग में ट्रैक करें।",
  "buy.loginFirst": "पहले एक खाता चुनें",
  "buy.bulkHint": "थोक छूट",
  "buy.subtotal": "उप-योग",
  "coupon.placeholder": "डिस्काउंट कोड",
  "coupon.apply": "लागू करें",
  "coupon.applied": "कूपन लागू हुआ",
  "coupon.remove": "हटाएँ",
  "coupon.discount": "छूट",
  "coupon.invalid": "अमान्य डिस्काउंट कोड।",
  "coupon.expired": "यह कूपन समाप्त हो चुका है।",
  "coupon.notStarted": "यह कूप��� अभी सक्रिय नहीं है।",
  "coupon.minOrder": "इस कूपन के लिए ऑर्डर राशि बहुत कम है।",
  "coupon.exhausted": "इस कूपन की उपयोग सीमा पूरी हो गई है।",
  "coupon.userLimit": "आप इस कूपन का पहले ही उपयोग कर चुके हैं।",
  "orders.title": "मेरे ऑर्डर",
  "orders.empty": "अभी आपका कोई ऑर्डर नहीं है।",
  "orders.quantity": "मात्रा",
  "watchlist.title": "वॉचलिस्ट",
  "watchlist.subtitle": "जिन नीलामियों को आप फ़ॉलो करते हैं; शुरू होने पर सूचित करेंगे।",
  "watchlist.empty": "आप अभी किसी नीलामी को फ़ॉलो नहीं कर रहे।",
  "watchlist.browse": "नीलामी देखें",
  "lang.choose": "भाषा चुनें",
  "auth.tagline": "जारी रखने के लिए अपने Telegram खाते से साइन इन करें",
  "auth.telegramBtn": "Telegram से लॉग इन करें",
  "auth.secureNote": "Telegram के ज़रिए सुरक्षित लॉगिन",
  "auth.privacyTitle": "गोपनीयता और सुरक्षा",
  "auth.privacy1": "आधिकारिक Telegram लॉगिन — हम आपके खाते या पासवर्ड को कभी नहीं छूते",
  "auth.privacy2": "हम केवल आपका नाम, यूज़रनेम और प्रोफ़ाइल फ़ोटो पढ़ते हैं",
  "auth.privacy3": "आपके संदेश और चैट हमारे लिए पूरी तरह अप्राप्य हैं",
  "auth.privacy4": "कुछ भी प्राप्त करने से पहले Telegram अपने सिरे पर लॉगिन सत्यापित करता है",
  "auth.or": "या",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.displayName": "प्रदर्शित नाम (वैकल्पिक)",
  "auth.signIn": "साइन इन",
  "auth.signUp": "साइन अप",
  "auth.toSignUp": "खाता नहीं है? साइन अप करें",
  "auth.toSignIn": "खाता है? साइन इन करें",
  "auth.signingIn": "साइन इन हो रहा है…",
  "auth.widgetMissing": "Telegram लॉगिन अभी कॉन्फ़िगर नहीं है। कृपया ईमेल से साइन इन करें।",
  "auth.logout": "लॉग आउट",
  "profile.title": "मेरी प्रोफ़ाइल",
  "profile.account": "खाता",
  "profile.telegram": "Telegram",
  "profile.email": "ईमेल",
  "profile.role": "भूमिका",
  "profile.notLinked": "लिंक नहीं है",
  "profile.language": "भाषा",
}

export const MESSAGES: Record<Locale, Catalog> = { fa, en, ru, hi }

export function translate(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES.fa[key] ?? key
}
