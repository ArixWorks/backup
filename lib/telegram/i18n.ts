import "server-only"
import type { BotConfig, BotTextKey } from "./config"
import { render } from "./format"
import type { Locale } from "@/lib/i18n/locales"

/**
 * Bot message catalog for non-Persian locales. Persian (fa) always comes from
 * the admin-editable `cfg.texts`. en/ru/hi live here in code and use the same
 * {placeholder} + *bold* conventions consumed by render().
 *
 * Any key missing for a locale falls back to the Persian (editable) template.
 */
type PartialTexts = Partial<Record<BotTextKey, string>>

const en: PartialTexts = {
  welcome:
    "{wave} Hi {name}!\n\nWelcome to *{brand}* {sparkles}\nA pro marketplace for digital goods with live auctions and flash sales.\n\nUse the buttons below or open the app {rocket}",
  welcomeBack: "{wave} Welcome back, {name}!\nGreat to see you again {sparkles}",
  menuPrompt: "{star} Pick an option below:",
  walletHeader:
    "{wallet} *Your wallet*\n\n{money} Total: *{total}*\n{lock} Frozen: *{frozen}*\n{check} Available: *{available}*",
  ordersHeader: "{box} *Your recent orders*",
  ordersEmpty: "{box} No orders yet.\nCheck out the flash sales to get started {fire}",
  flashHeader: "{fire} *Flash Sale*\nInstant-delivery products:",
  flashEmpty: "{clock} No active flash sales right now.",
  watchlistHeader: "{eye} *Auctions you follow*",
  watchlistEmpty: "{eye} Your watchlist is empty.\nBrowse auctions and tap follow {bell}",
  depositPrompt:
    "{card} *Top up wallet*\n\nSend the amount in Toman (e.g. 500000).\nYour card-to-card receipt will then be reviewed {check}",
  depositReceived:
    "{check} Top-up request for *{amount}* recorded.\nYour wallet will be credited after admin approval {sparkles}",
  withdrawPrompt: "{money} *Withdraw*\n\nSend the amount to withdraw in Toman.",
  withdrawReceived:
    "{check} Withdrawal request for *{amount}* recorded.\nIt will be paid after review {sparkles}",
  notifAuctionStarted:
    "{bell} *Auction started!*\n\n{gavel} {title}\nStart price: *{price}*\n\nPlace your bid now {fire}",
  notifAuctionWon:
    "{trophy} *Congrats, you won!* {party}\n\n{gavel} {title}\nFinal price: *{price}*\n\nYour order is being prepared {box}",
  notifOrderDelivered:
    "{gift} *Your order was delivered!* {party}\n\n{box} {title}\nSee delivery details in the app {sparkles}",
  notifDepositApproved:
    "{check} *Top-up approved* {party}\n\n{money} *{amount}* was added to your wallet.",
  notifWithdrawApproved: "{check} *Withdrawal completed* {sparkles}\n\n{money} Amount: *{amount}*",
  purchaseSuccess:
    "{party} *Purchase successful!*\n\n{box} {title}\n{money} Amount: *{price}*\n\nDelivery details under “My orders” {gift}",
  purchaseFailed: "{cross} Purchase failed:\n{reason}",
  notRegistered: "{warning} You need an account first.\nSend /start {rocket}",
  help: "{star} *{brand} help*\n\n/start main menu\n/wallet wallet\n/orders orders\n/flash flash sale\n/watchlist watchlist\n/language change language\n/app open app\n/help this help",
  productCard:
    "{star} *{title}*\n\n{money} Price: *{price}*\n{box} Stock: *{stock}*\n{chart} Sold: *{sold}*{bulk}{links}",
  quantityPrompt:
    "{cart} *{title}*\n{money} Price per unit: *{price}*\n{box} Available: *{stock}*{bulk}\n\n{box} How many would you like? ({min}–{max})",
  quantityInvalid: "{warning} Please send a number between {min} and {max}.",
  selectPayment: "{card} *Select Payment Method*\nOrder {orderTitle} — *{total}*",
  insufficientBalance:
    "{cross} *Insufficient balance!*\n\n{money} Balance: *{balance}*\n{box} Required: *{required}*\n\nPlease top up your wallet first.",
  paymentComingSoon: "{clock} This payment method is coming soon. Use the wallet for now {wallet}",
  chooseLanguage: "{star} Choose your language:",
  chooseLanguageWelcome:
    "{globe} Hi! Please choose your language first {point}\n{globe} سلام! اول زبانت رو انتخاب کن {point}",
  languageSet: "{check} Language updated {sparkles}",
  joinRequired:
    "{lock} *Mandatory membership* {megaphone}\n\nTo use *{brand}* you must first join the channels below {point}\n\nThen tap *“Verify membership”* to unlock access {check}",
  accessRevoked:
    "{warning} *Your access was revoked!* {lock}\n\nLooks like you left one of the required channels {cross}\nTo use *{brand}* again, re-join the channel(s) below {point}\n\nThen tap *“Verify membership”* {check}",
  joinVerified:
    "{party} *Great!* Your membership is verified {sparkles}\n\nYou now have full access to *{brand}* {rocket}",
  joinNotYet: "{warning} You haven't joined all channels yet! Join first, then verify.",
}

