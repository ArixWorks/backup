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
  | "common.rial"
  | "common.viewAll"
  | "common.showMore"
  | "common.showLess"
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
  | "auctions.nextBid"
  | "auctions.finalPrice"
  | "auctions.startingPrice"
  | "auctions.startsAt"
  | "auctions.sold"
  | "auctions.endingSoon"
  | "auctions.reserveNotMetShort"
  | "auctions.stampSold"
  | "auctions.stampEnded"
  | "auctions.stampUnsold"
  | "auctions.stampCancelled"
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
  | "plan.choose"
  | "plan.compare"
  | "plan.selected"
  | "plan.from"
  | "plan.each"
  | "plan.perDevice"
  | "plan.feature.duration"
  | "plan.feature.devices"
  | "plan.feature.accountType"
  | "plan.feature.credentials"
  | "plan.feature.twoFactor"
  | "plan.feature.warranty"
  | "plan.value.private"
  | "plan.value.shared"
  | "plan.value.yes"
  | "plan.value.no"
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
  | "banned.title"
  | "banned.message"
  | "banned.logout"
  | "profile.title"
  | "profile.account"
  | "profile.telegram"
  | "profile.email"
  | "profile.role"
  | "profile.notLinked"
  | "profile.language"
  | "profile.motion"
  | "motion.choose"
  | "motion.auto"
  | "motion.cinematic"
  | "motion.balanced"
  | "motion.minimal"
  | "motion.hint"
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
  | "join.joinCta"
  | "join.members"
  | "join.channelDesc"
  | "join.allSet"
  | "join.allSetDesc"
  | "join.verifying"
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
  | "adetail.reserveHidden"
  | "adetail.minIncrement"
  | "adetail.winnersCount"
  | "adetail.endTime"
  | "adetail.days"
  | "adetail.hours"
  | "adetail.mins"
  | "adetail.secs"
  | "adetail.buyNowStat"
  | "adetail.nextMinBid"
  | "adetail.finalPrice"
  | "adetail.winner"
  | "adetail.soldViaBuyNow"
  | "adetail.overview"
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
  | "watchlist.signInRequired"
  | "watchlist.emptyDesc"
  | "watchlist.flashProducts"
  | "rewards.title"
  | "rewards.subtitle"
  | "rewards.tabMissions"
  | "rewards.tabBadges"
  | "rewards.tabHistory"
  | "rewards.noMissions"
  | "invite.title"
  | "invite.subtitle"
  | "invite.signInRequired"
  | "invite.how"
  | "invite.recent"
  | "invite.s1.title"
  | "invite.s1.desc"
  | "invite.s2.title"
  | "invite.s2.desc"
  | "invite.s3.title"
  | "invite.s3.desc"
  | "reports.signInRequired"
  | "reports.title"
  | "reports.subtitle"
  | "reports.empty"
  | "reports.emptyDesc"
  | "reports.emptyAction"
  | "reports.card"
  | "reports.reference"
  | "support.signInRequired"
  | "support.title"
  | "support.subtitle"
  | "support.empty"
  | "support.emptyDesc"
  | "supportStatus.OPEN"
  | "supportStatus.ANSWERED"
  | "supportStatus.PENDING"
  | "supportStatus.CLOSED"
  | "supportCat.GENERAL"
  | "supportCat.PAYMENT"
  | "supportCat.ORDER"
  | "supportCat.REFUND"
  | "supportCat.TECHNICAL"
  | "depositStatus.PENDING"
  | "depositStatus.APPROVED"
  | "depositStatus.REJECTED"
  | "refundStatus.PENDING"
  | "refundStatus.APPROVED"
  | "refundStatus.REJECTED"
  | "refundStatus.PAID"
  | "refunds.signInRequired"
  | "refunds.title"
  | "refunds.subtitle"
  | "refunds.notice"
  | "refunds.available"
  | "refunds.amountLabel"
  | "refunds.amountPlaceholder"
  | "refunds.fullNameLabel"
  | "refunds.fullNamePlaceholder"
  | "refunds.nationalIdLabel"
  | "refunds.nationalIdPlaceholder"
  | "refunds.cardLabel"
  | "refunds.ibanLabel"
  | "refunds.nationalCardLabel"
  | "refunds.nationalCardPick"
  | "refunds.reasonLabel"
  | "refunds.reasonPlaceholder"
  | "refunds.submit"
  | "refunds.submitting"
  | "refunds.previous"
  | "refunds.empty"
  | "refunds.rejectReason"
  | "refunds.card"
  | "refunds.errMinAmount"
  | "refunds.errOverBalance"
  | "refunds.errFullName"
  | "refunds.errNationalId"
  | "refunds.errCard"
  | "refunds.errFile"
  | "refunds.success"
  | "refunds.errSubmit"
  | "ticket.errSend"
  | "ticket.closedToast"
  | "ticket.errClose"
  | "ticket.back"
  | "ticket.fallbackTitle"
  | "ticket.category"
  | "ticket.viewAttachment"
  | "ticket.closedNotice"
  | "ticket.replyPlaceholder"
  | "ticket.attach"
  | "ticket.removeAttach"
  | "ticket.closeTicket"
  | "ticket.send"
  | "newTicket.errSubject"
  | "newTicket.errMessage"
  | "newTicket.success"
  | "newTicket.errSubmit"
  | "newTicket.button"
  | "newTicket.title"
  | "newTicket.category"
  | "newTicket.subject"
  | "newTicket.subjectPlaceholder"
  | "newTicket.desc"
  | "newTicket.descPlaceholder"
  | "newTicket.attachOptional"
  | "newTicket.sending"
  | "newTicket.submit"
  | "auth.genericError"
  | "auth.backToLogin"
  | "auth.forgotTitle"
  | "auth.forgotDesc"
  | "auth.forgotSentDesc"
  | "auth.sendResetLink"
  | "auth.resetTitle"
  | "auth.resetRedirecting"
  | "auth.resetInvalidLink"
  | "auth.requestNewLink"
  | "auth.newPasswordPlaceholder"
  | "auth.confirmNewPlaceholder"
  | "auth.saveNewPassword"
  | "auth.errMinPassword"
  | "auth.errPasswordMismatch"
  | "auth.resetFailed"
  | "verify.working"
  | "verify.invalidLink"
  | "verify.okTitle"
  | "verify.okDesc"
  | "verify.failedTitle"
  | "verify.emailFailed"
  | "verify.backToAccount"
  | "acctEmail.title"
  | "acctEmail.notSet"
  | "acctEmail.verified"
  | "acctEmail.unverified"
  | "acctEmail.pending"
  | "acctEmail.sentNotice"
  | "acctEmail.sendFailed"
  | "acctEmail.errMinPassword"
  | "acctEmail.verifiedLocked"
  | "acctEmail.choosePassword"
  | "acctEmail.sendVerify"
  | "acctEmail.resend"
  | "acctEmail.change"
  | "acctPwd.title"
  | "acctPwd.subtitle"
  | "acctPwd.change"
  | "acctPwd.success"
  | "acctPwd.errMin"
  | "acctPwd.errMismatch"
  | "acctPwd.failed"
  | "acctPwd.currentPlaceholder"
  | "acctPwd.newPlaceholder"
  | "acctPwd.confirmPlaceholder"
  | "acctPwd.save"
  | "acctTg.title"
  | "acctTg.connected"
  | "acctTg.notConnected"
  | "acctTg.connectedBadge"
  | "acctTg.linkFailed"
  | "acctTg.unlinkFailed"
  | "acctTg.unlink"
  | "acctTg.needOtherMethod"
  | "acctTg.notAvailable"
  | "acctTg.connectAccount"
  | "common.ended"
  | "a11y.mainNav"
  | "a11y.collapseSidebar"
  | "a11y.expandSidebar"
  | "a11y.openMenu"
  | "a11y.closeMenu"
  | "nav.menu"
  | "a11y.supportOnline"
  | "home.recommended"
  | "flash.followCategoryHint"
  | "signIn.title"
  | "signIn.defaultDesc"
  | "signIn.action"
  | "watch.errUpdate"
  | "watch.auctionRemoved"
  | "watch.auctionAdded"
  | "watch.watching"
  | "watch.watchAuction"
  | "watch.productCancelled"
  | "watch.productAdded"
  | "watch.productActive"
  | "watch.notifyMe"
  | "watchedProducts.empty"
  | "watchedProducts.inStock"
  | "catFollow.unfollowed"
  | "catFollow.followed"
  | "catFollow.errUpdate"
  | "catFollow.following"
  | "catFollow.follow"
  | "notif.moreCount"
  | "notif.view"
  | "rewards.achievements"
  | "rewards.earnedOf"
  | "menu.notifications"
  | "menu.notificationsDesc"
  | "menu.wallet"
  | "menu.walletDesc"
  | "menu.reports"
  | "menu.reportsDesc"
  | "menu.support"
  | "menu.supportDesc"
  | "menu.refunds"
  | "menu.refundsDesc"
  | "menu.profile"
  | "menu.profileDesc"
  | "menu.account"
  | "menu.accountDesc"
  | "menu.admin"
  | "menu.adminDesc"
  | "menu.accountAria"
  | "menu.title"
  | "menu.unmuteAria"
  | "menu.muteAria"
  | "menu.mutedTitle"
  | "menu.unmutedTitle"
  | "referral.copied"
  | "referral.copyFailed"
  | "referral.shareText"
  | "referral.shareTitle"
  | "referral.title"
  | "referral.desc"
  | "referral.descEachPurchase"
  | "referral.copyAria"
  | "referral.sendTelegram"
  | "referral.shareLink"
  | "referral.statReferred"
  | "referral.statActive"
  | "referral.statEarned"
  | "txn.DEPOSIT"
  | "txn.WITHDRAWAL"
  | "txn.FREEZE"
  | "txn.UNFREEZE"
  | "txn.PURCHASE"
  | "txn.REFUND"
  | "txn.BID_LOCK"
  | "txn.BID_RELEASE"
  | "txn.ADMIN_ADJUSTMENT"
  | "txn.CASHBACK"
  | "txn.REFERRAL_BONUS"
  | "txn.CONVERSION"
  | "stmt.filterAll"
  | "stmt.purchase"
  | "stmt.title"
  | "stmt.filter"
  | "stmt.searchPlaceholder"
  | "stmt.txnType"
  | "stmt.fromDate"
  | "stmt.toDate"
  | "stmt.foundCount"
  | "stmt.empty"
  | "wallet.selectCurrency"
  | "wallet.frozenShort"
  | "wallet.addFunds"
  | "wallet.yourBalance"
  | "wallet.recentActivity"
  | "wallet.noActivity"
  | "wallet.chooseAmount"
  | "wallet.chooseMethod"
  | "wallet.amountTomanLabel"
  | "wallet.amountUsdLabel"
  | "wallet.methodCard"
  | "wallet.methodCardSub"
  | "wallet.methodUsdt"
  | "wallet.methodTon"
  | "wallet.methodStars"
  | "wallet.methodStarsSub"
  | "wallet.methodUnavailable"
  | "wallet.continue"
  | "wallet.sendExactly"
  | "wallet.toAddress"
  | "wallet.toCard"
  | "wallet.cardHolder"
  | "wallet.network"
  | "wallet.transferNote"
  | "wallet.copy"
  | "wallet.copied"
  | "wallet.uploadReceipt"
  | "wallet.receiptUploaded"
  | "wallet.iPaid"
  | "wallet.cryptoWarning"
  | "wallet.expiresIn"
  | "wallet.expired"
  | "wallet.pendingReview"
  | "wallet.payWithStars"
  | "wallet.starsAmount"
  | "wallet.depositCreated"
  | "wallet.uploading"
  | "wallet.back"
  | "wallet.submittedTitle"
  | "wallet.submittedBody"
  | "wallet.gotIt"
  | "wallet.close"
  | "wallet.requestsTitle"
  | "wallet.requestsEmpty"
  | "wallet.statusAwaiting"
  | "wallet.statusPending"
  | "wallet.statusApproved"
  | "wallet.statusRejected"
  | "wallet.statusExpired"
  | "wallet.rejectedTitle"
  | "wallet.rejectedBody"
  | "wallet.rejectReasonLabel"
  | "convert.enterAmount"
  | "convert.sameCurrency"
  | "convert.success"
  | "convert.error"
  | "convert.button"
  | "convert.from"
  | "convert.to"
  | "convert.amountLabel"
  | "convert.amountPlaceholder"
  | "convert.rateUnavailable"
  | "convert.approxReceive"
  | "notifList.tabAll"
  | "notifList.tabUnread"
  | "notifList.tabArchived"
  | "notifList.searchPlaceholder"
  | "notifList.markAll"
  | "notifList.emptySearch"
  | "notifList.emptyArchived"
  | "notifList.emptyUnread"
  | "notifList.emptyAll"
  | "notifList.emptyAllDesc"
  | "notifList.restore"
  | "notifList.delete"
  | "notifList.archive"
  | "gwStatus.ACTIVE"
  | "gwStatus.SCHEDULED"
  | "gwStatus.PAUSED"
  | "gwStatus.LOCKED"
  | "gwStatus.DRAWING"
  | "gwStatus.FINISHED"
  | "gw.winnersCount"
  | "gw.participants"
  | "gw.startsUntil"
  | "gw.drawn"
  | "gw.drawUntil"
  | "gwd.entered"
  | "gwd.joinChannelsFirst"
  | "gwd.errEnter"
  | "gwd.startRegUntil"
  | "gwd.participants"
  | "gwd.prize"
  | "gwd.mustJoin"
  | "gwd.afterJoinRetry"
  | "gwd.winners"
  | "gwd.noWinners"
  | "gwd.alreadyEntered"
  | "gwd.notStarted"
  | "gwd.regClosed"
  | "gwd.signInToEnter"
  | "gwd.enter"
  | "bid.minBid"
  | "bid.placed"
  | "bid.errPlace"
  | "bid.buyNowSuccess"
  | "bid.errBuyNow"
  | "bid.notActive"
  | "bid.amountLabel"
  | "bid.min"
  | "bid.submit"
  | "bid.buyNow"
  | "bid.hint"
  | "bid.emptyBalance"
  | "bid.insufficient"
  | "bid.needTopUp"
  | "bid.enableMax"
  | "bid.maxLabel"
  | "bid.maxPlaceholder"
  | "bid.maxHint"
  | "bid.maxTooLow"
  | "bid.maxPlaced"
  | "auth.errTelegram"
  | "auth.forgotLink"
  | "forcePwd.errMin"
  | "forcePwd.errChange"
  | "forcePwd.title"
  | "forcePwd.desc"
  | "forcePwd.currentPlaceholder"
  | "forcePwd.save"
  | "tgLogin.loading"
  | "tgLogin.unavailable"
  | "tgLogin.domainNotice"
  | "vip.loginStreak"
  | "vip.usablePoints"
  | "vip.totalSpend"
  | "vip.progressTo"
  | "vip.pointsProgress"
  | "vip.spendProgress"
  | "vip.maxTier"
  | "ptSrc.PURCHASE"
  | "ptSrc.REFERRAL"
  | "ptSrc.GIVEAWAY_ENTRY"
  | "ptSrc.DAILY_LOGIN"
  | "ptSrc.PROFILE_COMPLETE"
  | "ptSrc.MISSION_REWARD"
  | "ptSrc.ACHIEVEMENT"
  | "ptSrc.ADMIN_ADJUSTMENT"
  | "ptSrc.REDEEM"
  | "points.empty"
  | "missions.pointsReceived"
  | "missions.errClaim"
  | "missions.claim"
  | "missions.daily"
  | "missions.weekly"
  | "refAct.pending"
  | "refAct.joined"
  | "refAct.purchased"
  | "refAct.daysAgo"
  | "refAct.hoursAgo"
  | "refAct.minutesAgo"
  | "refAct.now"
  | "refAct.empty"
  | "refAct.emptyDesc"
  | "nav.profile"
  | "home.dashboard"
  | "home.servicesTitle"
  | "home.recentTitle"
  | "home.recentEmpty"
  | "home.promoTitle"
  | "home.promoBody"
  | "home.promoCta"
  | "home.accountStatus"
  | "svc.store"
  | "svc.storeDesc"
  | "svc.auctions"
  | "svc.auctionsDesc"
  | "svc.vps"
  | "svc.vpsDesc"
  | "svc.domains"
  | "svc.domainsDesc"
  | "svc.giveaways"
  | "svc.giveawaysDesc"
  | "svc.orders"
  | "svc.ordersDesc"
  | "svc.support"
  | "svc.supportDesc"
  | "svc.rewards"
  | "svc.rewardsDesc"
  | "badge.soon"
  | "badge.new"
  | "badge.hot"
  | "badge.active"
  | "soon.title"
  | "soon.heading"
  | "soon.body"
  | "soon.back"
  | "vps.title"
  | "vps.subtitle"
  | "domains.title"
  | "domains.subtitle"

