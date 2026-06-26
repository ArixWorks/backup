import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Vazirmatn, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/app-shell'
import { getActiveTheme, THEMES, DEFAULT_THEME } from '@/lib/core/settings'
import './globals.css'

// Vazirmatn: the complete, professional open Persian/Arabic UI typeface
// (successor to Vazir). Self-hosted and optimized by next/font.
const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-vazirmatn',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'بات سوبیو | بازار مزایده و فروش فوری محصولات دیجیتال',
  description:
    'پلتفرم حرفه‌ای مزایده زنده و فروش فوری محصولات دیجیتال با کیف پول داخلی، تحویل خودکار و تجربه‌ای امن و سریع.',
  generator: 'v0.app',
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getActiveTheme().catch(() => DEFAULT_THEME)
  const headerColor =
    THEMES.find((t) => t.id === theme)?.headerColor ?? '#1a1d24'
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
  const theme = await getActiveTheme().catch(() => DEFAULT_THEME)
  return (
    <html
      lang="fa"
      dir="rtl"
      data-theme={theme}
      className={`dark bg-background ${vazirmatn.variable} ${geistMono.variable}`}
    >
      <head>
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