const ru: PartialTexts = {
  welcome:
    "{wave} Привет, {name}!\n\nДобро пожаловать в *{brand}* {sparkles}\nПрофессиональный маркетплейс цифровых товаров с живыми аукционами и распродажами.\n\nИспользуйте кнопки ниже или откройте приложение {rocket}",
  welcomeBack: "{wave} С возвращением, {name}!\nРады видеть вас снова {sparkles}",
  menuPrompt: "{star} Выберите пункт ниже:",
  walletHeader:
    "{wallet} *Ваш кошелёк*\n\n{money} Всего: *{total}*\n{lock} Заморожено: *{frozen}*\n{check} Доступно: *{available}*",
  ordersHeader: "{box} *Ваши последние заказы*",
  ordersEmpty: "{box} Пока нет заказов.\nЗагляните в распродажи, чтобы начать {fire}",
  flashHeader: "{fire} *Распродажа*\nТовары с мгновенной доставкой:",
  flashEmpty: "{clock} Сейчас активных распродаж нет.",
  watchlistHeader: "{eye} *Аукционы, за которыми вы следите*",
  watchlistEmpty: "{eye} Список пуст.\nСмотрите аукционы и нажимайте «Следить» {bell}",
  depositPrompt:
    "{card} *Пополнение кошелька*\n\nОтправьте сумму в туманах (например, 500000).\nЗатем чек о переводе будет проверен {check}",
  depositReceived:
    "{check} Запрос на пополнение *{amount}* принят.\nКошелёк будет пополнен после подтверждения админом {sparkles}",
  withdrawPrompt: "{money} *Вывод средств*\n\nОтправьте сумму для вывода в туманах.",
  withdrawReceived:
    "{check} Запрос на вывод *{amount}* принят.\nВыплата будет после проверки {sparkles}",
  notifAuctionStarted:
    "{bell} *Аукцион начался!*\n\n{gavel} {title}\nСтартовая цена: *{price}*\n\nСделайте ставку {fire}",
  notifAuctionWon:
    "{trophy} *Поздравляем, вы выиграли!* {party}\n\n{gavel} {title}\nИтоговая цена: *{price}*\n\nЗаказ готовится {box}",
  notifOrderDelivered:
    "{gift} *Ваш заказ доставлен!* {party}\n\n{box} {title}\nПодробности в приложении {sparkles}",
  notifDepositApproved:
    "{check} *Пополнение подтверждено* {party}\n\n{money} *{amount}* зачислено в кошелёк.",
  notifWithdrawApproved: "{check} *Вывод выполнен* {sparkles}\n\n{money} Сумма: *{amount}*",
  purchaseSuccess:
    "{party} *Покупка успешна!*\n\n{box} {title}\n{money} Сумма: *{price}*\n\nДетали доставки в разделе «Мои заказы» {gift}",
  purchaseFailed: "{cross} Покупка не удалась:\n{reason}",
  notRegistered: "{warning} Сначала нужен аккаунт.\nОтправьте /start {rocket}",
  help: "{star} *Помощь {brand}*\n\n/start главное меню\n/wallet кошелёк\n/orders заказы\n/flash распродажа\n/watchlist избранное\n/language язык\n/app приложение\n/help эта справка",
  productCard:
    "{star} *{title}*\n\n{money} Цена: *{price}*\n{box} В наличии: *{stock}*\n{chart} Продано: *{sold}*{bulk}{links}",
  quantityPrompt:
    "{cart} *{title}*\n{money} Цена за штуку: *{price}*\n{box} Доступно: *{stock}*{bulk}\n\n{box} Сколько штук? ({min}–{max})",
  quantityInvalid: "{warning} Отправьте число от {min} до {max}.",
  selectPayment: "{card} *Выберите способ оплаты*\nЗаказ {orderTitle} — *{total}*",
  insufficientBalance:
    "{cross} *Недостаточно средств!*\n\n{money} Баланс: *{balance}*\n{box} Требуется: *{required}*\n\nСначала пополните кошелёк.",
  paymentComingSoon: "{clock} Этот способ оплаты скоро появится. Пока используйте кошелёк {wallet}",
  chooseLanguage: "{star} Выберите язык:",
  chooseLanguageWelcome:
    "{globe} Привет! Сначала выберите язык {point}\n{globe} Hi! Please choose your language first {point}",
  languageSet: "{check} Язык обновлён {sparkles}",
  joinRequired:
    "{lock} *Обязательная подписка* {megaphone}\n\nЧтобы пользоваться *{brand}*, сначала подпишитесь на каналы ниже {point}\n\nЗатем нажмите *«Проверить подписку»*, чтобы открыть доступ {check}",
  accessRevoked:
    "{warning} *Доступ закрыт!* {lock}\n\nПохоже, вы покинули один из обязательных каналов {cross}\nЧтобы снова пользоваться *{brand}*, подпишитесь на канал(ы) ниже {point}\n\nЗатем нажмите *«Проверить подписку»* {check}",
  joinVerified:
    "{party} *Отлично!* Подписка подтверждена {sparkles}\n\nТеперь у вас полный доступ к *{brand}* {rocket}",
  joinNotYet: "{warning} Вы ещё не подписались на все каналы! Сначала подпишитесь, потом проверьте.",
}

