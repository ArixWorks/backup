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
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
