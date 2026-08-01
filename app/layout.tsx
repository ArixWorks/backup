import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import type { Metadata, Viewport } from 'next'
import { Vazirmatn, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/app-shell'
import { THEMES, DEFAULT_THEME } from '@/lib/core/settings'
import { getActiveThemeCached } from '@/lib/core/settings-cache'
import './globals.css'

// Vazirmatn: the complete, professional open Persian/Arabic UI typeface
// (successor to Vazir). Self-hosted and optimized by next/font. It's a variable
// font, so we omit `weight` to ship a single variable file that covers every
// weight the UI uses (400–900) instead of 6 separate static instances.
const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-vazirmatn',
  display: 'swap',
  // Reduce CLS: keep swapped fallback metrics close to the web font.
  adjustFontFallback: true,
})

// Geist Mono is also variable — one file covers all needed weights (400–600).
// Only used in a handful of numeric/monospace spots, so we can defer its swap.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const SITE_URL = 'https://acciran.com'
const SITE_TITLE = 'SubIO | بازار هوشمند محصولات دیجیتال و مزایده آنلاین'
const SITE_DESCRIPTION =
  'خرید امن محصولات دیجیتال، شرکت در مزایده‌های آنلاین، تحویل خودکار و مدیریت پرداخت‌ها در تجربه‌ای سریع و حرفه‌ای با SubIO.'

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'SubIO',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon.png`,
        width: 512,
        height: 512,
      },
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'SubIO',
      description: SITE_DESCRIPTION,
      inLanguage: 'fa-IR',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | SubIO',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'SubIO',
  authors: [{ name: 'SubIO', url: SITE_URL }],
  creator: 'SubIO',
  publisher: 'SubIO',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'SubIO',
    'فروشگاه محصولات دیجیتال',
    'مزایده آنلاین',
    'خرید اکانت پریمیوم',
    'تحویل خودکار',
    'محصولات دیجیتال',
    'کیف پول دیجیتال',
  ],
  category: 'technology',
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: '/',
    siteName: 'SubIO',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'ربات اختصاصی SubIO در بازار محصولات دیجیتال و مزایده آنلاین',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '1024x1024' },
    ],
    shortcut: '/brand/favicon-32.png',
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getActiveThemeCached().catch(() => DEFAULT_THEME)
  const headerColor =
    THEMES.find((t) => t.id === theme)?.headerColor ?? '#080d12'
  return {
    colorScheme: 'dark',
    themeColor: headerColor,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const theme = await getActiveThemeCached().catch(() => DEFAULT_THEME)
  return (
    <html
      lang="fa"
      dir="rtl"
      data-theme={theme}
      // Default to the web experience for SSR (crawlers / normal browsers). The
      // inline script below flips this to "telegram" synchronously, before
      // paint, when the launch URL shows a Telegram Mini App payload — so the
      // correct chrome (web dashboard vs mini-app) renders with no flash/CLS.
      data-env="web"
      className={`dark bg-background ${vazirmatn.variable} ${geistMono.variable}`}
      // i18n-provider and telegram-provider intentionally mutate <html>
      // lang/dir/data-* on the client after hydration based on stored locale
      // and the Telegram environment, so attribute drift here is expected.
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
        {/* Environment detection runs BEFORE hydration so the layout engine
            (CSS `tg:`/`web:` variants) picks the right shell on first paint.
            Mirrors TelegramProvider.launchedFromTelegram() but width-free and
            synchronous — decides by environment, never by screen size. */}
        <Script id="env-detect" strategy="beforeInteractive">
          {`(function(){try{var u=location.hash+location.search;var tg=/tgWebApp/i.test(u)||!!(window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.initData);document.documentElement.dataset.env=tg?'telegram':'web';}catch(e){}})();`}
        </Script>
        {/* Old-engine guard: the whole UI is client-rendered and the theme uses
            oklch()/dvh (Chromium 108-111+). On outdated Android System WebView
            (e.g. Galaxy J4+) those are invalid, so tokens drop and the app
            paints blank white while Telegram's loader spins forever. This runs
            before hydration, and if the engine lacks oklch/dvh support it shows
            a styled Persian notice (hex colors only) and clears the TG spinner.
            All strings are pre-escaped to stay valid inside the JSX string. */}
        <Script id="engine-compat" strategy="beforeInteractive">
          {`(function(){try{var ok=(window.CSS&&CSS.supports&&CSS.supports('color','oklch(0.5 0.1 200)')&&CSS.supports('height','1dvh'));if(ok)return;var render=function(){try{if(window.Telegram&&window.Telegram.WebApp){try{window.Telegram.WebApp.ready();}catch(e){}try{window.Telegram.WebApp.expand();}catch(e){}}if(document.getElementById('engine-compat-screen'))return;var b=document.body;if(!b)return;var d=document.createElement('div');d.id='engine-compat-screen';d.setAttribute('dir','rtl');d.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:#080d12;color:#e7edf3;font-family:Tahoma,Arial,sans-serif;line-height:1.9';d.innerHTML='<div style=\\'width:64px;height:64px;border-radius:16px;background:#12202b;display:flex;align-items:center;justify-content:center;font-size:32px\\'>\\u26A0\\uFE0F</div><h1 style=\\'margin:0;font-size:18px;font-weight:700;color:#f4c752\\'>\\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647 \\u0634\\u0645\\u0627 \\u0642\\u062F\\u06CC\\u0645\\u06CC \\u0627\\u0633\\u062A</h1><p style=\\'margin:0;max-width:320px;font-size:14px;color:#aebccb\\'>\\u0628\\u0631\\u0627\\u06CC \\u0627\\u0633\\u062A\\u0641\\u0627\\u062F\\u0647 \\u0627\\u0632 \\u0641\\u0631\\u0648\\u0634\\u06AF\\u0627\\u0647\\u060C \\u0644\\u0637\\u0641\\u0627\\u064B \\u0627\\u06CC\\u0646 \\u062F\\u0648 \\u0628\\u0631\\u0646\\u0627\\u0645\\u0647 \\u0631\\u0627 \\u0627\\u0632 \\u06AF\\u0648\\u06AF\\u0644 \\u067E\\u0644\\u06CC \\u0628\\u0647\\u200C\\u0631\\u0648\\u0632\\u0631\\u0633\\u0627\\u0646\\u06CC \\u06A9\\u0646\\u06CC\\u062F \\u0648 \\u0633\\u067E\\u0633 \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0628\\u0627\\u0632 \\u06A9\\u0646\\u06CC\\u062F\\u003A</p><ul style=\\'margin:0;padding:0;list-style:none;font-size:14px;color:#e7edf3;font-weight:600\\'><li style=\\'margin:4px 0\\'>Android System WebView</li><li style=\\'margin:4px 0\\'>Google Chrome</li></ul>';b.appendChild(d);}catch(e){}};var boot=function(){render();var n=0;var iv=setInterval(function(){n++;render();if(n>20)clearInterval(iv);},400);};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}}catch(e){}})();`}
        </Script>
        <script src="https://telegram.org/js/telegram-web-app.js?57" async />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