const hi: PartialTexts = {
  welcome:
    "{wave} नमस्ते {name}!\n\n*{brand}* में आपका स्वागत है {sparkles}\nलाइव नीलामी और फ्लैश सेल के साथ डिजिटल उत्पादों का प्रोफेशनल मार्केटप्लेस।\n\nनीचे दिए बटन इस्तेमाल करें या ऐप खोलें {rocket}",
  welcomeBack: "{wave} वापसी पर स्वागत है, {name}!\nआपको फिर देखकर खुशी हुई {sparkles}",
  menuPrompt: "{star} नीचे से एक विकल्प चुनें:",
  walletHeader:
    "{wallet} *आपका वॉलेट*\n\n{money} कुल: *{total}*\n{lock} रोका गया: *{frozen}*\n{check} उपलब्ध: *{available}*",
  ordersHeader: "{box} *आपके हाल के ऑर्डर*",
  ordersEmpty: "{box} अभी कोई ऑर्डर नहीं।\nशुरू करने के लिए फ्लैश सेल देखें {fire}",
  flashHeader: "{fire} *फ्लैश सेल*\nतुरंत डिलीवरी वाले उत्पाद:",
  flashEmpty: "{clock} अभी कोई सक्रिय फ्लैश सेल नहीं।",
  watchlistHeader: "{eye} *आप जिन नीलामियों को फ़ॉलो करते हैं*",
  watchlistEmpty: "{eye} आपकी वॉचलिस्ट खाली है।\nनीलामी देखें और फ़ॉलो दबाएँ {bell}",
  depositPrompt:
    "{card} *वॉलेट टॉप अप*\n\nराशि तोमान में भेजें (जैसे 500000)।\nफिर आपकी रसीद की समीक्षा होगी {check}",
  depositReceived:
    "{check} *{amount}* टॉप-अप अनुरोध दर्ज हुआ।\nएडमिन की मंज़ूरी के बाद वॉलेट ��्रेडिट होगा {sparkles}",
  withdrawPrompt: "{money} *निकासी*\n\nनिकासी की राशि तोमान में भेजें।",
  withdrawReceived:
    "{check} *{amount}* निकासी अनुरोध दर्ज हुआ।\nसमीक्षा के बाद भुगतान होगा {sparkles}",
  notifAuctionStarted:
    "{bell} *नीलामी शुरू!*\n\n{gavel} {title}\nशुरुआती कीमत: *{price}*\n\nअभी बोली लगाएँ {fire}",
  notifAuctionWon:
    "{trophy} *बधाई, आप जीते!* {party}\n\n{gavel} {title}\nअंतिम कीमत: *{price}*\n\nआपका ऑर्डर तैयार हो रहा है {box}",
  notifOrderDelivered:
    "{gift} *आपका ऑर्डर डिलीवर हुआ!* {party}\n\n{box} {title}\nऐप में डिलीवरी विवरण देखें {sparkles}",
  notifDepositApproved:
    "{check} *टॉप-अप मंज़ूर* {party}\n\n{money} *{amount}* आपके वॉलेट में जुड़ा।",
  notifWithdrawApproved: "{check} *निकासी पूर्ण* {sparkles}\n\n{money} राशि: *{amount}*",
  purchaseSuccess:
    "{party} *खरीद सफल!*\n\n{box} {title}\n{money} राशि: *{price}*\n\n«मेरे ऑर्डर» में डिलीवरी विवरण {gift}",
  purchaseFailed: "{cross} खरीद विफल:\n{reason}",
  notRegistered: "{warning} पहले खाता चाहिए।\n/start भेजें {rocket}",
  help: "{star} *{brand} मदद*\n\n/start मुख्य मेन्यू\n/wallet वॉलेट\n/orders ऑर्डर\n/flash फ्लैश सेल\n/watchlist वॉचलिस्ट\n/language भाषा\n/app ऐप\n/help यह मदद",
  productCard:
    "{star} *{title}*\n\n{money} कीमत: *{price}*\n{box} स्टॉक: *{stock}*\n{chart} बिके: *{sold}*{bulk}{links}",
  quantityPrompt:
    "{cart} *{title}*\n{money} प्रति यूनिट कीमत: *{price}*\n{box} उपलब्ध: *{stock}*{bulk}\n\n{box} कितने चाहिए? ({min}–{max})",
  quantityInvalid: "{warning} {min} से {max} के बीच संख्या भेजें।",
  selectPayment: "{card} *भुगतान विधि चुनें*\nऑर्डर {orderTitle} — *{total}*",
  insufficientBalance:
    "{cross} *अपर्याप्त शेष!*\n\n{money} शेष: *{balance}*\n{box} आवश्यक: *{required}*\n\nपहले वॉलेट टॉप अप करें।",
  paymentComingSoon: "{clock} यह भुगतान विधि जल्द आ रही है। अभी वॉलेट इस्तेमाल करें {wallet}",
  chooseLanguage: "{star} अपनी भाषा चुनें:",
  chooseLanguageWelcome:
    "{globe} नमस्ते! पहले अपनी भाषा चुनें {point}\n{globe} Hi! Please choose your language first {point}",
  languageSet: "{check} भाषा अपडेट हुई {sparkles}",
  joinRequired:
    "{lock} *अनिवार्य सदस्यता* {megaphone}\n\n*{brand}* इस्तेमाल करने के लिए पहले नीचे दिए चैनलों को जॉइन करें {point}\n\nफिर एक्सेस पाने के लिए *“सदस्यता जाँचें”* दबाएँ {check}",
  accessRevoked:
    "{warning} *आपकी एक्सेस रद्द हो गई!* {lock}\n\nलगता है आपने किसी अनिवार्य चैनल को छोड़ दिया {cross}\n*{brand}* फिर से इस्तेमाल करने के लिए नीचे दिए चैनल फिर जॉइन करें {point}\n\nफिर *“सदस्यता जाँचें”* दबाएँ {check}",
  joinVerified:
    "{party} *बढ़िया!* आपकी सदस्यता सत्यापित हो गई {sparkles}\n\nअब आपके पास *{brand}* की पूरी एक्सेस है {rocket}",
  joinNotYet: "{warning} आपने अभी तक सभी चैनल जॉइन नहीं किए! पहले जॉइन करें, फिर जाँचें।",
}

