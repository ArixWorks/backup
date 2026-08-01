/*
 * Boot watchdog for the Telegram Mini App.
 *
 * The entire UI is client-rendered and the theme relies on modern CSS/JS. On a
 * healthy device this file is a no-op after it clears Telegram's loader. Its job
 * is to make two failure modes visible instead of an eternal blank white screen
 * with a spinning Telegram loader (observed on an outdated Galaxy J4+ WebView):
 *
 *   1. Telegram's native loading spinner only stops once WebApp.ready() runs.
 *      In the React app that call lives deep inside a heavy client bundle, so if
 *      the bundle is slow or fails to execute the spinner spins forever. We call
 *      ready()/expand() here ASAP, independent of React.
 *
 *   2. If React never signals window.__APP_MOUNTED__ within the grace window,
 *      the bundle did not run on this engine (old WebView / JS error). We show a
 *      dark, actionable Persian notice (retry + open-in-browser) with inline hex
 *      colors only, so it renders even when the theme's oklch tokens are invalid.
 *
 * Written in ES5 (var, no arrow functions / template literals) so it executes on
 * the oldest engines this guard is meant to catch.
 */
;(function () {
  try {
    // ---- 1. Clear Telegram's loader + expand the viewport ASAP. The SDK script
    // is async, so poll briefly until window.Telegram.WebApp is available. ----
    var tgTries = 0
    var tgTimer = setInterval(function () {
      tgTries++
      try {
        var wa = window.Telegram && window.Telegram.WebApp
        if (wa) {
          try {
            wa.ready()
          } catch (e) {}
          try {
            wa.expand()
          } catch (e) {}
          clearInterval(tgTimer)
        }
      } catch (e) {}
      if (tgTries > 60) clearInterval(tgTimer)
    }, 100)

    // ---- 2. Boot watchdog: fire once if the app has not mounted in time. ----
    var GRACE_MS = 9000
    setTimeout(function () {
      if (window.__APP_MOUNTED__) return
      if (document.getElementById('boot-fallback')) return
      var body = document.body
      if (!body) return

      var oklchOk = false
      try {
        oklchOk = !!(window.CSS && window.CSS.supports && window.CSS.supports('color', 'oklch(0.5 0.1 200)'))
      } catch (e) {}

      // If the engine is modern the likely cause is a slow network / stalled
      // load; otherwise it is an outdated browser engine. Tailor the message.
      var title = oklchOk ? 'بارگذاری بیش از حد طول کشید' : 'مرورگر دستگاه شما قدیمی است'
      var desc = oklchOk
        ? 'اتصال شما کند است یا برنامه به‌درستی اجرا نشد. لطفاً دوباره تلاش کنید یا صفحه را در مرورگر باز کنید.'
        : 'برای استفاده از فروشگاه، لطفاً «Android System WebView» و «Google Chrome» را از گوگل‌پلی به‌روزرسانی کنید و دوباره باز کنید.'

      var wrap = document.createElement('div')
      wrap.id = 'boot-fallback'
      wrap.setAttribute('dir', 'rtl')
      wrap.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;' +
        'background:#080d12;color:#e7edf3;font-family:Tahoma,Arial,sans-serif;line-height:1.9'

      var icon = document.createElement('div')
      icon.style.cssText =
        'width:64px;height:64px;border-radius:16px;background:#12202b;display:flex;' +
        'align-items:center;justify-content:center;font-size:30px'
      icon.textContent = '⚠️'

      var h = document.createElement('h1')
      h.style.cssText = 'margin:0;font-size:18px;font-weight:700;color:#f4c752'
      h.textContent = title

      var p = document.createElement('p')
      p.style.cssText = 'margin:0;max-width:320px;font-size:14px;color:#aebccb'
      p.textContent = desc

      var btns = document.createElement('div')
      btns.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px'

      var reload = document.createElement('button')
      reload.type = 'button'
      reload.textContent = 'تلاش دوباره'
      reload.style.cssText =
        'appearance:none;border:0;border-radius:12px;padding:10px 18px;font-size:14px;' +
        'font-weight:700;background:#f4c752;color:#241a00;font-family:inherit'
      reload.onclick = function () {
        try {
          location.reload()
        } catch (e) {}
      }

      var open = document.createElement('button')
      open.type = 'button'
      open.textContent = 'باز کردن در مرورگر'
      open.style.cssText =
        'appearance:none;border:1px solid #26343f;border-radius:12px;padding:10px 18px;' +
        'font-size:14px;font-weight:600;background:transparent;color:#e7edf3;font-family:inherit'
      open.onclick = function () {
        try {
          var wa = window.Telegram && window.Telegram.WebApp
          if (wa && typeof wa.openLink === 'function') {
            wa.openLink(location.href)
            return
          }
        } catch (e) {}
        try {
          window.open(location.href, '_blank')
        } catch (e) {}
      }

      btns.appendChild(reload)
      btns.appendChild(open)
      wrap.appendChild(icon)
      wrap.appendChild(h)
      wrap.appendChild(p)
      wrap.appendChild(btns)
      body.appendChild(wrap)
    }, GRACE_MS)
  } catch (e) {}
})()
