// Security headers applied to every response (pages, assets and API).
// `frame-ancestors` allows our own origin plus Telegram's web client so the
// Mini App keeps working while blocking clickjacking from arbitrary sites.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org;",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle for the Docker image (no effect on dev).
  output: 'standalone',
  images: {
    // Serve resized, modern-format (AVIF/WebP) images via the built-in
    // optimizer (sharp). Local /public assets and same-origin file routes are
    // optimized on the fly; remote patterns cover any externally hosted media.
    formats: ['image/avif', 'image/webp'],
    // Cache optimized derivatives aggressively at the edge/CDN.
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [360, 420, 640, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  // Modularize large barrel packages so each route only ships the exact icons /
  // primitives it renders instead of the union across the whole app. This alone
  // slashes the shared lucide/recharts/motion chunks dramatically.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'motion',
      'date-fns',
      '@base-ui/react',
    ],
  },
  // Strip console.* in production (keep warnings/errors) to shave parse/exec time.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  // Never ship source maps to the browser in prod (smaller, faster transfers).
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