type Catalog = Record<MessageKey, string>

  const fa: Catalog = {
    "nav.profile": "پروفایل",
    "home.dashboard": "داشبورد",
    "home.servicesTitle": "خدمات",
    "home.recentTitle": "فعالیت اخیر",
    "home.recentEmpty": "هنوز فعالیتی ثبت نشده است",
    "home.promoTitle": "پیشنهاد ویژه",
    "home.promoBody": "با شارژ کیف پول از تخفیف‌های ویژه بهره‌مند شوید",
    "home.promoCta": "مشاهده",
    "home.accountStatus": "وضعیت حساب",
    "svc.store": "فروشگاه",
    "svc.storeDesc": "اشتراک، اکانت و محصولات دیجیتال",
    "svc.auctions": "مزایده‌ها",
    "svc.auctionsDesc": "خرید محصولات با قیمت رقابتی",
    "svc.vps": "سرور مجازی",
    "svc.vpsDesc": "میزبانی VPS پرقدرت",
    "svc.domains": "ثبت دامنه",
    "svc.domainsDesc": "جستجو و ثبت دامنه اختصاصی",
    "svc.giveaways": "قرعه‌کشی",
    "svc.giveawaysDesc": "شرکت در قرعه‌کشی‌های رایگان",
    "svc.orders": "سفارش‌ها",
    "svc.ordersDesc": "پیگیری خریدها و تحویل",
    "svc.support": "پشتیبانی",
    "svc.supportDesc": "گفتگو با تیم پشتیبانی",
    "svc.rewards": "باشگاه مشتریان",
    "svc.rewardsDesc": "امتیاز، سطح و پاداش‌ها",
    "badge.soon": "بزودی",
    "badge.new": "جدید",
    "badge.hot": "داغ",
    "badge.active": "فعال",
    "soon.title": "بزودی",
    "soon.heading": "این بخش بزودی فعال می‌شود",
    "soon.body": "در حال توسعه این قابلیت هستیم و به‌زودی به پروژه اضافه می‌شود.",
    "soon.back": "بازگشت به داشبورد",
    "vps.title": "سرور مجازی (VPS)",
    "vps.subtitle": "میزبانی ابری پرقدرت و پایدار",
    "domains.title": "ثبت دامنه",
    "domains.subtitle": "جستجو، قیمت و ثبت دامنه اختصاصی شما",
    "nav.home": "خانه",
  "nav.auctions": "مزایده‌ها",
  "nav.flash": "فروشگاه",
  "nav.wallet": "کیف پول",
  "nav.orders": "سفارش‌ها",
  "nav.giveaways": "قرعه‌کشی",
  "giveaways.title": "قرعه‌کشی‌ها",
  "giveaways.subtitle": "با عضویت در کانال‌ها در قرعه‌کشی‌ها شرکت کن و برنده شو",
  "common.toman": "تومان",
  "common.rial": "ریال",
  "common.viewAll": "مشاهده همه",
  "common.showMore": "نمایش بیشتر",
  "common.showLess": "نمایش کمتر",
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
  "home.flashSales": "فروشگاه",
  "home.noAuctions": "مزایده‌ی فعالی وجود ندارد.",
  "home.noFlash": "محصولی در فروشگاه موجود نیست.",
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
  "auctions.nextBid": "حداقل پیشنهاد بعدی",
  "auctions.finalPrice": "قیمت نهایی",
  "auctions.startingPrice": "قیمت پایه",
  "auctions.startsAt": "شروع",
  "auctions.sold": "فروخته شد",
  "auctions.endingSoon": "رو به پایان",
  "auctions.reserveNotMetShort": "به حدنصاب نرسید",
  "auctions.stampSold": "فروخته شد",
  "auctions.stampEnded": "پایان یافت",
  "auctions.stampUnsold": "بدون فروش",
  "auctions.stampCancelled": "لغو شد",
  "flash.title": "فروشگاه",
  "flash.subtitle": "خرید آنی با قیمت ثابت؛ محصولات تحویل خودکار بلافاصله پس از پرداخت ارسال می‌شوند.",
  "flash.empty": "محصولی در فروشگاه موجود نیست.",
  "detail.back": "بازگشت به فروشگاه",
  "detail.description": "توضیحات",
  "detail.tags": "برچسب‌ها",
  "detail.share": "اشتراک‌گذاری",
  "detail.shareCopied": "لینک کپی شد",
  "detail.notFound": "این محصول یافت نشد یا دیگر در دسترس نیست.",
  "detail.eachFrom": "هر واحد از",
  "detail.restockNotice": "این محصول تمام شده است. برای اطلاع از موجودی مجدد، اطلاع‌رسانی را فعال کنید.",
  "plan.choose": "پلن مورد نظر را انتخاب کنید",
  "plan.compare": "مقایسه پلن‌ها",
  "plan.selected": "انتخاب‌شده",
  "plan.from": "شروع از",
  "plan.each": "هر عدد",
  "plan.perDevice": "دستگاه",
  "plan.feature.duration": "مدت اشتراک",
  "plan.feature.devices": "تعداد دستگاه",
  "plan.feature.accountType": "نوع اکانت",
  "plan.feature.credentials": "تغییر رمز عبور",
  "plan.feature.twoFactor": "تایید دومرحله‌ای",
  "plan.feature.warranty": "گارانتی",
  "plan.value.private": "اختصاصی",
  "plan.value.shared": "اشتراکی",
  "plan.value.yes": "دارد",
  "plan.value.no": "ندارد",
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
  "reviews.mustBuy": "فقط خریداران این محصول می‌توانند نظر ثبت کنند.",
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
  "banned.title": "حساب شما مسدود شد",
  "banned.message": "شما مسدود شدید و امکان دسترسی به خدمات این بات را ندارید.",
  "banned.logout": "خروج از حساب",
  "profile.title": "پروفایل من",
  "profile.account": "حساب کاربری",
  "profile.telegram": "تلگرام",
  "profile.email": "ایمیل",
  "profile.role": "نقش",
  "profile.notLinked": "متصل نشده",
  "profile.language": "زبان",
  "profile.motion": "کیفیت جلوه‌ها",
  "motion.choose": "انتخاب کیفیت جلوه‌ها",
  "motion.auto": "خودکار",
  "motion.cinematic": "سینمایی",
  "motion.balanced": "متعادل",
  "motion.minimal": "حداقلی",
  "motion.hint": "حالت خودکار بر اساس توان دستگاه شما بهترین جلوه‌ها را انتخاب می‌کند.",
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
  "join.joinCta": "عضویت",
  "join.members": "{count} عضو",
  "join.channelDesc": "کانال رسمی",
  "join.allSet": "همه چیز آماده است!",
  "join.allSetDesc": "عضویت شما تأیید شد. در حال ورود به اپ…",
  "join.verifying": "در حال تأیید عضویت…",
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
  "orders.emptyDesc": "از فروشگاه دیدن کنید و اولین خرید خود را انجام دهید.",
  "orders.emptyAction": "مشاهده فروشگاه",
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
  "adetail.reserveHidden": "این مزایده دارای قیمت رزرو محرمانه است",
  "adetail.minIncrement": "حداقل افزایش",
  "adetail.winnersCount": "تعداد برنده",
  "adetail.endTime": "زمان پایان",
  "adetail.days": "روز",
  "adetail.hours": "ساعت",
  "adetail.mins": "دقیقه",
  "adetail.secs": "ثانیه",
  "adetail.buyNowStat": "خرید فوری",
  "adetail.nextMinBid": "حداقل پیشنهاد بعدی",
  "adetail.finalPrice": "قیمت نهایی",
  "adetail.winner": "برنده",
  "adetail.soldViaBuyNow": "فروخته‌شده با خرید فوری",
  "adetail.overview": "توضیحات",
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
  "watchlist.signInRequired": "برای مشاهده لیست پیگیری، ابتدا وارد حساب کاربری خود شوید.",
  "watchlist.emptyDesc": "مزایده‌های موردعلاقه‌تان را دنبال کنید تا هنگام شروع، باخبر شوید.",
  "watchlist.flashProducts": "محصولات فروشگاه",
  "rewards.title": "باشگاه مشتریان",
  "rewards.subtitle": "امتیاز جمع کن، سطح بگیر و پاداش دریافت کن",
  "rewards.tabMissions": "مأموریت‌ها",
  "rewards.tabBadges": "دستاوردها",
  "rewards.tabHistory": "تاریخچه",
  "rewards.noMissions": "در حال حاضر مأموریت فعالی وجود ندارد",
  "invite.title": "دعوت دوستان",
  "invite.subtitle": "دوستانت را دعوت کن و در سه مرحله پاداش بگیر؛ از عضویت تا هر خرید آن‌ها.",
  "invite.signInRequired": "برای دریافت لینک دعوت، ابتدا وارد حساب کاربری خود شوید.",
  "invite.how": "چطور پاداش می‌گیرم؟",
  "invite.recent": "دعوت‌های اخیر",
  "invite.s1.title": "دوستت عضو می‌شود",
  "invite.s1.desc": "وقتی دوستت با لینک تو وارد ربات شود و عضویت را کامل کند، پاداش اول را می‌گیری.",
  "invite.s2.title": "اولین خرید دوستت",
  "invite.s2.desc": "با نخستین خرید دوستت، هم تو و هم او پاداش ویژه‌ی خرید اول را دریافت می‌کنید.",
  "invite.s3.title": "درآمد دائمی",
  "invite.s3.desc": "از این پس بابت هر خرید دوستت، درصدی اعتبار به‌صورت همیشگی نصیب تو می‌شود.",
  "reports.signInRequired": "برای مشاهده گزارش واریزها، ابتدا وارد حساب کاربری خود شوید.",
  "reports.title": "گزارش واریزها",
  "reports.subtitle": "تاریخچه درخواست‌های شارژ کیف پول و وضعیت بررسی آن‌ها.",
  "reports.empty": "هنوز واریزی ثبت نشده است",
  "reports.emptyDesc": "برای شارژ کیف پول از صفحه کیف پول اقدام کنید.",
  "reports.emptyAction": "شارژ کیف پول",
  "reports.card": "کارت",
  "reports.reference": "کد پیگیری:",
  "support.signInRequired": "برای استفاده از پشتیبانی، ابتدا وارد حساب کاربری خود شوید.",
  "support.title": "پشتیبانی و تیکت‌ها",
  "support.subtitle": "سوال یا مشکلی دارید؟ تیکت بزنید تا بررسی کنیم.",
  "support.empty": "هنوز تیکتی ثبت نکرده‌اید",
  "support.emptyDesc": "اگر سوال یا مشکلی دارید، یک تیکت جدید بسازید تا تیم پشتیبانی بررسی کند.",
  "supportStatus.OPEN": "باز",
  "supportStatus.ANSWERED": "پاسخ داده شد",
  "supportStatus.PENDING": "در انتظار پاسخ",
  "supportStatus.CLOSED": "بسته شده",
  "supportCat.GENERAL": "عمومی",
  "supportCat.PAYMENT": "پرداخت و کیف پول",
  "supportCat.ORDER": "سفارش",
  "supportCat.REFUND": "بازگشت وجه",
  "supportCat.TECHNICAL": "مشکل فنی",
  "depositStatus.PENDING": "در حال بررسی",
  "depositStatus.APPROVED": "تأیید شده",
  "depositStatus.REJECTED": "رد شده",
  "refundStatus.PENDING": "در حال بررسی",
  "refundStatus.APPROVED": "تأیید شده",
  "refundStatus.REJECTED": "رد شده",
  "refundStatus.PAID": "پرداخت شد",
  "refunds.signInRequired": "برای ثبت درخواست بازگشت وجه، ابتدا وارد حساب کاربری خود شوید.",
  "refunds.title": "بازگشت وجه",
  "refunds.subtitle": "اگر تمایل به ادامه همکاری ندارید، می‌توانید موجودی کیف پول خود را به همان کارتی که با آن واریز کرده‌اید بازگردانید.",
  "refunds.notice": "برای جلوگیری از سوءاستفاده، مبلغ فقط به کارتی بازگردانده می‌شود که قبلاً با آن واریز موفق داشته‌اید و مشخصات هویتی (کد ملی و تصویر کارت ملی) باید با صاحب کارت یکی باشد.",
  "refunds.available": "موجودی قابل بازگشت",
  "refunds.amountLabel": "مبلغ بازگشت (تومان)",
  "refunds.amountPlaceholder": "مثلاً ۵۰٬۰۰۰",
  "refunds.fullNameLabel": "نام و نام خانوادگی (مطابق کارت ملی)",
  "refunds.fullNamePlaceholder": "نام کامل صاحب کارت",
  "refunds.nationalIdLabel": "کد ملی",
  "refunds.nationalIdPlaceholder": "۱۰ رقم",
  "refunds.cardLabel": "شماره کارت بانکی مقصد",
  "refunds.ibanLabel": "شماره شبا (اختیاری)",
  "refunds.nationalCardLabel": "تصویر کارت ملی",
  "refunds.nationalCardPick": "انتخاب تصویر کارت ملی",
  "refunds.reasonLabel": "توضیحات (اختیاری)",
  "refunds.reasonPlaceholder": "در صورت تمایل علت درخواست را بنویسید",
  "refunds.submit": "ثبت درخواست بازگشت وجه",
  "refunds.submitting": "در حال ثبت…",
  "refunds.previous": "درخواست‌های قبلی",
  "refunds.empty": "هنوز درخواستی ثبت نکرده‌اید.",
  "refunds.rejectReason": "دلیل رد:",
  "refunds.card": "کارت",
  "refunds.errMinAmount": "حداقل مبلغ بازگشت ۱۰٬۰۰۰ تومان است",
  "refunds.errOverBalance": "مبلغ بیشتر از موجودی قابل استفاده است",
  "refunds.errFullName": "نام و نام خانوادگی را کامل وارد کنید",
  "refunds.errNationalId": "کد ملی باید ۱۰ رقم باشد",
  "refunds.errCard": "شماره کارت باید ۱۶ رقم باشد",
  "refunds.errFile": "بارگذاری تصویر کارت ملی الزامی است",
  "refunds.success": "درخواست بازگشت وجه ثبت شد",
  "refunds.errSubmit": "خطا در ثبت درخواست",
  "ticket.errSend": "خطا در ارسال پیام",
  "ticket.closedToast": "تیکت بسته شد",
  "ticket.errClose": "خطا در بستن تیکت",
  "ticket.back": "بازگشت",
  "ticket.fallbackTitle": "تیکت",
  "ticket.category": "دسته‌بندی:",
  "ticket.viewAttachment": "مشاهده پیوست",
  "ticket.closedNotice": "این تیکت بسته شده است.",
  "ticket.replyPlaceholder": "پاسخ خود را بنویسید…",
  "ticket.attach": "پیوست",
  "ticket.removeAttach": "حذف پیوست",
  "ticket.closeTicket": "بستن تیکت",
  "ticket.send": "ارسال",
  "newTicket.errSubject": "موضوع را کامل‌تر بنویسید",
  "newTicket.errMessage": "متن پیام بسیار کوتاه است",
  "newTicket.success": "تیکت با موفقیت ثبت شد",
  "newTicket.errSubmit": "خطا در ثبت تیکت",
  "newTicket.button": "تیکت جدید",
  "newTicket.title": "ثبت تیکت پشتیبانی",
  "newTicket.category": "دسته‌بندی",
  "newTicket.subject": "موضوع",
  "newTicket.subjectPlaceholder": "مثلاً: مشکل در شارژ کیف پول",
  "newTicket.desc": "شرح درخواست",
  "newTicket.descPlaceholder": "جزئیات مشکل یا درخواست خود را بنویسید…",
  "newTicket.attachOptional": "پیوست (اختیاری)",
  "newTicket.sending": "در حال ارسال…",
  "newTicket.submit": "ارسال تیکت",
  "auth.genericError": "خطایی رخ داد",
  "auth.backToLogin": "بازگشت به ورود",
  "auth.forgotTitle": "بازیابی رمز عبور",
  "auth.forgotDesc": "ایمیل حساب خود را وارد کنید تا لینک بازنشانی رمز عبور برایتان ارسال شود.",
  "auth.forgotSentDesc": "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازنشانی ارسال شد. صندوق ورودی خود را بررسی کنید.",
  "auth.sendResetLink": "ارسال لینک بازنشانی",
  "auth.resetTitle": "تنظیم رمز عبور جدید",
  "auth.resetRedirecting": "در حال انتقال به صفحه ورود…",
  "auth.resetInvalidLink": "لینک بازنشانی نامعتبر است.",
  "auth.requestNewLink": "درخواست لینک جدید",
  "auth.newPasswordPlaceholder": "رمز عبور جدید (حداقل ۸ کاراکتر)",
  "auth.confirmNewPlaceholder": "تکرار رمز عبور جدید",
  "auth.saveNewPassword": "ذخیره رمز عبور جدید",
  "auth.errMinPassword": "رمز عبور باید حداقل ۸ کاراکتر باشد",
  "auth.errPasswordMismatch": "تکرار رمز عبور مطابقت ندارد",
  "auth.resetFailed": "بازنشانی رمز عبور ناموفق بود",
  "verify.working": "در حال تأیید ایمیل…",
  "verify.invalidLink": "لینک تأیید نامعتبر است.",
  "verify.okTitle": "ایمیل شما تأیید شد",
  "verify.okDesc": "اکنون می‌توانید با ایمیل و رمز عبور وارد شوید.",
  "verify.failedTitle": "تأیید ناموفق بود",
  "verify.emailFailed": "تأیید ایمیل ناموفق بود.",
  "verify.backToAccount": "بازگشت به تنظیمات حساب",
  "acctEmail.title": "ایمیل",
  "acctEmail.notSet": "ثبت نشده",
  "acctEmail.verified": "تأیید شده",
  "acctEmail.unverified": "تأیید نشده",
  "acctEmail.pending": "در انتظار تأیید: ",
  "acctEmail.sentNotice": "ایمیل تأیید ارسال شد. صندوق ورودی خود را بررسی کنید.",
  "acctEmail.sendFailed": "ارسال ایمیل تأیید ناموفق بود",
  "acctEmail.errMinPassword": "رمز عبور باید حداقل ۸ کاراکتر باشد",
  "acctEmail.verifiedLocked": "ایمیل شما تأیید شده و قابل تغییر نیست.",
  "acctEmail.choosePassword": "یک رمز عبور انتخاب کنید (حداقل ۸ کاراکتر)",
  "acctEmail.sendVerify": "ارسال ایمیل تأیید",
  "acctEmail.resend": "ارسال مجدد ایمیل تأیید",
  "acctEmail.change": "تغییر",
  "acctPwd.title": "رمز عبور",
  "acctPwd.subtitle": "تغییر رمز عبور حساب",
  "acctPwd.change": "تغییر",
  "acctPwd.success": "رمز عبور با موفقیت تغییر کرد.",
  "acctPwd.errMin": "رمز عبور جدید باید حداقل ۸ کاراکتر باشد",
  "acctPwd.errMismatch": "تکرار رمز عبور مطابقت ندارد",
  "acctPwd.failed": "تغییر رمز عبور ناموفق بود",
  "acctPwd.currentPlaceholder": "رمز عبور فعلی",
  "acctPwd.newPlaceholder": "رمز عبور جدید (حداقل ۸ کاراکتر)",
  "acctPwd.confirmPlaceholder": "تکرار رمز عبور جدید",
  "acctPwd.save": "ذخیره رمز جدید",
  "acctTg.title": "تلگرام",
  "acctTg.connected": "متصل",
  "acctTg.notConnected": "متصل نشده",
  "acctTg.connectedBadge": "متصل",
  "acctTg.linkFailed": "اتصال تلگرام ناموفق بود",
  "acctTg.unlinkFailed": "قطع اتصال تلگرام ناموفق بود",
  "acctTg.unlink": "قطع اتصال تلگرام",
  "acctTg.needOtherMethod": "برای قطع اتصال تلگرام، ابتدا یک ایمیل تأییدشده و رمز عبور تنظیم کنید تا راه ورود دیگری داشته باشید.",
  "acctTg.notAvailable": "اتصال تلگرام در این آدرس فعال نیست.",
  "acctTg.connectAccount": "اتصال حساب تلگرام",
  "common.ended": "پایان یافت",
  "a11y.mainNav": "ناوبری اصلی",
  "a11y.collapseSidebar": "جمع کردن نوار کناری",
  "a11y.expandSidebar": "باز کردن نوار کناری",
  "a11y.openMenu": "باز کردن منو",
  "a11y.closeMenu": "بستن منو",
  "nav.menu": "منو",
  "a11y.supportOnline": "پشتیبانی آنلاین",
  "home.recommended": "پیشنهاد برای شما",
  "flash.followCategoryHint": "با دنبال‌کردن این دسته، هنگام افزودن محصول جدید با صدا مطلع می‌شوید.",
  "signIn.title": "ورود لازم است",
  "signIn.defaultDesc": "برای ادامه، ابتدا وارد حساب کاربری خود شوید.",
  "signIn.action": "ورود به حساب",
  "watch.errUpdate": "خطا در به‌روزرسانی لیست پیگیری",
  "watch.auctionRemoved": "از لیست پیگیری حذف شد",
  "watch.auctionAdded": "به لیست پیگیری اضافه شد؛ هنگام شروع مزایده باخبر می‌شوید",
  "watch.watching": "در حال پیگیری",
  "watch.watchAuction": "پیگیری مزایده",
  "watch.productCancelled": "اطلاع‌رسانی موجودی لغو شد",
  "watch.productAdded": "هنگام موجود شدن محصول به شما اطلاع می‌دهیم",
  "watch.productActive": "اطلاع‌رسانی فعال است",
  "watch.notifyMe": "به من اطلاع بده",
  "watchedProducts.empty": "محصولی را برای اطلاع از موجودی دنبال نمی‌کنید.",
  "watchedProducts.inStock": "موجود",
  "catFollow.unfollowed": "دنبال‌کردن دسته «{category}» لغو شد",
  "catFollow.followed": "از این پس محصولات جدید دسته «{category}» را اطلاع می‌دهیم",
  "catFollow.errUpdate": "خطا در به‌روزرسانی",
  "catFollow.following": "دنبال می‌کنید",
  "catFollow.follow": "دنبال‌کردن دسته",
  "notif.moreCount": "{body} (+{count} اعلان دیگر)",
  "notif.view": "مشاهده",
  "rewards.achievements": "دستاوردها",
  "rewards.earnedOf": "{earned} از {total}",
  "menu.notifications": "اعلان‌ها",
  "menu.notificationsDesc": "آخرین رویدادها",
  "menu.wallet": "کیف پول",
  "menu.walletDesc": "موجودی و شارژ",
  "menu.reports": "گزارش واریزها",
  "menu.reportsDesc": "تاریخچه و وضعیت",
  "menu.support": "تیکت و پشتیبانی",
  "menu.supportDesc": "ثبت و پیگیری درخواست",
  "menu.refunds": "درخواست بازگشت وجه",
  "menu.refundsDesc": "عودت به کارت بانکی",
  "menu.profile": "حساب کاربری",
  "menu.profileDesc": "اطلاعات و تنظیمات",
  "menu.account": "امنیت و ورود",
  "menu.accountDesc": "ایمیل، رمز عبور، تلگرام",
  "menu.admin": "پنل مدیریت",
  "menu.adminDesc": "مدیریت فروشگاه",
  "menu.accountAria": "حساب کاربری",
  "menu.title": "منوی حساب کاربری",
  "menu.unmuteAria": "روشن کردن صدای اعلان",
  "menu.muteAria": "خاموش کردن صدای اعلان",
  "menu.mutedTitle": "صدای اعلان خاموش است",
  "menu.unmutedTitle": "صدای اعلان روشن است",
  "referral.copied": "لینک دعوت کپی شد",
  "referral.copyFailed": "کپی ناموفق بود",
  "referral.shareText": "به جمع ما بپیوند و از مزایده‌ها و فروش ویژه بهره‌مند شو!",
  "referral.shareTitle": "دعوت دوستان",
  "referral.title": "دعوت دوستان",
  "referral.desc": "لینک اختصاصی‌ات را به اشتراک بگذار. با هر دعوت موفق پاداش می‌گیری و از",
  "referral.descEachPurchase": "هر خرید",
  "referral.copyAria": "کپی لینک دعوت",
  "referral.sendTelegram": "ارسال لینک در تلگرام",
  "referral.shareLink": "اشتراک‌گذاری لینک دعوت",
  "referral.statReferred": "دعوت‌شده",
  "referral.statActive": "فعال",
  "referral.statEarned": "درآمد (ت)",
  "txn.DEPOSIT": "افزایش موجودی",
  "txn.WITHDRAWAL": "برداشت",
  "txn.FREEZE": "مسدودسازی",
  "txn.UNFREEZE": "آزادسازی",
  "txn.PURCHASE": "کسر بابت خرید",
  "txn.REFUND": "بازگشت وجه",
  "txn.BID_LOCK": "قفل پیشنهاد",
  "txn.BID_RELEASE": "آزادسازی پیشنهاد",
  "txn.ADMIN_ADJUSTMENT": "تعدیل مدیر",
  "txn.CASHBACK": "بازگشت نقدی",
  "txn.REFERRAL_BONUS": "پاداش دعوت",
  "txn.CONVERSION": "تبدیل ارز",
  "stmt.filterAll": "همه",
  "stmt.purchase": "خرید",
  "stmt.title": "صورت‌حساب",
  "stmt.filter": "فیلتر",
  "stmt.searchPlaceholder": "جستجو در توضیحات یا مرجع...",
  "stmt.txnType": "نوع تراکنش",
  "stmt.fromDate": "از تاریخ",
  "stmt.toDate": "تا تاریخ",
  "stmt.foundCount": "{count} تراکنش یافت شد",
  "stmt.empty": "تراکنشی یافت نشد.",
  "wallet.selectCurrency": "انتخاب ارز",
  "wallet.frozenShort": "مسدودشده",
  "wallet.addFunds": "افزایش موجودی",
  "wallet.yourBalance": "موجودی شما",
  "wallet.recentActivity": "فعالیت‌های اخیر",
  "wallet.noActivity": "هنوز فعالیتی ثبت نشده است",
  "wallet.chooseAmount": "مبلغ را انتخاب کنید",
  "wallet.chooseMethod": "روش پرداخت را انتخاب کنید",
  "wallet.amountTomanLabel": "مبلغ (تومان)",
  "wallet.amountUsdLabel": "مبلغ (دلار)",
  "wallet.methodCard": "کارت به کارت",
  "wallet.methodCardSub": "پرداخت ریالی",
  "wallet.methodUsdt": "تتر (USDT)",
  "wallet.methodTon": "تون (TON)",
  "wallet.methodStars": "تلگرام استارز",
  "wallet.methodStarsSub": "پرداخت آنی در تلگرام",
  "wallet.methodUnavailable": "این روش در حال حاضر در دسترس نیست",
  "wallet.continue": "ادامه",
  "wallet.sendExactly": "دقیقاً این مبلغ را ارسال کنید",
  "wallet.toAddress": "به این آدرس",
  "wallet.toCard": "به این کارت",
  "wallet.cardHolder": "به نام",
  "wallet.network": "شبکه",
  "wallet.transferNote": "کد پیگیری (در توضیحات واریز بنویسید)",
  "wallet.copy": "کپی",
  "wallet.copied": "کپی شد",
  "wallet.uploadReceipt": "بارگذاری رسید پرداخت",
  "wallet.receiptUploaded": "رسید بارگذاری شد",
  "wallet.iPaid": "پرداخت کردم",
  "wallet.cryptoWarning": "حتماً دقیقاً همین مبلغ را ارسال کنید تا تراکنش شما به‌درستی شناسایی شود.",
  "wallet.expiresIn": "زمان باقی‌مانده",
  "wallet.expired": "زمان این درخواست به پایان رسید",
  "wallet.pendingReview": "در حال بررسی توسط مدیر",
  "wallet.payWithStars": "پرداخت با استارز",
  "wallet.starsAmount": "{n} استارز",
  "wallet.depositCreated": "درخواست واریز ثبت شد",
  "wallet.uploading": "در حال بارگذاری…",
  "wallet.back": "بازگشت",
  "wallet.submittedTitle": "درخواست افزایش موجودی دریافت شد",
  "wallet.submittedBody": "درخواست شما با موفقیت ثبت شد. پس از بررسی ادمین، نتیجه‌ی آن در کیف پول شما نمایش داده خواهد شد.",
  "wallet.gotIt": "متوجه شدم",
  "wallet.close": "بستن",
  "wallet.requestsTitle": "درخواست‌های افزایش موجودی",
  "wallet.requestsEmpty": "درخواستی ثبت نشده است.",
  "wallet.statusAwaiting": "در انتظار پرداخت",
  "wallet.statusPending": "در انتظار تأیید ادمین",
  "wallet.statusApproved": "تأیید شد",
  "wallet.statusRejected": "رد شد",
  "wallet.statusExpired": "منقضی شد",
  "wallet.rejectedTitle": "درخواست افزایش موجودی رد شد",
  "wallet.rejectedBody": "متأسفانه درخواست افزایش موجودی شما توسط ادمین رد شد.",
  "wallet.rejectReasonLabel": "دلیل رد درخواست",
  "convert.enterAmount": "مبلغ را وارد کنید",
  "convert.sameCurrency": "ارز مبدأ و مقصد یکسان است",
  "convert.success": "تبدیل ارز با موفقیت انجام شد",
  "convert.error": "خطا در تبدیل ارز",
  "convert.button": "تبدیل ارز",
  "convert.from": "از",
  "convert.to": "به",
  "convert.amountLabel": "مبلغ ({symbol})",
  "convert.amountPlaceholder": "مبلغ",
  "convert.rateUnavailable": "نرخ تبدیل در دسترس نیست",
  "convert.approxReceive": "دریافتی تقریبی",
  "notifList.tabAll": "همه",
  "notifList.tabUnread": "خوانده‌نشده",
  "notifList.tabArchived": "بایگانی",
  "notifList.searchPlaceholder": "جستجو در اعلان‌ها…",
  "notifList.markAll": "خواندن همه",
  "notifList.emptySearch": "اعلانی با این جستجو پیدا نشد",
  "notifList.emptyArchived": "بایگانی شما خالی است",
  "notifList.emptyUnread": "اعلان خوانده‌نشده‌ای نداری",
  "notifList.emptyAll": "هنوز اعلانی ندارید",
  "notifList.emptyAllDesc": "وقتی خبری درباره سفارش‌ها، مزایده‌ها یا تراکنش‌ها باشد، اینجا نمایش داده می‌شود.",
  "notifList.restore": "بازگردانی به صندوق",
  "notifList.delete": "حذف",
  "notifList.archive": "بایگانی",
  "gwStatus.ACTIVE": "در حال ثبت‌نام",
  "gwStatus.SCHEDULED": "به‌زودی",
  "gwStatus.PAUSED": "متوقف",
  "gwStatus.LOCKED": "بسته شد",
  "gwStatus.DRAWING": "در حال قرعه‌کشی",
  "gwStatus.FINISHED": "پایان‌یافته",
  "gw.winnersCount": "{count} برنده",
  "gw.participants": "شرکت‌کننده",
  "gw.startsUntil": "شروع تا",
  "gw.drawn": "قرعه‌کشی شد",
  "gw.drawUntil": "قرعه‌کشی تا",
  "gwd.entered": "شرکت شما ثبت شد! موفق باشی",
  "gwd.joinChannelsFirst": "برای شرکت، اول در کانال‌های زیر عضو شو",
  "gwd.errEnter": "خطا در ثبت شرکت",
  "gwd.startRegUntil": "شروع ثبت‌نام تا",
  "gwd.participants": "شرکت‌کنندگان",
  "gwd.prize": "جایزه",
  "gwd.mustJoin": "برای شرکت باید عضو این کانال‌ها باشی",
  "gwd.afterJoinRetry": "بعد از عضویت، دوباره دکمه شرکت را بزن.",
  "gwd.winners": "برندگان قرعه‌کشی",
  "gwd.noWinners": "برنده‌ای ثبت نشده است.",
  "gwd.alreadyEntered": "شرکت شما ثبت شده است",
  "gwd.notStarted": "ثبت‌نام هنوز شروع نشده است",
  "gwd.regClosed": "ثبت‌نام بسته شده و قرعه‌کشی در راه است",
  "gwd.signInToEnter": "برای شرکت وارد شو",
  "gwd.enter": "شرکت در قرعه‌کشی",
  "bid.minBid": "حداقل پیشنهاد {amount} تومان است",
  "bid.placed": "پیشنهاد شما ثبت شد",
  "bid.errPlace": "خطا در ثبت پیشنهاد",
  "bid.buyNowSuccess": "محصول با خرید فوری برای شما ثبت شد",
  "bid.errBuyNow": "خطا در خرید فوری",
  "bid.notActive": "این مزایده فعال نیست.",
  "bid.amountLabel": "مبلغ پیشنهاد (تومان)",
  "bid.min": "حداقل",
  "bid.submit": "ثبت پیشنهاد",
  "bid.buyNow": "خرید فوری با {amount}",
  "bid.hint": "با ثبت پیشنهاد، تنها اختلاف مبلغ نسبت به پیشنهاد قبلی شما از موجودی مسدود می‌شود.",
  "bid.emptyBalance": "موجودی کیف پول شما صفر است. برای شرکت در مزایده ابتدا حساب خود را شارژ کنید.",
  "bid.insufficient": "موجودی شما {amount} تومان کم است. لطفاً کیف پول خود را شارژ کنید.",
  "bid.needTopUp": "موجودی قابل استفاده کافی نیست. لطفاً کیف پول خود را شارژ کنید.",
  "bid.enableMax": "پیشنهاد خودکار (تعیین سقف)",
  "bid.maxLabel": "حداکثر مبلغ پیشنهاد",
  "bid.maxPlaceholder": "سقف مبلغی که حاضرید بپردازید",
  "bid.maxHint": "سیستم به‌صورت خودکار و فقط به‌اندازهٔ لازم تا این سقف به‌جای شما پیشنهاد می‌دهد. کل مبلغ سقف تا پایان مزایده مسدود می‌شود.",
  "bid.maxTooLow": "سقف پیشنهاد نمی‌تواند کمتر از مبلغ پیشنهاد شما باشد",
  "bid.maxPlaced": "پیشنهاد خودکار شما ثبت شد",
  "auth.errTelegram": "خطا در ورود با تلگرام",
  "auth.forgotLink": "رمز عبور خود را فراموش کرده‌اید؟",
  "forcePwd.errMin": "رمز عبور جدید باید حداقل ۸ کاراکتر باشد",
  "forcePwd.errChange": "تغییر رمز عبور ناموفق بود",
  "forcePwd.title": "تغییر رمز عبور الزامی است",
  "forcePwd.desc": "برای ادامه، لطفاً یک رمز عبور جدید و امن برای حساب خود تنظیم کنید.",
  "forcePwd.currentPlaceholder": "رمز عبور فعلی",
  "forcePwd.save": "ذخیره و ادامه",
  "tgLogin.loading": "در حال بارگذاری ورود تلگرام…",
  "tgLogin.unavailable": "ورود تلگرام در این آدرس فعال نیست",
  "tgLogin.domainNotice": "دامنه‌ی این سایت هنوز در BotFather ثبت نشده است. لطفاً پایین‌تر با ایمیل وارد شوید.",
  "vip.loginStreak": "روز متوالی",
  "vip.usablePoints": "امتیاز قابل استفاده",
  "vip.totalSpend": "مجموع خرید",
  "vip.progressTo": "پیشرفت تا سطح {tier}",
  "vip.pointsProgress": "امتیاز",
  "vip.spendProgress": "خرید",
  "vip.maxTier": "به بالاترین سطح عضویت رسیده‌اید",
  "ptSrc.PURCHASE": "خرید",
  "ptSrc.REFERRAL": "دعوت دوستان",
  "ptSrc.GIVEAWAY_ENTRY": "شرکت در قرعه‌کشی",
  "ptSrc.DAILY_LOGIN": "ورود روزانه",
  "ptSrc.PROFILE_COMPLETE": "تکمیل پروفایل",
  "ptSrc.MISSION_REWARD": "پاداش مأموریت",
  "ptSrc.ACHIEVEMENT": "دستاورد",
  "ptSrc.ADMIN_ADJUSTMENT": "تعدیل مدیریت",
  "ptSrc.REDEEM": "استفاده از امتیاز",
  "points.empty": "هنوز امتیازی ثبت نشده است",
  "missions.pointsReceived": "{points} امتیاز دریافت شد",
  "missions.errClaim": "خطا در دریافت پاداش",
  "missions.claim": "دریافت",
  "missions.daily": "مأموریت‌های روزانه",
  "missions.weekly": "مأموریت‌های هفتگی",
  "refAct.pending": "ثبت‌نام",
  "refAct.joined": "فعال",
  "refAct.purchased": "خرید کرد",
  "refAct.daysAgo": "{count} روز پیش",
  "refAct.hoursAgo": "{count} ساعت پیش",
  "refAct.minutesAgo": "{count} دقیقه پیش",
  "refAct.now": "همین حالا",
  "refAct.empty": "هنوز کسی را دعوت نکرده‌اید.",
  "refAct.emptyDesc": "لینک خود را به اشتراک بگذارید تا اینجا دوستانتان را ببینید.",
}

  const en: Catalog = {
    "nav.profile": "Profile",
    "home.dashboard": "Dashboard",
    "home.servicesTitle": "Services",
    "home.recentTitle": "Recent activity",
    "home.recentEmpty": "No activity yet",
    "home.promoTitle": "Special offer",
    "home.promoBody": "Top up your wallet and unlock exclusive discounts",
    "home.promoCta": "View",
    "home.accountStatus": "Account status",
    "svc.store": "Store",
    "svc.storeDesc": "Subscriptions, accounts & digital goods",
    "svc.auctions": "Auctions",
    "svc.auctionsDesc": "Win products at competitive prices",
    "svc.vps": "VPS Hosting",
    "svc.vpsDesc": "Powerful virtual servers",
    "svc.domains": "Domains",
    "svc.domainsDesc": "Search & register your domain",
    "svc.giveaways": "Giveaways",
    "svc.giveawaysDesc": "Join free giveaways",
    "svc.orders": "Orders",
    "svc.ordersDesc": "Track purchases & delivery",
    "svc.support": "Support",
    "svc.supportDesc": "Chat with our team",
    "svc.rewards": "Rewards",
    "svc.rewardsDesc": "Points, tiers & perks",
    "badge.soon": "Soon",
    "badge.new": "New",
    "badge.hot": "Hot",
    "badge.active": "Active",
    "soon.title": "Coming soon",
    "soon.heading": "This section is coming soon",
    "soon.body": "We're building this feature and it will be added to the platform shortly.",
    "soon.back": "Back to dashboard",
    "vps.title": "VPS Hosting",
    "vps.subtitle": "Powerful, reliable cloud hosting",
    "domains.title": "Domain Registration",
    "domains.subtitle": "Search, price and register your domain",
  "nav.home": "Home",
  "nav.auctions": "Auctions",
  "nav.flash": "Flash Sale",
  "nav.wallet": "Wallet",
  "nav.orders": "Orders",
  "nav.giveaways": "Giveaways",
  "giveaways.title": "Giveaways",
  "giveaways.subtitle": "Join the channels, enter the giveaway, and win",
  "common.toman": "Toman",
  "common.rial": "Rial",
  "common.viewAll": "View all",
  "common.showMore": "Show more",
  "common.showLess": "Show less",
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
  "auctions.nextBid": "Next minimum bid",
  "auctions.finalPrice": "Final price",
  "auctions.startingPrice": "Starting price",
  "auctions.startsAt": "Starts",
  "auctions.sold": "Sold",
  "auctions.endingSoon": "Ending soon",
  "auctions.reserveNotMetShort": "Reserve not met",
  "auctions.stampSold": "SOLD",
  "auctions.stampEnded": "ENDED",
  "auctions.stampUnsold": "UNSOLD",
  "auctions.stampCancelled": "CANCELLED",
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
  "plan.choose": "Choose your plan",
  "plan.compare": "Compare plans",
  "plan.selected": "Selected",
  "plan.from": "From",
  "plan.each": "each",
  "plan.perDevice": "device",
  "plan.feature.duration": "Duration",
  "plan.feature.devices": "Devices",
  "plan.feature.accountType": "Account type",
  "plan.feature.credentials": "Change password",
  "plan.feature.twoFactor": "Two-factor auth",
  "plan.feature.warranty": "Warranty",
  "plan.value.private": "Private",
  "plan.value.shared": "Shared",
  "plan.value.yes": "Yes",
  "plan.value.no": "No",
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
  "bid.emptyBalance": "Your wallet is empty. Please top up your balance to place a bid.",
  "bid.insufficient": "You need {amount} more Toman for this bid. Please top up your wallet.",
  "bid.needTopUp": "Your available balance is not enough. Please top up your wallet.",
  "bid.enableMax": "Automatic bidding (set a maximum)",
  "bid.maxLabel": "Maximum bid amount",
  "bid.maxPlaceholder": "The most you are willing to pay",
  "bid.maxHint": "We bid automatically on your behalf, only as much as needed, up to this limit. The full maximum is held until the auction ends.",
  "bid.maxTooLow": "Your maximum cannot be lower than your bid",
  "bid.maxPlaced": "Your automatic bid was placed",
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
  "banned.title": "Your account is blocked",
  "banned.message": "You have been blocked and can no longer access the services of this bot.",
  "banned.logout": "Log out",
  "profile.title": "My profile",
  "profile.account": "Account",
  "profile.telegram": "Telegram",
  "profile.email": "Email",
  "profile.role": "Role",
  "profile.notLinked": "Not linked",
  "profile.language": "Language",
  "profile.motion": "Motion quality",
  "motion.choose": "Choose motion quality",
  "motion.auto": "Auto",
  "motion.cinematic": "Cinematic",
  "motion.balanced": "Balanced",
  "motion.minimal": "Minimal",
  "motion.hint": "Auto picks the best effects for your device's performance.",
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
  "join.joinCta": "Join",
  "join.members": "{count} members",
  "join.channelDesc": "Official channel",
  "join.allSet": "You're all set!",
  "join.allSetDesc": "Your membership is verified. Taking you in…",
  "join.verifying": "Verifying membership…",
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
  "adetail.reserveHidden": "This auction has a confidential reserve price",
  "adetail.minIncrement": "Min. increment",
  "adetail.winnersCount": "Winners",
  "adetail.endTime": "End time",
  "adetail.days": "days",
  "adetail.hours": "hrs",
  "adetail.mins": "min",
  "adetail.secs": "sec",
  "adetail.buyNowStat": "Buy now",
  "adetail.nextMinBid": "Next minimum bid",
  "adetail.finalPrice": "Final price",
  "adetail.winner": "Winner",
  "adetail.soldViaBuyNow": "Sold via Buy Now",
  "adetail.overview": "Overview",
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
  "watchlist.signInRequired": "Sign in to view your watchlist.",
  "watchlist.emptyDesc": "Follow your favorite auctions to be notified when they start.",
  "watchlist.flashProducts": "Flash sale products",
  "rewards.title": "Rewards club",
  "rewards.subtitle": "Earn points, level up and get rewards",
  "rewards.tabMissions": "Missions",
  "rewards.tabBadges": "Achievements",
  "rewards.tabHistory": "History",
  "rewards.noMissions": "No active missions right now",
  "invite.title": "Invite friends",
  "invite.subtitle": "Invite your friends and earn rewards in three stages — from sign-up to every purchase.",
  "invite.signInRequired": "Sign in to get your invite link.",
  "invite.how": "How do I earn rewards?",
  "invite.recent": "Recent invites",
  "invite.s1.title": "Your friend signs up",
  "invite.s1.desc": "When your friend joins the bot with your link and completes sign-up, you get the first reward.",
  "invite.s2.title": "Your friend's first purchase",
  "invite.s2.desc": "On your friend's first purchase, both of you receive a special first-purchase reward.",
  "invite.s3.title": "Lifetime earnings",
  "invite.s3.desc": "From then on, you earn a percentage of credit on every purchase your friend makes.",
  "reports.signInRequired": "Sign in to view your deposit reports.",
  "reports.title": "Deposit reports",
  "reports.subtitle": "History of your wallet top-up requests and their review status.",
  "reports.empty": "No deposits yet",
  "reports.emptyDesc": "Head to the wallet page to top up your balance.",
  "reports.emptyAction": "Top up wallet",
  "reports.card": "Card",
  "reports.reference": "Reference:",
  "support.signInRequired": "Sign in to use support.",
  "support.title": "Support & tickets",
  "support.subtitle": "Got a question or issue? Open a ticket and we'll look into it.",
  "support.empty": "No tickets yet",
  "support.emptyDesc": "If you have a question or issue, create a new ticket for the support team to review.",
  "supportStatus.OPEN": "Open",
  "supportStatus.ANSWERED": "Answered",
  "supportStatus.PENDING": "Awaiting reply",
  "supportStatus.CLOSED": "Closed",
  "supportCat.GENERAL": "General",
  "supportCat.PAYMENT": "Payment & wallet",
  "supportCat.ORDER": "Order",
  "supportCat.REFUND": "Refund",
  "supportCat.TECHNICAL": "Technical issue",
  "depositStatus.PENDING": "Under review",
  "depositStatus.APPROVED": "Approved",
  "depositStatus.REJECTED": "Rejected",
  "refundStatus.PENDING": "Under review",
  "refundStatus.APPROVED": "Approved",
  "refundStatus.REJECTED": "Rejected",
  "refundStatus.PAID": "Paid",
  "refunds.signInRequired": "Sign in to submit a refund request.",
  "refunds.title": "Refund",
  "refunds.subtitle": "If you no longer wish to continue, you can return your wallet balance to the same card you deposited from.",
  "refunds.notice": "To prevent abuse, the amount is returned only to a card you've previously made a successful deposit with, and the identity details (national ID and ID card photo) must match the card holder.",
  "refunds.available": "Refundable balance",
  "refunds.amountLabel": "Refund amount (Toman)",
  "refunds.amountPlaceholder": "e.g. 50,000",
  "refunds.fullNameLabel": "Full name (as on national ID)",
  "refunds.fullNamePlaceholder": "Card holder's full name",
  "refunds.nationalIdLabel": "National ID",
  "refunds.nationalIdPlaceholder": "10 digits",
  "refunds.cardLabel": "Destination bank card number",
  "refunds.ibanLabel": "IBAN (optional)",
  "refunds.nationalCardLabel": "National ID card photo",
  "refunds.nationalCardPick": "Choose national ID card photo",
  "refunds.reasonLabel": "Notes (optional)",
  "refunds.reasonPlaceholder": "Optionally write the reason for your request",
  "refunds.submit": "Submit refund request",
  "refunds.submitting": "Submitting…",
  "refunds.previous": "Previous requests",
  "refunds.empty": "You haven't submitted any request yet.",
  "refunds.rejectReason": "Rejection reason:",
  "refunds.card": "Card",
  "refunds.errMinAmount": "The minimum refund amount is 10,000 Toman",
  "refunds.errOverBalance": "The amount exceeds your available balance",
  "refunds.errFullName": "Enter your full name",
  "refunds.errNationalId": "National ID must be 10 digits",
  "refunds.errCard": "Card number must be 16 digits",
  "refunds.errFile": "Uploading the national ID card photo is required",
  "refunds.success": "Refund request submitted",
  "refunds.errSubmit": "Failed to submit request",
  "ticket.errSend": "Failed to send message",
  "ticket.closedToast": "Ticket closed",
  "ticket.errClose": "Failed to close ticket",
  "ticket.back": "Back",
  "ticket.fallbackTitle": "Ticket",
  "ticket.category": "Category:",
  "ticket.viewAttachment": "View attachment",
  "ticket.closedNotice": "This ticket is closed.",
  "ticket.replyPlaceholder": "Write your reply…",
  "ticket.attach": "Attach",
  "ticket.removeAttach": "Remove attachment",
  "ticket.closeTicket": "Close ticket",
  "ticket.send": "Send",
  "newTicket.errSubject": "Please write a more complete subject",
  "newTicket.errMessage": "The message is too short",
  "newTicket.success": "Ticket created successfully",
  "newTicket.errSubmit": "Failed to create ticket",
  "newTicket.button": "New ticket",
  "newTicket.title": "Create support ticket",
  "newTicket.category": "Category",
  "newTicket.subject": "Subject",
  "newTicket.subjectPlaceholder": "e.g. Issue topping up wallet",
  "newTicket.desc": "Request details",
  "newTicket.descPlaceholder": "Write the details of your issue or request…",
  "newTicket.attachOptional": "Attachment (optional)",
  "newTicket.sending": "Sending…",
  "newTicket.submit": "Send ticket",
  "auth.genericError": "Something went wrong",
  "auth.backToLogin": "Back to login",
  "auth.forgotTitle": "Reset password",
  "auth.forgotDesc": "Enter your account email and we'll send you a password reset link.",
  "auth.forgotSentDesc": "If an account exists with this email, a reset link has been sent. Check your inbox.",
  "auth.sendResetLink": "Send reset link",
  "auth.resetTitle": "Set a new password",
  "auth.resetRedirecting": "Redirecting to login…",
  "auth.resetInvalidLink": "This reset link is invalid.",
  "auth.requestNewLink": "Request a new link",
  "auth.newPasswordPlaceholder": "New password (at least 8 characters)",
  "auth.confirmNewPlaceholder": "Confirm new password",
  "auth.saveNewPassword": "Save new password",
  "auth.errMinPassword": "Password must be at least 8 characters",
  "auth.errPasswordMismatch": "Passwords do not match",
  "auth.resetFailed": "Failed to reset password",
  "verify.working": "Verifying email…",
  "verify.invalidLink": "This verification link is invalid.",
  "verify.okTitle": "Your email is verified",
  "verify.okDesc": "You can now sign in with your email and password.",
  "verify.failedTitle": "Verification failed",
  "verify.emailFailed": "Email verification failed.",
  "verify.backToAccount": "Back to account settings",
  "acctEmail.title": "Email",
  "acctEmail.notSet": "Not set",
  "acctEmail.verified": "Verified",
  "acctEmail.unverified": "Unverified",
  "acctEmail.pending": "Awaiting confirmation: ",
  "acctEmail.sentNotice": "Verification email sent. Check your inbox.",
  "acctEmail.sendFailed": "Failed to send verification email",
  "acctEmail.errMinPassword": "Password must be at least 8 characters",
  "acctEmail.verifiedLocked": "Your email is verified and cannot be changed.",
  "acctEmail.choosePassword": "Choose a password (at least 8 characters)",
  "acctEmail.sendVerify": "Send verification email",
  "acctEmail.resend": "Resend verification email",
  "acctEmail.change": "Change",
  "acctPwd.title": "Password",
  "acctPwd.subtitle": "Change your account password",
  "acctPwd.change": "Change",
  "acctPwd.success": "Password changed successfully.",
  "acctPwd.errMin": "New password must be at least 8 characters",
  "acctPwd.errMismatch": "Passwords do not match",
  "acctPwd.failed": "Failed to change password",
  "acctPwd.currentPlaceholder": "Current password",
  "acctPwd.newPlaceholder": "New password (at least 8 characters)",
  "acctPwd.confirmPlaceholder": "Confirm new password",
  "acctPwd.save": "Save new password",
  "acctTg.title": "Telegram",
  "acctTg.connected": "Connected",
  "acctTg.notConnected": "Not connected",
  "acctTg.connectedBadge": "Connected",
  "acctTg.linkFailed": "Failed to link Telegram",
  "acctTg.unlinkFailed": "Failed to unlink Telegram",
  "acctTg.unlink": "Unlink Telegram",
  "acctTg.needOtherMethod": "To unlink Telegram, first set a verified email and password so you have another way to sign in.",
  "acctTg.notAvailable": "Telegram login is not available on this domain.",
  "acctTg.connectAccount": "Connect Telegram account",
  "common.ended": "Ended",
  "a11y.mainNav": "Main navigation",
  "a11y.collapseSidebar": "Collapse sidebar",
  "a11y.expandSidebar": "Expand sidebar",
  "a11y.openMenu": "Open menu",
  "a11y.closeMenu": "Close menu",
  "nav.menu": "Menu",
  "a11y.supportOnline": "Online support",
  "home.recommended": "Recommended for you",
  "flash.followCategoryHint": "Follow this category to get a sound alert when a new product is added.",
  "signIn.title": "Sign-in required",
  "signIn.defaultDesc": "Please sign in to your account to continue.",
  "signIn.action": "Sign in to account",
  "watch.errUpdate": "Failed to update watchlist",
  "watch.auctionRemoved": "Removed from watchlist",
  "watch.auctionAdded": "Added to watchlist; you'll be notified when the auction starts",
  "watch.watching": "Watching",
  "watch.watchAuction": "Watch auction",
  "watch.productCancelled": "Stock alert cancelled",
  "watch.productAdded": "We'll notify you when the product is back in stock",
  "watch.productActive": "Alert is active",
  "watch.notifyMe": "Notify me",
  "watchedProducts.empty": "You aren't following any products for stock alerts.",
  "watchedProducts.inStock": "In stock",
  "catFollow.unfollowed": "Unfollowed the \u201c{category}\u201d category",
  "catFollow.followed": "We'll now notify you about new products in \u201c{category}\u201d",
  "catFollow.errUpdate": "Failed to update",
  "catFollow.following": "Following",
  "catFollow.follow": "Follow category",
  "notif.moreCount": "{body} (+{count} more)",
  "notif.view": "View",
  "rewards.achievements": "Achievements",
  "rewards.earnedOf": "{earned} of {total}",
  "menu.notifications": "Notifications",
  "menu.notificationsDesc": "Latest events",
  "menu.wallet": "Wallet",
  "menu.walletDesc": "Balance and top-up",
  "menu.reports": "Deposit reports",
  "menu.reportsDesc": "History and status",
  "menu.support": "Tickets and support",
  "menu.supportDesc": "Submit and track requests",
  "menu.refunds": "Refund request",
  "menu.refundsDesc": "Return to bank card",
  "menu.profile": "Account",
  "menu.profileDesc": "Info and settings",
  "menu.account": "Security and login",
  "menu.accountDesc": "Email, password, Telegram",
  "menu.admin": "Admin panel",
  "menu.adminDesc": "Manage the store",
  "menu.accountAria": "Account",
  "menu.title": "Account menu",
  "menu.unmuteAria": "Turn on notification sound",
  "menu.muteAria": "Turn off notification sound",
  "menu.mutedTitle": "Notification sound is off",
  "menu.unmutedTitle": "Notification sound is on",
  "referral.copied": "Invite link copied",
  "referral.copyFailed": "Copy failed",
  "referral.shareText": "Join us and enjoy auctions and special sales!",
  "referral.shareTitle": "Invite friends",
  "referral.title": "Invite friends",
  "referral.desc": "Share your personal link. Earn a reward for every successful invite, plus ongoing credit from",
  "referral.descEachPurchase": "every purchase",
  "referral.copyAria": "Copy invite link",
  "referral.sendTelegram": "Send link on Telegram",
  "referral.shareLink": "Share invite link",
  "referral.statReferred": "Referred",
  "referral.statActive": "Active",
  "referral.statEarned": "Earned (T)",
  "txn.DEPOSIT": "Top-up",
  "txn.WITHDRAWAL": "Withdrawal",
  "txn.FREEZE": "Freeze",
  "txn.UNFREEZE": "Unfreeze",
  "txn.PURCHASE": "Purchase deduction",
  "txn.REFUND": "Refund",
  "txn.BID_LOCK": "Bid lock",
  "txn.BID_RELEASE": "Bid release",
  "txn.ADMIN_ADJUSTMENT": "Admin adjustment",
  "txn.CASHBACK": "Cashback",
  "txn.REFERRAL_BONUS": "Referral bonus",
  "txn.CONVERSION": "Currency conversion",
  "stmt.filterAll": "All",
  "stmt.purchase": "Purchase",
  "stmt.title": "Statement",
  "stmt.filter": "Filter",
  "stmt.searchPlaceholder": "Search in notes or reference...",
  "stmt.txnType": "Transaction type",
  "stmt.fromDate": "From date",
  "stmt.toDate": "To date",
  "stmt.foundCount": "{count} transactions found",
  "stmt.empty": "No transactions found.",
  "wallet.selectCurrency": "Select currency",
  "wallet.frozenShort": "Frozen",
  "wallet.addFunds": "Add funds",
  "wallet.yourBalance": "Your balance",
  "wallet.recentActivity": "Recent activity",
  "wallet.noActivity": "No activity yet",
  "wallet.chooseAmount": "Choose an amount",
  "wallet.chooseMethod": "Choose a payment method",
  "wallet.amountTomanLabel": "Amount (Toman)",
  "wallet.amountUsdLabel": "Amount (USD)",
  "wallet.methodCard": "Card transfer",
  "wallet.methodCardSub": "Pay in Toman",
  "wallet.methodUsdt": "Tether (USDT)",
  "wallet.methodTon": "Toncoin (TON)",
  "wallet.methodStars": "Telegram Stars",
  "wallet.methodStarsSub": "Instant in-app payment",
  "wallet.methodUnavailable": "This method is currently unavailable",
  "wallet.continue": "Continue",
  "wallet.sendExactly": "Send exactly this amount",
  "wallet.toAddress": "To this address",
  "wallet.toCard": "To this card",
  "wallet.cardHolder": "Holder",
  "wallet.network": "Network",
  "wallet.transferNote": "Reference code (add to transfer note)",
  "wallet.copy": "Copy",
  "wallet.copied": "Copied",
  "wallet.uploadReceipt": "Upload payment receipt",
  "wallet.receiptUploaded": "Receipt uploaded",
  "wallet.iPaid": "I've paid",
  "wallet.cryptoWarning": "Send the exact amount so your transfer can be matched correctly.",
  "wallet.expiresIn": "Time left",
  "wallet.expired": "This request has expired",
  "wallet.pendingReview": "Pending admin review",
  "wallet.payWithStars": "Pay with Stars",
  "wallet.starsAmount": "{n} Stars",
  "wallet.depositCreated": "Top-up request created",
  "wallet.uploading": "Uploading…",
  "wallet.back": "Back",
  "wallet.submittedTitle": "Top-up request received",
  "wallet.submittedBody": "Your request was submitted successfully. Once an admin reviews it, the result will appear in your wallet.",
  "wallet.gotIt": "Got it",
  "wallet.close": "Close",
  "wallet.requestsTitle": "Top-up requests",
  "wallet.requestsEmpty": "No requests yet.",
  "wallet.statusAwaiting": "Awaiting payment",
  "wallet.statusPending": "Pending admin review",
  "wallet.statusApproved": "Approved",
  "wallet.statusRejected": "Rejected",
  "wallet.statusExpired": "Expired",
  "wallet.rejectedTitle": "Top-up request rejected",
  "wallet.rejectedBody": "Unfortunately your top-up request was rejected by an admin.",
  "wallet.rejectReasonLabel": "Reason for rejection",
  "convert.enterAmount": "Enter an amount",
  "convert.sameCurrency": "Source and target currency are the same",
  "convert.success": "Currency converted successfully",
  "convert.error": "Error converting currency",
  "convert.button": "Convert currency",
  "convert.from": "From",
  "convert.to": "To",
  "convert.amountLabel": "Amount ({symbol})",
  "convert.amountPlaceholder": "Amount",
  "convert.rateUnavailable": "Conversion rate unavailable",
  "convert.approxReceive": "Approx. received",
  "notifList.tabAll": "All",
  "notifList.tabUnread": "Unread",
  "notifList.tabArchived": "Archived",
  "notifList.searchPlaceholder": "Search notifications…",
  "notifList.markAll": "Mark all read",
  "notifList.emptySearch": "No notifications match this search",
  "notifList.emptyArchived": "Your archive is empty",
  "notifList.emptyUnread": "You have no unread notifications",
  "notifList.emptyAll": "You have no notifications yet",
  "notifList.emptyAllDesc": "When there's news about orders, auctions, or transactions, it will appear here.",
  "notifList.restore": "Restore to inbox",
  "notifList.delete": "Delete",
  "notifList.archive": "Archive",
  "gwStatus.ACTIVE": "Active",
  "gwStatus.SCHEDULED": "Scheduled",
  "gwStatus.PAUSED": "Paused",
  "gwStatus.LOCKED": "Locked",
  "gwStatus.DRAWING": "Drawing",
  "gwStatus.FINISHED": "Finished",
  "gw.winnersCount": "{count} winners",
  "gw.participants": "Participants",
  "gw.startsUntil": "Starts in",
  "gw.drawn": "Drawn",
  "gw.drawUntil": "Draw in",
  "gwd.entered": "You have entered the giveaway",
  "gwd.joinChannelsFirst": "Please join the required channels first",
  "gwd.errEnter": "Error entering the giveaway",
  "gwd.startRegUntil": "Registration starts in",
  "gwd.participants": "Participants",
  "gwd.prize": "Prize",
  "gwd.mustJoin": "You must join these channels",
  "gwd.afterJoinRetry": "After joining, tap enter again",
  "gwd.winners": "Winners",
  "gwd.noWinners": "No winners announced yet",
  "gwd.alreadyEntered": "You have already entered",
  "gwd.notStarted": "Not started yet",
  "gwd.regClosed": "Registration closed",
  "gwd.signInToEnter": "Sign in to enter",
  "gwd.enter": "Enter giveaway",
  "bid.minBid": "Minimum bid is {amount} Toman",
  "bid.placed": "Your bid was placed",
  "bid.errPlace": "Error placing bid",
  "bid.buyNowSuccess": "Purchase successful",
  "bid.errBuyNow": "Error with instant purchase",
  "bid.notActive": "This auction is not active",
  "bid.amountLabel": "Bid amount (Toman)",
  "bid.min": "Minimum",
  "bid.submit": "Place bid",
  "bid.buyNow": "Buy now for {amount}",
  "bid.hint": "The bid amount is locked in your wallet until the auction ends.",
  "auth.errTelegram": "Telegram login failed",
  "auth.forgotLink": "Forgot your password?",
  "forcePwd.errMin": "Password must be at least 8 characters",
  "forcePwd.errChange": "Error changing password",
  "forcePwd.title": "Change your password",
  "forcePwd.desc": "For your security, please set a new password.",
  "forcePwd.currentPlaceholder": "Current password",
  "forcePwd.save": "Save new password",
  "tgLogin.loading": "Loading…",
  "tgLogin.unavailable": "Telegram login unavailable",
  "tgLogin.domainNotice": "This feature is only available inside Telegram.",
  "vip.loginStreak": "Login streak (days)",
  "vip.usablePoints": "Usable points",
  "vip.totalSpend": "Total spend",
  "vip.progressTo": "Progress to {tier}",
  "vip.pointsProgress": "Points",
  "vip.spendProgress": "Spend",
  "vip.maxTier": "You've reached the highest tier",
  "ptSrc.PURCHASE": "Purchase",
  "ptSrc.REFERRAL": "Referral",
  "ptSrc.GIVEAWAY_ENTRY": "Giveaway entry",
  "ptSrc.DAILY_LOGIN": "Daily login",
  "ptSrc.PROFILE_COMPLETE": "Profile completed",
  "ptSrc.MISSION_REWARD": "Mission reward",
  "ptSrc.ACHIEVEMENT": "Achievement",
  "ptSrc.ADMIN_ADJUSTMENT": "Admin adjustment",
  "ptSrc.REDEEM": "Redeem",
  "points.empty": "No points history yet.",
  "missions.pointsReceived": "{points} points received",
  "missions.errClaim": "Error claiming reward",
  "missions.claim": "Claim",
  "missions.daily": "Daily",
  "missions.weekly": "Weekly",
  "refAct.pending": "Pending",
  "refAct.joined": "Joined",
  "refAct.purchased": "Purchased",
  "refAct.daysAgo": "{count} days ago",
  "refAct.hoursAgo": "{count} hours ago",
  "refAct.minutesAgo": "{count} minutes ago",
  "refAct.now": "Just now",
  "refAct.empty": "No referrals yet",
  "refAct.emptyDesc": "When you invite friends, their activity will appear here.",
}

  const ru: Catalog = {
    "nav.profile": "Профиль",
    "home.dashboard": "Панель",
    "home.servicesTitle": "Сервисы",
    "home.recentTitle": "Недавняя активность",
    "home.recentEmpty": "Пока нет активности",
    "home.promoTitle": "Спецпредложение",
    "home.promoBody": "Пополните кошелёк и получите эксклюзивные скидки",
    "home.promoCta": "Смотреть",
    "home.accountStatus": "Статус аккаунта",
    "svc.store": "Магазин",
    "svc.storeDesc": "Подписки, аккаунты и цифровые товары",
    "svc.auctions": "Аукционы",
    "svc.auctionsDesc": "Выигрывайте товары по выгодным ценам",
    "svc.vps": "VPS-хостинг",
    "svc.vpsDesc": "Мощные виртуальные серверы",
    "svc.domains": "Домены",
    "svc.domainsDesc": "Поиск и регистрация домена",
    "svc.giveaways": "Розыгрыши",
    "svc.giveawaysDesc": "Участвуйте в бесплатных розыгрышах",
    "svc.orders": "Заказы",
    "svc.ordersDesc": "Отслеживание покупок и доставки",
    "svc.support": "Поддержка",
    "svc.supportDesc": "Чат с нашей командой",
    "svc.rewards": "Бонусы",
    "svc.rewardsDesc": "Баллы, уровни и привилегии",
    "badge.soon": "Скоро",
    "badge.new": "Новое",
    "badge.hot": "Хит",
    "badge.active": "Активно",
    "soon.title": "Скоро",
    "soon.heading": "Этот раздел скоро появится",
    "soon.body": "Мы разрабатываем эту функцию, и скоро она появится на платформе.",
    "soon.back": "На панель",
    "vps.title": "VPS-хостинг",
    "vps.subtitle": "Мощный и надёжный облачный хостинг",
    "domains.title": "Регистрация домена",
    "domains.subtitle": "Поиск, цена и регистрация вашего домена",
  "nav.home": "Главная",
  "nav.auctions": "Аукционы",
  "nav.flash": "Распродажа",
  "nav.wallet": "Кошелёк",
  "nav.orders": "Заказы",
  "nav.giveaways": "Розыгрыши",
  "giveaways.title": "Розыгрыши",
  "giveaways.subtitle": "Подпишитесь на каналы, участвуйте в розыгрыше и выигрывайте",
  "common.toman": "Туман",
  "common.rial": "Риал",
  "common.viewAll": "Все",
  "common.showMore": "Показать больше",
  "common.showLess": "Свернуть",
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
  "auctions.nextBid": "Следующая мин. ставка",
  "auctions.finalPrice": "Итоговая цена",
  "auctions.startingPrice": "Стартовая цена",
  "auctions.startsAt": "Начало",
  "auctions.sold": "Продано",
  "auctions.endingSoon": "Скоро завершится",
  "auctions.reserveNotMetShort": "Резерв не достигнут",
  "auctions.stampSold": "ПРОДАНО",
  "auctions.stampEnded": "ЗАВЕРШЁН",
  "auctions.stampUnsold": "НЕ ПРОДАНО",
  "auctions.stampCancelled": "ОТМЕНЁН",
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
  "plan.choose": "Выберите тариф",
  "plan.compare": "Сравнить тарифы",
  "plan.selected": "Выбрано",
  "plan.from": "От",
  "plan.each": "за шт.",
  "plan.perDevice": "устройство",
  "plan.feature.duration": "Срок",
  "plan.feature.devices": "Устройства",
  "plan.feature.accountType": "Тип аккаунта",
  "plan.feature.credentials": "Смена пароля",
  "plan.feature.twoFactor": "Двухфакторная аутентификация",
  "plan.feature.warranty": "Гарантия",
  "plan.value.private": "Личный",
  "plan.value.shared": "Общий",
  "plan.value.yes": "Да",
  "plan.value.no": "Нет",
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
  "bid.emptyBalance": "Ваш кошелёк пуст. Пополните баланс, чтобы сделать ставку.",
  "bid.insufficient": "Не хватает {amount} томан для этой ставки. Пополните кошелёк.",
  "bid.needTopUp": "Недостаточно доступных средств. Пожалуйста, пополните кошелёк.",
  "bid.enableMax": "Автоматическая ставка (задать максимум)",
  "bid.maxLabel": "Максимальная сумма ставки",
  "bid.maxPlaceholder": "Максимум, который вы готовы заплатить",
  "bid.maxHint": "Система делает ставки за вас автоматически, только в необходимом размере, вплоть до этого предела. Вся максимальная сумма замораживается до конца аукциона.",
  "bid.maxTooLow": "Максимум не может быть меньше вашей ставки",
  "bid.maxPlaced": "Ваша автоматическая ставка принята",
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
  "banned.title": "Ваш аккаунт заблокирован",
  "banned.message": "Вы были заблокированы и больше не можете пользоваться услугами этого бота.",
  "banned.logout": "Выйти",
  "profile.title": "Мой профиль",
  "profile.account": "Аккаунт",
  "profile.telegram": "Telegram",
  "profile.email": "Эл. почта",
  "profile.role": "Роль",
  "profile.notLinked": "Не привязан",
  "profile.language": "Язык",
  "profile.motion": "Качество анимаций",
  "motion.choose": "Выбрать качество анимаций",
  "motion.auto": "Авто",
  "motion.cinematic": "Кинематографичное",
  "motion.balanced": "Сбалансированное",
  "motion.minimal": "Минимальное",
  "motion.hint": "В режиме «Авто» эффекты подбираются под производительность устройства.",
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
  "join.joinCta": "Подписаться",
  "join.members": "{count} подписчиков",
  "join.channelDesc": "Официальный канал",
  "join.allSet": "Всё готово!",
  "join.allSetDesc": "Подписка подтверждена. Входим…",
  "join.verifying": "Проверка подписки…",
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
  "adetail.reserveHidden": "У этого аукциона есть конфиденциальная резервная цена",
  "adetail.minIncrement": "Мин. шаг",
  "adetail.winnersCount": "Победителей",
  "adetail.endTime": "Время окончания",
  "adetail.days": "дн",
  "adetail.hours": "ч",
  "adetail.mins": "мин",
  "adetail.secs": "сек",
  "adetail.buyNowStat": "Купить сейчас",
  "adetail.nextMinBid": "Следующая мин. ставка",
  "adetail.finalPrice": "Итоговая цена",
  "adetail.winner": "Победитель",
  "adetail.soldViaBuyNow": "Продано через «Купить сейчас»",
  "adetail.overview": "Описание",
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
  "watchlist.signInRequired": "Войдите, чтобы увидеть список отслеживания.",
  "watchlist.emptyDesc": "Следите за любимыми аукционами, чтобы получить уведомление о старте.",
  "watchlist.flashProducts": "Товары распродажи",
  "rewards.title": "Клуб лояльности",
  "rewards.subtitle": "Зарабатывайте баллы, повышайте уровень и получайте награды",
  "rewards.tabMissions": "Задания",
  "rewards.tabBadges": "Достижения",
  "rewards.tabHistory": "История",
  "rewards.noMissions": "Сейчас нет активных заданий",
  "invite.title": "Пригласить друзей",
  "invite.subtitle": "Приглашайте друзей и получайте награды на трёх этапах — от регистрации до каждой покупки.",
  "invite.signInRequired": "Войдите, чтобы получить ссылку-приглашение.",
  "invite.how": "Как я получаю награды?",
  "invite.recent": "Недавние приглашения",
  "invite.s1.title": "Ваш друг регистрируется",
  "invite.s1.desc": "Когда друг переходит в бота по вашей ссылке и завершает регистрацию, вы получаете первую награду.",
  "invite.s2.title": "Первая покупка друга",
  "invite.s2.desc": "При первой покупке друга вы оба получаете особую награду за первую покупку.",
  "invite.s3.title": "Постоянный доход",
  "invite.s3.desc": "С этого момента вы получаете процент от каждой покупки вашего друга в виде кредита.",
  "reports.signInRequired": "Войдите, чтобы увидеть отчёты о пополнениях.",
  "reports.title": "Отчёты о пополнениях",
  "reports.subtitle": "История ваших запросов на пополнение кошелька и их статус проверки.",
  "reports.empty": "Пополнений пока нет",
  "reports.emptyDesc": "Перейдите на страницу кошелька, чтобы пополнить баланс.",
  "reports.emptyAction": "Пополнить кошелёк",
  "reports.card": "Карта",
  "reports.reference": "Код:",
  "support.signInRequired": "Войдите, чтобы воспользоваться поддержкой.",
  "support.title": "Поддержка и обращения",
  "support.subtitle": "Есть вопрос или проблема? Создайте обращение, и мы разберёмся.",
  "support.empty": "Обращений пока нет",
  "support.emptyDesc": "Если у вас есть вопрос или проблема, создайте новое обращение для команды поддержки.",
  "supportStatus.OPEN": "Открыто",
  "supportStatus.ANSWERED": "Отвечено",
  "supportStatus.PENDING": "Ожидает ответа",
  "supportStatus.CLOSED": "Закрыто",
  "supportCat.GENERAL": "Общее",
  "supportCat.PAYMENT": "Оплата и кошелёк",
  "supportCat.ORDER": "Заказ",
  "supportCat.REFUND": "Возврат средств",
  "supportCat.TECHNICAL": "Техническая проблема",
  "depositStatus.PENDING": "На проверке",
  "depositStatus.APPROVED": "Подтверждено",
  "depositStatus.REJECTED": "Отклонено",
  "refundStatus.PENDING": "На проверке",
  "refundStatus.APPROVED": "Подтверждено",
  "refundStatus.REJECTED": "Отклонено",
  "refundStatus.PAID": "Выплачено",
  "refunds.signInRequired": "Войдите, чтобы подать запрос на возврат.",
  "refunds.title": "Возврат средств",
  "refunds.subtitle": "Если вы не хотите продолжать, вы можете вернуть баланс кошелька на ту же карту, с которой пополняли.",
  "refunds.notice": "Во избежание злоупотреблений сумма возвращается только на карту, с которой ранее было успешное пополнение, а данные (ИНН и фото удостоверения) должны совпадать с держателем карты.",
  "refunds.available": "Доступно к возврату",
  "refunds.amountLabel": "Сумма возврата (туманы)",
  "refunds.amountPlaceholder": "напр. 50 000",
  "refunds.fullNameLabel": "ФИО (как в удостоверении)",
  "refunds.fullNamePlaceholder": "ФИО держателя карты",
  "refunds.nationalIdLabel": "Идентификационный номер",
  "refunds.nationalIdPlaceholder": "10 цифр",
  "refunds.cardLabel": "Номер банковской карты получателя",
  "refunds.ibanLabel": "IBAN (необязательно)",
  "refunds.nationalCardLabel": "Фото удостоверения личности",
  "refunds.nationalCardPick": "Выбрать фото удостоверения",
  "refunds.reasonLabel": "Примечание (необязательно)",
  "refunds.reasonPlaceholder": "При желании укажите причину запроса",
  "refunds.submit": "Подать запрос на возврат",
  "refunds.submitting": "Отправка…",
  "refunds.previous": "Предыдущие запросы",
  "refunds.empty": "Вы ещё не подавали запросов.",
  "refunds.rejectReason": "Причина отклонения:",
  "refunds.card": "Карта",
  "refunds.errMinAmount": "Минимальная сумма возврата — 10 000 туманов",
  "refunds.errOverBalance": "Сумма превышает доступный баланс",
  "refunds.errFullName": "Введите ФИО полностью",
  "refunds.errNationalId": "Идентификационный номер должен содержать 10 цифр",
  "refunds.errCard": "Номер карты должен содержать 16 цифр",
  "refunds.errFile": "Загрузка фото удостоверения обязательна",
  "refunds.success": "Запрос на возврат отправлен",
  "refunds.errSubmit": "Не удалось отправить запрос",
  "ticket.errSend": "Не удалось отправить сообщение",
  "ticket.closedToast": "Обращение закрыто",
  "ticket.errClose": "Не удалось закрыть обращение",
  "ticket.back": "Назад",
  "ticket.fallbackTitle": "Обращение",
  "ticket.category": "Категория:",
  "ticket.viewAttachment": "Посмотреть вложение",
  "ticket.closedNotice": "Это обращение закрыто.",
  "ticket.replyPlaceholder": "Напишите ваш ответ…",
  "ticket.attach": "Вложить",
  "ticket.removeAttach": "Удалить вложение",
  "ticket.closeTicket": "Закрыть обращение",
  "ticket.send": "Отправить",
  "newTicket.errSubject": "Укажите более полную тему",
  "newTicket.errMessage": "Сообщение слишком короткое",
  "newTicket.success": "Обращение успешно создано",
  "newTicket.errSubmit": "Не удалось создать обращение",
  "newTicket.button": "Новое обращение",
  "newTicket.title": "Создать обращение в поддержку",
  "newTicket.category": "Категория",
  "newTicket.subject": "Тема",
  "newTicket.subjectPlaceholder": "напр. Проблема с пополнением кошелька",
  "newTicket.desc": "Детали запроса",
  "newTicket.descPlaceholder": "Опишите детали вашей проблемы или запроса…",
  "newTicket.attachOptional": "Вложение (необязательно)",
  "newTicket.sending": "Отправка…",
  "newTicket.submit": "Отправить обращение",
  "auth.genericError": "Произошла ошибка",
  "auth.backToLogin": "Назад ко входу",
  "auth.forgotTitle": "Восстановление пароля",
  "auth.forgotDesc": "Введите email вашего аккаунта, и мы отправим ссылку для сброса пароля.",
  "auth.forgotSentDesc": "Если аккаунт с таким email существует, ссылка для сброса отправлена. Проверьте почту.",
  "auth.sendResetLink": "Отправить ссылку для сброса",
  "auth.resetTitle": "Задать новый пароль",
  "auth.resetRedirecting": "Переход ко входу…",
  "auth.resetInvalidLink": "Эта ссылка для сброса недействительна.",
  "auth.requestNewLink": "Запросить новую ссылку",
  "auth.newPasswordPlaceholder": "Новый пароль (не менее 8 символов)",
  "auth.confirmNewPlaceholder": "Повторите новый пароль",
  "auth.saveNewPassword": "Сохранить новый пароль",
  "auth.errMinPassword": "Пароль должен содержать не менее 8 символов",
  "auth.errPasswordMismatch": "Пароли не совпадают",
  "auth.resetFailed": "Не удалось сбросить пароль",
  "verify.working": "Проверка email…",
  "verify.invalidLink": "Эта ссылка подтверждения недействительна.",
  "verify.okTitle": "Ваш email подтверждён",
  "verify.okDesc": "Теперь вы можете войти с email и паролем.",
  "verify.failedTitle": "Подтверждение не удалось",
  "verify.emailFailed": "Не удалось подтвердить email.",
  "verify.backToAccount": "Назад к настройкам аккаунта",
  "acctEmail.title": "Email",
  "acctEmail.notSet": "Не указан",
  "acctEmail.verified": "Подтверждён",
  "acctEmail.unverified": "Не подтверждён",
  "acctEmail.pending": "Ожидает подтверждения: ",
  "acctEmail.sentNotice": "Письмо для подтверждения отправлено. Проверьте почту.",
  "acctEmail.sendFailed": "Не удалось отправить письмо подтверждения",
  "acctEmail.errMinPassword": "Пароль должен содержать не менее 8 символов",
  "acctEmail.verifiedLocked": "Ваш email подтверждён и не может быть изменён.",
  "acctEmail.choosePassword": "Выберите пароль (не менее 8 символов)",
  "acctEmail.sendVerify": "Отправить письмо подтверждения",
  "acctEmail.resend": "Отправить письмо повторно",
  "acctEmail.change": "Изменить",
  "acctPwd.title": "Пароль",
  "acctPwd.subtitle": "Изменить пароль аккаунта",
  "acctPwd.change": "Изменить",
  "acctPwd.success": "Пароль успешно изменён.",
  "acctPwd.errMin": "Новый пароль должен содержать не менее 8 символов",
  "acctPwd.errMismatch": "Пароли не совпадают",
  "acctPwd.failed": "Не удалось изменить пароль",
  "acctPwd.currentPlaceholder": "Текущий пароль",
  "acctPwd.newPlaceholder": "Новый пароль (не менее 8 символов)",
  "acctPwd.confirmPlaceholder": "Повторите новый пароль",
  "acctPwd.save": "Сохранить новый пароль",
  "acctTg.title": "Telegram",
  "acctTg.connected": "Подключён",
  "acctTg.notConnected": "Не подключён",
  "acctTg.connectedBadge": "Подключён",
  "acctTg.linkFailed": "Не удалось подключить Telegram",
  "acctTg.unlinkFailed": "Не удалось отключить Telegram",
  "acctTg.unlink": "Отключить Telegram",
  "acctTg.needOtherMethod": "Чтобы отключить Telegram, сначала задайте подтверждённый email и пароль, чтобы иметь другой способ входа.",
  "acctTg.notAvailable": "Вход через Telegram недоступен на этом домене.",
  "acctTg.connectAccount": "Подключить аккаунт Telegram",
  "common.ended": "Завершено",
  "a11y.mainNav": "Основная навигация",
  "a11y.collapseSidebar": "Свернуть боковую панель",
  "a11y.expandSidebar": "Развернуть боковую панель",
  "a11y.openMenu": "Открыть меню",
  "a11y.closeMenu": "Закрыть меню",
  "nav.menu": "Меню",
  "a11y.supportOnline": "Онлайн-поддержка",
  "home.recommended": "Рекомендуем вам",
  "flash.followCategoryHint": "Подпишитесь на категорию, чтобы получать звуковое уведомление о новых товарах.",
  "signIn.title": "Требуется вход",
  "signIn.defaultDesc": "Войдите в свой аккаунт, чтобы продолжить.",
  "signIn.action": "Войти в аккаунт",
  "watch.errUpdate": "Не удалось обновить список отслеживания",
  "watch.auctionRemoved": "Удалено из отслеживания",
  "watch.auctionAdded": "Добавлено в отслеживание; вы получите уведомление о начале аукциона",
  "watch.watching": "Отслеживается",
  "watch.watchAuction": "Отслеживать аукцион",
  "watch.productCancelled": "Уведомление о наличии отменено",
  "watch.productAdded": "Мы уведомим вас, когда товар снова появится",
  "watch.productActive": "Уведомление активно",
  "watch.notifyMe": "Уведомить меня",
  "watchedProducts.empty": "Вы не отслеживаете товары для уведомлений о наличии.",
  "watchedProducts.inStock": "В наличии",
  "catFollow.unfollowed": "Вы отписались от категории «{category}»",
  "catFollow.followed": "Теперь мы будем уведомлять о новых товарах в «{category}»",
  "catFollow.errUpdate": "Не удалось обновить",
  "catFollow.following": "Вы подписаны",
  "catFollow.follow": "Подписаться на категорию",
  "notif.moreCount": "{body} (+{count} ещё)",
  "notif.view": "Открыть",
  "rewards.achievements": "Достижения",
  "rewards.earnedOf": "{earned} из {total}",
  "menu.notifications": "Уведомления",
  "menu.notificationsDesc": "Последние события",
  "menu.wallet": "Кошелёк",
  "menu.walletDesc": "Баланс и пополнение",
  "menu.reports": "Отчёты о пополнениях",
  "menu.reportsDesc": "История и статус",
    "menu.support": "Тикеты и поддержка",
  "menu.supportDesc": "Создание и отслеживание запросов",
  "menu.refunds": "Запрос на возврат",
  "menu.refundsDesc": "Возврат на банковскую карту",
  "menu.profile": "Аккаунт",
  "menu.profileDesc": "Данные и настройки",
  "menu.account": "Безопасность и вход",
  "menu.accountDesc": "Email, пароль, Telegram",
  "menu.admin": "Панель администратора",
  "menu.adminDesc": "Управление магазином",
  "menu.accountAria": "Аккаунт",
  "menu.title": "Меню аккаунта",
  "menu.unmuteAria": "Включить звук уведомлений",
  "menu.muteAria": "Выключить звук уведомлений",
  "menu.mutedTitle": "Звук уведомлений выключен",
  "menu.unmutedTitle": "Звук уведомлений включён",
  "referral.copied": "Ссылка-приглашение скопирована",
  "referral.copyFailed": "Не удалось скопировать",
  "referral.shareText": "Присоединяйся к нам и участвуй в аукционах и специальных распродажах!",
  "referral.shareTitle": "Пригласить друзей",
  "referral.title": "Пригласить друзей",
  "referral.desc": "Поделитесь персональной ссылкой. Получайте награду за каждое успешное приглашение, а также постоянный кредит с",
  "referral.descEachPurchase": "каждой покупки",
  "referral.copyAria": "Скопировать ссылку-приглашение",
  "referral.sendTelegram": "Отправить ссылку в Telegram",
  "referral.shareLink": "Поделиться ссылкой-приглашением",
  "referral.statReferred": "Приглашено",
  "referral.statActive": "Активные",
  "referral.statEarned": "Заработано (Т)",
  "txn.DEPOSIT": "Пополнение",
  "txn.WITHDRAWAL": "Вывод",
  "txn.FREEZE": "Заморозка",
  "txn.UNFREEZE": "Разморозка",
  "txn.PURCHASE": "Списание за покупку",
  "txn.REFUND": "Возврат",
  "txn.BID_LOCK": "Блокировка ставки",
  "txn.BID_RELEASE": "Разблокировка ставки",
  "txn.ADMIN_ADJUSTMENT": "Корректировка администратора",
  "txn.CASHBACK": "Кэшбэк",
  "txn.REFERRAL_BONUS": "Реферальный бонус",
  "txn.CONVERSION": "Конвертация валюты",
  "stmt.filterAll": "Все",
  "stmt.purchase": "Покупка",
  "stmt.title": "Выписка",
  "stmt.filter": "Фильтр",
  "stmt.searchPlaceholder": "Поиск по примечаниям или ссылке...",
  "stmt.txnType": "Тип транзакции",
  "stmt.fromDate": "С даты",
  "stmt.toDate": "По дату",
  "stmt.foundCount": "Найдено транзакций: {count}",
  "stmt.empty": "Транзакции не найдены.",
  "wallet.selectCurrency": "Выбрать валюту",
  "wallet.frozenShort": "Заморожено",
  "wallet.addFunds": "Пополнить",
  "wallet.yourBalance": "Ваш баланс",
  "wallet.recentActivity": "Последние операции",
  "wallet.noActivity": "Пока нет операций",
  "wallet.chooseAmount": "Выберите сумму",
    "wallet.chooseMethod": "Выберите способ оплаты",
  "wallet.amountTomanLabel": "Сумма (томан)",
  "wallet.amountUsdLabel": "Сумма (USD)",
  "wallet.methodCard": "Перевод на карту",
  "wallet.methodCardSub": "Оплата в томанах",
  "wallet.methodUsdt": "Tether (USDT)",
  "wallet.methodTon": "Toncoin (TON)",
  "wallet.methodStars": "Telegram Stars",
  "wallet.methodStarsSub": "Мгновенная оплата",
  "wallet.methodUnavailable": "Этот способ сейчас недоступен",
  "wallet.continue": "Продолжить",
  "wallet.sendExactly": "Отправьте точную сумму",
  "wallet.toAddress": "На этот адрес",
  "wallet.toCard": "На эту карту",
  "wallet.cardHolder": "Владелец",
  "wallet.network": "Сеть",
  "wallet.transferNote": "Код перевода (укажите в примечании)",
  "wallet.copy": "Копировать",
  "wallet.copied": "Скопировано",
  "wallet.uploadReceipt": "Загрузить квитанцию",
  "wallet.receiptUploaded": "Квитанция загружена",
  "wallet.iPaid": "Я оплатил",
  "wallet.cryptoWarning": "Отправьте точную сумму, чтобы перевод можно было сопоставить.",
  "wallet.expiresIn": "Осталось времени",
  "wallet.expired": "Срок запроса истёк",
  "wallet.pendingReview": "На проверке у администратора",
  "wallet.payWithStars": "Оплатить звёздами",
  "wallet.starsAmount": "{n} звёзд",
  "wallet.depositCreated": "Запрос на пополнение создан",
  "wallet.uploading": "Загрузка…",
  "wallet.back": "Назад",
  "wallet.submittedTitle": "Запрос на пополнение получен",
  "wallet.submittedBody": "Ваш запрос успешно отправлен. После проверки администратором результат появится в вашем кошельке.",
  "wallet.gotIt": "Понятно",
  "wallet.close": "Закрыть",
  "wallet.requestsTitle": "Запросы на пополнение",
  "wallet.requestsEmpty": "Запросов пока нет.",
  "wallet.statusAwaiting": "Ожидает оплаты",
  "wallet.statusPending": "На проверке у администратора",
  "wallet.statusApproved": "Одобрено",
  "wallet.statusRejected": "Отклонено",
  "wallet.statusExpired": "Истекло",
  "wallet.rejectedTitle": "Запрос на пополнение отклонён",
  "wallet.rejectedBody": "К сожалению, ваш запрос на пополнение был отклонён администратором.",
  "wallet.rejectReasonLabel": "Причина отклонения",
  "convert.enterAmount": "Введите сумму",
  "convert.sameCurrency": "Исходная и целевая валюты совпадают",
  "convert.success": "Валюта успешно конвертирована",
  "convert.error": "Ошибка конвертации валюты",
  "convert.button": "Конвертировать валюту",
  "convert.from": "Из",
  "convert.to": "В",
  "convert.amountLabel": "Сумма ({symbol})",
  "convert.amountPlaceholder": "Сумма",
  "convert.rateUnavailable": "Курс конвертации недоступен",
  "convert.approxReceive": "Примерно получите",
  "notifList.tabAll": "Все",
  "notifList.tabUnread": "Непрочитанные",
  "notifList.tabArchived": "Архив",
  "notifList.searchPlaceholder": "Поиск уведомлений…",
  "notifList.markAll": "Прочитать все",
  "notifList.emptySearch": "Уведомления по этому запросу не найдены",
  "notifList.emptyArchived": "Ваш архив пуст",
  "notifList.emptyUnread": "У вас нет непрочитанных уведомлений",
  "notifList.emptyAll": "У вас пока нет уведомлений",
  "notifList.emptyAllDesc": "Когда появятся новости о заказах, аукционах или транзакциях, они отобразятся здесь.",
  "notifList.restore": "Вернуть во входящие",
  "notifList.delete": "Удалить",
  "notifList.archive": "Архивировать",
  "gwStatus.ACTIVE": "Активен",
  "gwStatus.SCHEDULED": "Запланирован",
  "gwStatus.PAUSED": "Приостановлен",
  "gwStatus.LOCKED": "Заблокирован",
  "gwStatus.DRAWING": "Розыгрыш",
  "gwStatus.FINISHED": "Завершён",
  "gw.winnersCount": "{count} победителей",
  "gw.participants": "Участники",
  "gw.startsUntil": "Начнётся через",
  "gw.drawn": "Разыгран",
  "gw.drawUntil": "Розыгрыш через",
  "gwd.entered": "Вы участвуете в розыгрыше",
  "gwd.joinChannelsFirst": "Сначала подпишитесь на требуемые каналы",
  "gwd.errEnter": "Ошибка участия в розыгрыше",
  "gwd.startRegUntil": "Регистрация начнётся через",
  "gwd.participants": "Участники",
  "gwd.prize": "Приз",
  "gwd.mustJoin": "Вы должны подписаться на эти каналы",
  "gwd.afterJoinRetry": "После подписки нажмите «Участвовать» снова",
  "gwd.winners": "Победители",
  "gwd.noWinners": "Победители ещё не объявлены",
  "gwd.alreadyEntered": "Вы уже участвуете",
  "gwd.notStarted": "Ещё не началось",
  "gwd.regClosed": "Регистрация закрыта",
  "gwd.signInToEnter": "Войдите, чтобы участвовать",
  "gwd.enter": "Участвовать",
  "bid.minBid": "Минимальная ставка — {amount} томан",
  "bid.placed": "Ваша ставка принята",
  "bid.errPlace": "Ошибка размещения ставки",
  "bid.buyNowSuccess": "Покупка успешна",
  "bid.errBuyNow": "Ошибка мгновенной покупки",
  "bid.notActive": "Этот аукцион неактивен",
  "bid.amountLabel": "Сумма ставки (томан)",
  "bid.min": "Минимум",
  "bid.submit": "Сделать ставку",
  "bid.buyNow": "Купить сейчас за {amount}",
  "bid.hint": "Сумма ставки замораживается в кошельке до окончания аукциона.",
  "auth.errTelegram": "Не удалось войти через Telegram",
  "auth.forgotLink": "Забыли пароль?",
  "forcePwd.errMin": "Пароль должен содержать не менее 8 символов",
  "forcePwd.errChange": "Ошибка смены пароля",
  "forcePwd.title": "Смените пароль",
  "forcePwd.desc": "В целях безопасности задайте новый пароль.",
  "forcePwd.currentPlaceholder": "Текущий пароль",
  "forcePwd.save": "Сохранить новый пароль",
  "tgLogin.loading": "Загрузка…",
  "tgLogin.unavailable": "Вход через Telegram недоступен",
  "tgLogin.domainNotice": "Эта функция доступна только внутри Telegram.",
  "vip.loginStreak": "Серия входов (дней)",
  "vip.usablePoints": "Доступные баллы",
    "vip.totalSpend": "Всего потрачено",
  "vip.progressTo": "Прогресс до {tier}",
  "vip.pointsProgress": "Баллы",
  "vip.spendProgress": "Расходы",
  "vip.maxTier": "Вы достигли высшего уровня",
  "ptSrc.PURCHASE": "Покупка",
  "ptSrc.REFERRAL": "Реферал",
  "ptSrc.GIVEAWAY_ENTRY": "Участие в розыгрыше",
  "ptSrc.DAILY_LOGIN": "Ежедневный вход",
  "ptSrc.PROFILE_COMPLETE": "Профиль заполнен",
  "ptSrc.MISSION_REWARD": "Награда за задание",
  "ptSrc.ACHIEVEMENT": "Достижение",
  "ptSrc.ADMIN_ADJUSTMENT": "Корректировка администратора",
  "ptSrc.REDEEM": "Списание",
  "points.empty": "История баллов пока пуста.",
  "missions.pointsReceived": "Получено баллов: {points}",
  "missions.errClaim": "Ошибка получения награды",
  "missions.claim": "Получить",
  "missions.daily": "Ежедневные",
  "missions.weekly": "Еженедельные",
  "refAct.pending": "Ожидание",
  "refAct.joined": "Присоединился",
  "refAct.purchased": "Купил",
  "refAct.daysAgo": "{count} дн. назад",
  "refAct.hoursAgo": "{count} ч. назад",
  "refAct.minutesAgo": "{count} мин. назад",
  "refAct.now": "Только что",
  "refAct.empty": "Пока нет рефералов",
  "refAct.emptyDesc": "Когда вы пригласите друзей, их активность появится здесь.",
}

