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