const CATALOG: Record<Exclude<Locale, "fa">, PartialTexts> = { en, ru, hi }

/**
 * Resolve a localized bot template and render it to Telegram HTML.
 * fa → admin-editable cfg.texts; others → code catalog (fallback to fa).
 */
export function t(
  cfg: BotConfig,
  locale: Locale,
  key: BotTextKey,
  vars: Record<string, string | number> = {},
): { html: string } {
  let template: string
  if (locale === "fa") {
    template = cfg.texts[key]
  } else {
    template = CATALOG[locale]?.[key] ?? cfg.texts[key]
  }
  return render(template ?? "", cfg, vars)
}

/** Localized button label (fa from cfg.buttons; others from this small map). */
const BUTTONS: Record<Exclude<Locale, "fa">, Record<string, string>> = {
  en: {
    openApp: "🚀 Open App",
    auctions: "🔨 Auctions",
    flash: "🔥 Flash Sale",
    wallet: "💎 Wallet",
    orders: "📦 Orders",
    watchlist: "👀 Watchlist",
    deposit: "💳 Top up",
    withdraw: "💰 Withdraw",
    help: "❓ Help",
    back: "⬅️ Back",
    buy: "🛒 Buy now",
    refresh: "🔄 Refresh",
    buyNow: "🛒 Buy",
    payWallet: "💎 Pay with Wallet",
    payBinance: "🟡 Pay with Binance Pay",
    payUsdt: "💵 Pay with USDT",
    payCrypto: "🤖 Pay with CryptoBot",
    cancel: "❌ Cancel",
    language: "🌐 Language",
    joinChannel: "📣 Join channel",
    checkJoin: "✅ Verify membership",
  },
  ru: {
    openApp: "🚀 Открыть приложение",
    auctions: "🔨 Аукционы",
    flash: "🔥 Распродажа",
    wallet: "💎 Кошелёк",
    orders: "📦 Заказы",
    watchlist: "👀 Избранное",
    deposit: "💳 Пополнить",
    withdraw: "💰 Вывести",
    help: "❓ Помощь",
    back: "⬅️ Назад",
    buy: "🛒 Купить",
    refresh: "🔄 Обновить",
    buyNow: "🛒 Купить",
    payWallet: "💎 Оплатить кошельком",
    payBinance: "🟡 Оплатить Binance Pay",
    payUsdt: "💵 Оплатить USDT",
    payCrypto: "🤖 Оплатить CryptoBot",
    cancel: "❌ Отмена",
    language: "🌐 Язык",
    joinChannel: "📣 Подписаться",
    checkJoin: "✅ Проверить подписку",
  },
  hi: {
    openApp: "🚀 ऐप खोलें",
    auctions: "🔨 नीलामी",
    flash: "🔥 फ्लैश सेल",
    wallet: "💎 वॉलेट",
    orders: "📦 ऑर्डर",
    watchlist: "👀 वॉचलिस्ट",
    deposit: "💳 टॉप अप",
    withdraw: "💰 निकासी",
    help: "❓ मदद",
    back: "⬅️ वापस",
    buy: "🛒 खरीदें",
    refresh: "🔄 रिफ्रेश",
    buyNow: "🛒 खरीदें",
    payWallet: "💎 वॉलेट से भुगतान",
    payBinance: "🟡 Binance Pay से भुगतान",
    payUsdt: "💵 USDT से भुगतान",
    payCrypto: "🤖 CryptoBot से भुगतान",
    cancel: "❌ रद्द करें",
    language: "🌐 भाषा",
    joinChannel: "📣 चैनल जॉइन करें",
    checkJoin: "✅ सदस्यता जाँचें",
  },
}

/** Localized label for a button key, falling back to the Persian config label. */
export function btnLabel(cfg: BotConfig, locale: Locale, key: string): string {
  if (locale === "fa") return cfg.buttons[key] ?? key
  return BUTTONS[locale]?.[key] ?? cfg.buttons[key] ?? key
}