// Roman Hindi (Romanized Hindi) — conversational, Latin script (not Devanagari).
  const hi: Catalog = {
    "nav.profile": "Profile",
    "home.dashboard": "Dashboard",
    "home.servicesTitle": "Services",
    "home.recentTitle": "Recent activity",
    "home.recentEmpty": "Abhi koi activity nahi",
    "home.promoTitle": "Special offer",
    "home.promoBody": "Wallet top up karein aur exclusive discount payein",
    "home.promoCta": "Dekhein",
    "home.accountStatus": "Account status",
    "svc.store": "Store",
    "svc.storeDesc": "Subscriptions, accounts aur digital goods",
    "svc.auctions": "Auctions",
    "svc.auctionsDesc": "Behtareen daam par products jeetein",
    "svc.vps": "VPS Hosting",
    "svc.vpsDesc": "Powerful virtual servers",
    "svc.domains": "Domains",
    "svc.domainsDesc": "Apna domain search aur register karein",
    "svc.giveaways": "Giveaways",
    "svc.giveawaysDesc": "Free giveaways mein shamil hon",
    "svc.orders": "Orders",
    "svc.ordersDesc": "Purchases aur delivery track karein",
    "svc.support": "Support",
    "svc.supportDesc": "Hamari team se chat karein",
    "svc.rewards": "Rewards",
    "svc.rewardsDesc": "Points, tiers aur perks",
    "badge.soon": "Soon",
    "badge.new": "New",
    "badge.hot": "Hot",
    "badge.active": "Active",
    "soon.title": "Coming soon",
    "soon.heading": "Yeh section jald aa raha hai",
    "soon.body": "Hum is feature ko bana rahe hain, jald hi platform mein add hoga.",
    "soon.back": "Dashboard par wapas",
    "vps.title": "VPS Hosting",
    "vps.subtitle": "Powerful, reliable cloud hosting",
    "domains.title": "Domain Registration",
    "domains.subtitle": "Apna domain search, price aur register karein",
  "nav.home": "Home",
  "nav.auctions": "Nilami",
  "nav.flash": "Flash Sale",
  "nav.wallet": "Wallet",
  "nav.orders": "Orders",
  "nav.giveaways": "Giveaway",
  "giveaways.title": "Giveaways",
  "giveaways.subtitle": "Channels join karein, giveaway mein hissa lein aur jeetein",
  "common.toman": "Toman",
  "common.rial": "Rial",
  "common.viewAll": "Sabhi dekhein",
  "common.showMore": "Aur dekhein",
  "common.showLess": "Kam dekhein",
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
  "auctions.nextBid": "Agli minimum boli",
  "auctions.finalPrice": "Final price",
  "auctions.startingPrice": "Starting price",
  "auctions.startsAt": "Shuru",
  "auctions.sold": "Bik gaya",
  "auctions.endingSoon": "Jald khatam",
  "auctions.reserveNotMetShort": "Reserve poori nahi hui",
  "auctions.stampSold": "BIK GAYA",
  "auctions.stampEnded": "KHATAM",
  "auctions.stampUnsold": "UNSOLD",
  "auctions.stampCancelled": "CANCELLED",
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
  "plan.choose": "Apna plan chunein",
  "plan.compare": "Plans ki tulna karein",
  "plan.selected": "Chuna gaya",
  "plan.from": "Se shuru",
  "plan.each": "prati",
  "plan.perDevice": "device",
  "plan.feature.duration": "Avadhi",
  "plan.feature.devices": "Devices",
  "plan.feature.accountType": "Account prakaar",
  "plan.feature.credentials": "Password badlein",
  "plan.feature.twoFactor": "Two-factor auth",
  "plan.feature.warranty": "Warranty",
  "plan.value.private": "Private",
  "plan.value.shared": "Shared",
  "plan.value.yes": "Haan",
  "plan.value.no": "Nahi",
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
  "bid.emptyBalance": "Aapka wallet khali hai. Bid karne ke liye pehle balance top up karein.",
  "bid.insufficient": "Is bid ke liye {amount} Toman aur chahiye. Kripya apna wallet top up karein.",
  "bid.needTopUp": "Aapka available balance kaafi nahin hai. Kripya wallet top up karein.",
  "bid.enableMax": "Automatic bidding (maximum set karein)",
  "bid.maxLabel": "Adhiktam bid raashi",
  "bid.maxPlaceholder": "Aap jitna dena chaahte hain uski seema",
  "bid.maxHint": "Hum aapki taraf se apne-aap bid karte hain, sirf zaroorat ke hisaab se, is seema tak. Poori maximum raashi auction khatm hone tak hold rehti hai.",
  "bid.maxTooLow": "Aapka maximum aapki bid se kam nahin ho sakta",
  "bid.maxPlaced": "Aapki automatic bid lag gayi",
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
  "banned.title": "Aapka account block ho gaya hai",
  "banned.message": "Aapko block kar diya gaya hai aur ab aap is bot ki services access nahin kar sakte.",
  "banned.logout": "Log out",
  "profile.title": "Meri profile",
  "profile.account": "Account",
  "profile.telegram": "Telegram",
  "profile.email": "Email",
  "profile.role": "Role",
  "profile.notLinked": "Link nahi hai",
  "profile.language": "Bhasha",
  "profile.motion": "Motion quality",
  "motion.choose": "Motion quality chunein",
  "motion.auto": "Auto",
  "motion.cinematic": "Cinematic",
  "motion.balanced": "Balanced",
  "motion.minimal": "Minimal",
  "motion.hint": "Auto aapke device ki performance ke hisaab se best effects chunta hai.",
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
  "join.joinCta": "Join karein",
  "join.members": "{count} members",
  "join.channelDesc": "Official channel",
  "join.allSet": "Sab taiyaar hai!",
  "join.allSetDesc": "Aapki membership verify ho gayi. App khol rahe hain…",
  "join.verifying": "Membership verify ho rahi hai…",
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
  "adetail.reserveHidden": "Is auction mein ek confidential reserve price hai",
  "adetail.minIncrement": "Min. increment",
  "adetail.winnersCount": "Winners",
  "adetail.endTime": "End time",
  "adetail.days": "din",
  "adetail.hours": "ghante",
  "adetail.mins": "min",
  "adetail.secs": "sec",
  "adetail.buyNowStat": "Abhi khareedein",
  "adetail.nextMinBid": "Agli minimum boli",
  "adetail.finalPrice": "Final price",
  "adetail.winner": "Winner",
  "adetail.soldViaBuyNow": "Buy Now se bika",
  "adetail.overview": "Vivaran",
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
  "watchlist.signInRequired": "Watchlist dekhne ke liye pehle sign in karein.",
  "watchlist.emptyDesc": "Apni pasandida auctions ko follow karein taaki shuru hone par aapko pata chale.",
  "watchlist.flashProducts": "Flash sale products",
  "rewards.title": "Rewards club",
  "rewards.subtitle": "Points kamayein, level badhayein aur rewards payein",
  "rewards.tabMissions": "Missions",
  "rewards.tabBadges": "Achievements",
  "rewards.tabHistory": "History",
  "rewards.noMissions": "Abhi koi active mission nahi hai",
  "invite.title": "Doston ko invite karein",
  "invite.subtitle": "Apne doston ko invite karein aur teen stages mein reward payein — sign-up se har purchase tak.",
  "invite.signInRequired": "Invite link paane ke liye pehle sign in karein.",
  "invite.how": "Main reward kaise kamaata hoon?",
  "invite.recent": "Recent invites",
  "invite.s1.title": "Aapka dost sign up karta hai",
  "invite.s1.desc": "Jab aapka dost aapke link se bot mein aata hai aur sign-up poora karta hai, aapko pehla reward milta hai.",
  "invite.s2.title": "Dost ki pehli purchase",
  "invite.s2.desc": "Dost ki pehli purchase par aap dono ko special first-purchase reward milta hai.",
  "invite.s3.title": "Lifetime kamai",
  "invite.s3.desc": "Iske baad aapke dost ki har purchase par aapko credit ka ek percentage milta rahega.",
  "reports.signInRequired": "Deposit reports dekhne ke liye pehle sign in karein.",
  "reports.title": "Deposit reports",
  "reports.subtitle": "Aapke wallet top-up requests ka history aur unka review status.",
  "reports.empty": "Abhi tak koi deposit nahi",
  "reports.emptyDesc": "Balance top-up karne ke liye wallet page par jayein.",
  "reports.emptyAction": "Wallet top-up karein",
  "reports.card": "Card",
  "reports.reference": "Reference:",
  "support.signInRequired": "Support use karne ke liye pehle sign in karein.",
  "support.title": "Support aur tickets",
  "support.subtitle": "Koi sawaal ya samasya hai? Ticket banayein, hum dekh lenge.",
  "support.empty": "Abhi tak koi ticket nahi",
  "support.emptyDesc": "Agar koi sawaal ya samasya hai, to support team ke review ke liye naya ticket banayein.",
  "supportStatus.OPEN": "Open",
  "supportStatus.ANSWERED": "Answered",
  "supportStatus.PENDING": "Jawaab ka intezaar",
  "supportStatus.CLOSED": "Closed",
  "supportCat.GENERAL": "General",
  "supportCat.PAYMENT": "Payment aur wallet",
  "supportCat.ORDER": "Order",
  "supportCat.REFUND": "Refund",
  "supportCat.TECHNICAL": "Technical samasya",
  "depositStatus.PENDING": "Review mein",
  "depositStatus.APPROVED": "Approved",
  "depositStatus.REJECTED": "Reject ho gaya",
  "refundStatus.PENDING": "Review mein",
  "refundStatus.APPROVED": "Approved",
  "refundStatus.REJECTED": "Reject ho gaya",
  "refundStatus.PAID": "Paid",
  "refunds.signInRequired": "Refund request bhejne ke liye pehle sign in karein.",
  "refunds.title": "Refund",
  "refunds.subtitle": "Agar aap aage continue nahi karna chahte, to apna wallet balance usi card par wapas le sakte hain jisse deposit kiya tha.",
  "refunds.notice": "Misuse rokne ke liye, amount sirf us card par return hota hai jisse pehle successful deposit hua ho, aur identity details (national ID aur ID card photo) card holder se match honi chahiye.",
  "refunds.available": "Refundable balance",
  "refunds.amountLabel": "Refund amount (Toman)",
  "refunds.amountPlaceholder": "jaise 50,000",
  "refunds.fullNameLabel": "Poora naam (national ID ke anusaar)",
  "refunds.fullNamePlaceholder": "Card holder ka poora naam",
  "refunds.nationalIdLabel": "National ID",
  "refunds.nationalIdPlaceholder": "10 digits",
  "refunds.cardLabel": "Destination bank card number",
  "refunds.ibanLabel": "IBAN (optional)",
  "refunds.nationalCardLabel": "National ID card photo",
  "refunds.nationalCardPick": "National ID card photo chunein",
  "refunds.reasonLabel": "Notes (optional)",
  "refunds.reasonPlaceholder": "Chahein to request ka kaaran likhein",
  "refunds.submit": "Refund request bhejein",
  "refunds.submitting": "Bheja ja raha hai…",
  "refunds.previous": "Pichhli requests",
  "refunds.empty": "Aapne abhi tak koi request nahi bheji.",
  "refunds.rejectReason": "Reject ka kaaran:",
  "refunds.card": "Card",
  "refunds.errMinAmount": "Minimum refund amount 10,000 Toman hai",
  "refunds.errOverBalance": "Amount available balance se zyada hai",
  "refunds.errFullName": "Apna poora naam darj karein",
  "refunds.errNationalId": "National ID 10 digits ki honi chahiye",
  "refunds.errCard": "Card number 16 digits ka hona chahiye",
  "refunds.errFile": "National ID card photo upload karna zaroori hai",
  "refunds.success": "Refund request bhej di gayi",
  "refunds.errSubmit": "Request bhejne mein samasya",
  "ticket.errSend": "Message bhejne mein samasya",
  "ticket.closedToast": "Ticket band kar diya gaya",
  "ticket.errClose": "Ticket band karne mein samasya",
  "ticket.back": "Wapas",
  "ticket.fallbackTitle": "Ticket",
  "ticket.category": "Category:",
  "ticket.viewAttachment": "Attachment dekhein",
  "ticket.closedNotice": "Yeh ticket band ho chuka hai.",
  "ticket.replyPlaceholder": "Apna jawaab likhein…",
  "ticket.attach": "Attach",
  "ticket.removeAttach": "Attachment hatayein",
  "ticket.closeTicket": "Ticket band karein",
  "ticket.send": "Bhejein",
  "newTicket.errSubject": "Subject thoda aur poora likhein",
  "newTicket.errMessage": "Message bahut chhota hai",
  "newTicket.success": "Ticket safalta se ban gaya",
  "newTicket.errSubmit": "Ticket banane mein samasya",
  "newTicket.button": "Naya ticket",
  "newTicket.title": "Support ticket banayein",
  "newTicket.category": "Category",
  "newTicket.subject": "Subject",
  "newTicket.subjectPlaceholder": "jaise: Wallet top-up mein samasya",
  "newTicket.desc": "Request details",
  "newTicket.descPlaceholder": "Apni samasya ya request ki details likhein…",
  "newTicket.attachOptional": "Attachment (optional)",
  "newTicket.sending": "Bheja ja raha hai…",
  "newTicket.submit": "Ticket bhejein",
  "auth.genericError": "Kuch galat ho gaya",
  "auth.backToLogin": "Login par wapas",
  "auth.forgotTitle": "Password reset karein",
  "auth.forgotDesc": "Apne account ka email darj karein, hum aapko password reset link bhejenge.",
  "auth.forgotSentDesc": "Agar is email se koi account hai to reset link bhej diya gaya hai. Apna inbox check karein.",
  "auth.sendResetLink": "Reset link bhejein",
  "auth.resetTitle": "Naya password set karein",
  "auth.resetRedirecting": "Login par le jaaya ja raha hai…",
  "auth.resetInvalidLink": "Yeh reset link amaanya hai.",
  "auth.requestNewLink": "Naya link maangein",
  "auth.newPasswordPlaceholder": "Naya password (kam se kam 8 characters)",
  "auth.confirmNewPlaceholder": "Naya password dobara",
  "auth.saveNewPassword": "Naya password save karein",
  "auth.errMinPassword": "Password kam se kam 8 characters ka hona chahiye",
  "auth.errPasswordMismatch": "Password match nahi karte",
  "auth.resetFailed": "Password reset nahi ho saka",
  "verify.working": "Email verify ho raha hai…",
  "verify.invalidLink": "Yeh verification link amaanya hai.",
  "verify.okTitle": "Aapka email verify ho gaya",
  "verify.okDesc": "Ab aap email aur password se sign in kar sakte hain.",
  "verify.failedTitle": "Verification fail ho gaya",
  "verify.emailFailed": "Email verification fail ho gaya.",
  "verify.backToAccount": "Account settings par wapas",
  "acctEmail.title": "Email",
  "acctEmail.notSet": "Set nahi",
  "acctEmail.verified": "Verified",
  "acctEmail.unverified": "Unverified",
  "acctEmail.pending": "Confirmation ka intzaar: ",
  "acctEmail.sentNotice": "Verification email bhej diya gaya. Apna inbox check karein.",
  "acctEmail.sendFailed": "Verification email bhejne mein samasya",
  "acctEmail.errMinPassword": "Password kam se kam 8 characters ka hona chahiye",
  "acctEmail.verifiedLocked": "Aapka email verified hai aur badla nahi ja sakta.",
  "acctEmail.choosePassword": "Ek password chunein (kam se kam 8 characters)",
  "acctEmail.sendVerify": "Verification email bhejein",
  "acctEmail.resend": "Verification email dobara bhejein",
  "acctEmail.change": "Badlein",
  "acctPwd.title": "Password",
  "acctPwd.subtitle": "Account ka password badlein",
  "acctPwd.change": "Badlein",
  "acctPwd.success": "Password safalta se badal gaya.",
  "acctPwd.errMin": "Naya password kam se kam 8 characters ka hona chahiye",
  "acctPwd.errMismatch": "Password match nahi karte",
  "acctPwd.failed": "Password badalne mein samasya",
  "acctPwd.currentPlaceholder": "Maujooda password",
  "acctPwd.newPlaceholder": "Naya password (kam se kam 8 characters)",
  "acctPwd.confirmPlaceholder": "Naya password dobara",
  "acctPwd.save": "Naya password save karein",
  "acctTg.title": "Telegram",
  "acctTg.connected": "Connected",
  "acctTg.notConnected": "Connected nahi",
  "acctTg.connectedBadge": "Connected",
  "acctTg.linkFailed": "Telegram link karne mein samasya",
  "acctTg.unlinkFailed": "Telegram unlink karne mein samasya",
  "acctTg.unlink": "Telegram unlink karein",
  "acctTg.needOtherMethod": "Telegram unlink karne ke liye pehle ek verified email aur password set karein taki sign in ka doosra tareeka ho.",
  "acctTg.notAvailable": "Is domain par Telegram login uplabdh nahi hai.",
  "acctTg.connectAccount": "Telegram account connect karein",
  "common.ended": "Khatam ho gaya",
  "a11y.mainNav": "Main navigation",
  "a11y.collapseSidebar": "Collapse sidebar",
  "a11y.expandSidebar": "Expand sidebar",
  "a11y.openMenu": "Open menu",
  "a11y.closeMenu": "Close menu",
  "nav.menu": "Menu",
  "a11y.supportOnline": "Online support",
  "home.recommended": "Aapke liye suggestions",
  "flash.followCategoryHint": "Is category ko follow karein, naya product add hone par sound alert milega.",
  "signIn.title": "Sign-in zaroori hai",
  "signIn.defaultDesc": "Aage badhne ke liye apne account mein sign in karein.",
  "signIn.action": "Account mein sign in karein",
  "watch.errUpdate": "Watchlist update karne mein samasya",
  "watch.auctionRemoved": "Watchlist se hata diya gaya",
  "watch.auctionAdded": "Watchlist mein add ho gaya; auction shuru hone par aapko notify karenge",
  "watch.watching": "Watch ho raha hai",
  "watch.watchAuction": "Auction watch karein",
  "watch.productCancelled": "Stock alert cancel ho gaya",
  "watch.productAdded": "Product wapas stock mein aane par aapko notify karenge",
  "watch.productActive": "Alert active hai",
  "watch.notifyMe": "Mujhe notify karein",
  "watchedProducts.empty": "Aap kisi product ko stock alert ke liye follow nahi kar rahe.",
  "watchedProducts.inStock": "Stock mein",
  "catFollow.unfollowed": "\u201c{category}\u201d category unfollow kar di gayi",
  "catFollow.followed": "Ab hum \u201c{category}\u201d ke naye products ke baare mein notify karenge",
  "catFollow.errUpdate": "Update karne mein samasya",
  "catFollow.following": "Follow kar rahe hain",
  "catFollow.follow": "Category follow karein",
  "notif.moreCount": "{body} (+{count} aur)",
  "notif.view": "Dekhein",
  "rewards.achievements": "Achievements",
  "rewards.earnedOf": "{total} mein se {earned}",
  "menu.notifications": "Notifications",
  "menu.notificationsDesc": "Latest events",
  "menu.wallet": "Wallet",
  "menu.walletDesc": "Balance aur top-up",
  "menu.reports": "Deposit reports",
  "menu.reportsDesc": "History aur status",
  "menu.support": "Tickets aur support",
  "menu.supportDesc": "Requests darj aur track karein",
  "menu.refunds": "Refund request",
  "menu.refundsDesc": "Bank card par wapas",
  "menu.profile": "Account",
  "menu.profileDesc": "Info aur settings",
  "menu.account": "Security aur login",
  "menu.accountDesc": "Email, password, Telegram",
  "menu.admin": "Admin panel",
  "menu.adminDesc": "Store manage karein",
  "menu.accountAria": "Account",
  "menu.title": "Account menu",
  "menu.unmuteAria": "Notification sound on karein",
  "menu.muteAria": "Notification sound off karein",
  "menu.mutedTitle": "Notification sound off hai",
  "menu.unmutedTitle": "Notification sound on hai",
  "referral.copied": "Invite link copy ho gaya",
  "referral.copyFailed": "Copy nahi hua",
  "referral.shareText": "Hamare saath judein aur auctions aur special sales ka laabh uthayein!",
  "referral.shareTitle": "Doston ko invite karein",
  "referral.title": "Doston ko invite karein",
  "referral.desc": "Apni personal link share karein. Har successful invite par reward paayein, aur",
  "referral.descEachPurchase": "har purchase",
  "referral.copyAria": "Invite link copy karein",
  "referral.sendTelegram": "Telegram par link bhejein",
  "referral.shareLink": "Invite link share karein",
  "referral.statReferred": "Invite kiye",
  "referral.statActive": "Active",
  "referral.statEarned": "Kamaaya (T)",
  "txn.DEPOSIT": "Top-up",
  "txn.WITHDRAWAL": "Withdrawal",
  "txn.FREEZE": "Freeze",
  "txn.UNFREEZE": "Unfreeze",
  "txn.PURCHASE": "Purchase deduction",
  "txn.REFUND": "Refund",
  "txn.BID_LOCK": "Bid lock",
  "txn.BID_RELEASE": "Bid release",
  "txn.ADMIN_ADJUSTMENT": "Admin adjustment",
  "txn.CASHBACK": "Cashback",
  "txn.REFERRAL_BONUS": "Referral bonus",
  "txn.CONVERSION": "Currency conversion",
  "stmt.filterAll": "Sab",
  "stmt.purchase": "Purchase",
  "stmt.title": "Statement",
  "stmt.filter": "Filter",
  "stmt.searchPlaceholder": "Notes ya reference mein search karein...",
  "stmt.txnType": "Transaction type",
  "stmt.fromDate": "From date",
  "stmt.toDate": "To date",
  "stmt.foundCount": "{count} transactions mile",
  "stmt.empty": "Koi transaction nahi mila.",
  "wallet.selectCurrency": "Currency select karein",
  "wallet.frozenShort": "Frozen",
  "wallet.addFunds": "Funds add karein",
  "wallet.yourBalance": "Aapka balance",
  "wallet.recentActivity": "Recent activity",
  "wallet.noActivity": "Abhi koi activity nahin",
  "wallet.chooseAmount": "Amount chunein",
  "wallet.chooseMethod": "Payment method chunein",
  "wallet.amountTomanLabel": "Amount (Toman)",
  "wallet.amountUsdLabel": "Amount (USD)",
  "wallet.methodCard": "Card transfer",
  "wallet.methodCardSub": "Toman mein pay karein",
  "wallet.methodUsdt": "Tether (USDT)",
  "wallet.methodTon": "Toncoin (TON)",
  "wallet.methodStars": "Telegram Stars",
  "wallet.methodStarsSub": "Instant in-app payment",
  "wallet.methodUnavailable": "Yeh method abhi available nahin hai",
  "wallet.continue": "Continue",
  "wallet.sendExactly": "Bilkul yahi amount bhejein",
  "wallet.toAddress": "Is address par",
  "wallet.toCard": "Is card par",
  "wallet.cardHolder": "Holder",
  "wallet.network": "Network",
  "wallet.transferNote": "Reference code (transfer note mein likhein)",
  "wallet.copy": "Copy",
  "wallet.copied": "Copy ho gaya",
  "wallet.uploadReceipt": "Receipt upload karein",
  "wallet.receiptUploaded": "Receipt upload ho gaya",
  "wallet.iPaid": "Maine pay kar diya",
  "wallet.cryptoWarning": "Exact amount bhejein taaki aapka transfer match ho sake.",
  "wallet.expiresIn": "Bacha hua time",
  "wallet.expired": "Yeh request expire ho gaya",
  "wallet.pendingReview": "Admin review pending",
  "wallet.payWithStars": "Stars se pay karein",
  "wallet.starsAmount": "{n} Stars",
  "wallet.depositCreated": "Top-up request ban gaya",
  "wallet.uploading": "Upload ho raha hai…",
  "wallet.back": "Back",
  "wallet.submittedTitle": "Top-up request mil gaya",
  "wallet.submittedBody": "Aapka request submit ho gaya hai. Admin review ke baad natija aapke wallet mein dikhega.",
  "wallet.gotIt": "Samajh gaya",
  "wallet.close": "Band karein",
  "wallet.requestsTitle": "Top-up requests",
  "wallet.requestsEmpty": "Abhi koi request nahi hai.",
  "wallet.statusAwaiting": "Payment ka intezaar",
  "wallet.statusPending": "Admin review pending",
  "wallet.statusApproved": "Approve ho gaya",
  "wallet.statusRejected": "Reject ho gaya",
  "wallet.statusExpired": "Expire ho gaya",
  "wallet.rejectedTitle": "Top-up request reject ho gaya",
  "wallet.rejectedBody": "Afsos, aapka top-up request admin dwara reject kar diya gaya.",
  "wallet.rejectReasonLabel": "Reject karne ki wajah",
  "convert.enterAmount": "Amount darj karein",
  "convert.sameCurrency": "Source aur target currency same hai",
  "convert.success": "Currency safaltapoorvak convert ho gayi",
  "convert.error": "Currency convert karne mein error",
  "convert.button": "Currency convert karein",
  "convert.from": "Se",
  "convert.to": "Tak",
  "convert.amountLabel": "Amount ({symbol})",
  "convert.amountPlaceholder": "Amount",
  "convert.rateUnavailable": "Conversion rate uplabdh nahi",
  "convert.approxReceive": "Lagbhag milega",
  "notifList.tabAll": "Sab",
  "notifList.tabUnread": "Unread",
  "notifList.tabArchived": "Archived",
  "notifList.searchPlaceholder": "Notifications mein search karein…",
  "notifList.markAll": "Sab read karein",
  "notifList.emptySearch": "Is search se koi notification nahi mila",
  "notifList.emptyArchived": "Aapka archive khaali hai",
  "notifList.emptyUnread": "Aapke paas koi unread notification nahi",
  "notifList.emptyAll": "Aapke paas abhi koi notification nahi",
  "notifList.emptyAllDesc": "Jab orders, auctions ya transactions ke baare mein koi news hogi, to yahan dikhega.",
  "notifList.restore": "Inbox mein wapas laayein",
  "notifList.delete": "Delete",
  "notifList.archive": "Archive",
  "gwStatus.ACTIVE": "Active",
  "gwStatus.SCHEDULED": "Scheduled",
  "gwStatus.PAUSED": "Paused",
  "gwStatus.LOCKED": "Locked",
  "gwStatus.DRAWING": "Drawing",
  "gwStatus.FINISHED": "Finished",
  "gw.winnersCount": "{count} winners",
  "gw.participants": "Participants",
  "gw.startsUntil": "Starts in",
  "gw.drawn": "Drawn",
  "gw.drawUntil": "Draw in",
  "gwd.entered": "You have entered the giveaway",
  "gwd.joinChannelsFirst": "Please join the required channels first",
  "gwd.errEnter": "Error entering the giveaway",
  "gwd.startRegUntil": "Registration starts in",
  "gwd.participants": "Participants",
  "gwd.prize": "Prize",
  "gwd.mustJoin": "You must join these channels",
  "gwd.afterJoinRetry": "After joining, tap enter again",
  "gwd.winners": "Winners",
  "gwd.noWinners": "No winners announced yet",
  "gwd.alreadyEntered": "You have already entered",
  "gwd.notStarted": "Not started yet",
  "gwd.regClosed": "Registration closed",
  "gwd.signInToEnter": "Sign in to enter",
  "gwd.enter": "Enter giveaway",
  "bid.minBid": "Minimum bid is {amount} Toman",
  "bid.placed": "Your bid was placed",
  "bid.errPlace": "Error placing bid",
  "bid.buyNowSuccess": "Purchase successful",
  "bid.errBuyNow": "Error with instant purchase",
  "bid.notActive": "This auction is not active",
  "bid.amountLabel": "Bid amount (Toman)",
  "bid.min": "Minimum",
  "bid.submit": "Place bid",
  "bid.buyNow": "Buy now for {amount}",
  "bid.hint": "The bid amount is locked in your wallet until the auction ends.",
  "auth.errTelegram": "Telegram login failed",
  "auth.forgotLink": "Forgot your password?",
  "forcePwd.errMin": "Password must be at least 8 characters",
  "forcePwd.errChange": "Error changing password",
  "forcePwd.title": "Change your password",
  "forcePwd.desc": "For your security, please set a new password.",
  "forcePwd.currentPlaceholder": "Current password",
  "forcePwd.save": "Save new password",
  "tgLogin.loading": "Loading…",
  "tgLogin.unavailable": "Telegram login unavailable",
  "tgLogin.domainNotice": "This feature is only available inside Telegram.",
  "vip.loginStreak": "Login streak (days)",
  "vip.usablePoints": "Usable points",
  "vip.totalSpend": "Total spend",
  "vip.progressTo": "Progress to {tier}",
  "vip.pointsProgress": "Points",
  "vip.spendProgress": "Spend",
  "vip.maxTier": "You've reached the highest tier",
  "ptSrc.PURCHASE": "Purchase",
  "ptSrc.REFERRAL": "Referral",
  "ptSrc.GIVEAWAY_ENTRY": "Giveaway entry",
  "ptSrc.DAILY_LOGIN": "Daily login",
  "ptSrc.PROFILE_COMPLETE": "Profile completed",
  "ptSrc.MISSION_REWARD": "Mission reward",
  "ptSrc.ACHIEVEMENT": "Achievement",
  "ptSrc.ADMIN_ADJUSTMENT": "Admin adjustment",
  "ptSrc.REDEEM": "Redeem",
  "points.empty": "No points history yet.",
  "missions.pointsReceived": "{points} points received",
  "missions.errClaim": "Error claiming reward",
  "missions.claim": "Claim",
  "missions.daily": "Daily",
  "missions.weekly": "Weekly",
  "refAct.pending": "Pending",
  "refAct.joined": "Joined",
  "refAct.purchased": "Purchased",
  "refAct.daysAgo": "{count} days ago",
  "refAct.hoursAgo": "{count} hours ago",
  "refAct.minutesAgo": "{count} minutes ago",
  "refAct.now": "Just now",
  "refAct.empty": "No referrals yet",
  "refAct.emptyDesc": "When you invite friends, their activity will appear here.",
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
