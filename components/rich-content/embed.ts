/**
 * Convert a pasted media URL into an embeddable iframe src + provider label.
 * Supports YouTube, Vimeo, Aparat and Telegram; falls back to the raw URL for
 * any other standard embeddable link.
 */
export function parseEmbed(url: string): { src: string; provider: string } | null {
  const u = url.trim()
  if (!u) return null

  // YouTube
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}`, provider: "youtube" }

  // Vimeo
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { src: `https://player.vimeo.com/video/${vimeo[1]}`, provider: "vimeo" }

  // Aparat
  const aparat = u.match(/aparat\.com\/v\/([\w-]+)/)
  if (aparat) return { src: `https://www.aparat.com/video/video/embed/videohash/${aparat[1]}/vt/frame`, provider: "aparat" }

  // Telegram (post embed)
  const tg = u.match(/t\.me\/([\w-]+)\/(\d+)/)
  if (tg) return { src: `https://t.me/${tg[1]}/${tg[2]}?embed=1`, provider: "telegram" }

  // Generic iframe-able URL
  if (/^https?:\/\//.test(u)) return { src: u, provider: "generic" }
  return null
}
