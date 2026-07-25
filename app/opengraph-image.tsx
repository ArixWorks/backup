import { ImageResponse } from "next/og"
import mascotArtwork from "@/public/brand/subio-og.png"

export const alt = "SubIO — بازار هوشمند محصولات دیجیتال و مزایده‌های آنلاین"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#080f19",
          color: "#f5f7fa",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* The locally stored mascot artwork is the stable brand source for all social cards. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mascotArtwork.src}
          alt=""
          width={630}
          height={630}
          style={{
            position: "absolute",
            insetInlineEnd: 0,
            top: 0,
            width: 630,
            height: 630,
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: 0,
            width: 700,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px",
            background: "#080f19",
            borderRight: "1px solid #173447",
          }}
        >
          <div style={{ width: 56, height: 6, borderRadius: 3, background: "#20e3e7", marginBottom: 34 }} />
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 92, fontWeight: 800, letterSpacing: -4 }}>
            <span>Sub</span>
            <span style={{ color: "#20e3e7" }}>IO</span>
          </div>
          <div style={{ fontSize: 31, fontWeight: 600, marginTop: 18, color: "#d8e0e8" }}>
            Digital commerce, reimagined.
          </div>
          <div style={{ fontSize: 21, marginTop: 19, color: "#8fa3b8" }}>
            Premium accounts · Smart auctions · Secure delivery
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 280,
              height: 54,
              marginTop: 48,
              border: "2px solid #20e3e7",
              borderRadius: 27,
              color: "#20e3e7",
              background: "#0d2933",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            acciran.com
          </div>
        </div>
      </div>
    ),
    size,
  )
}
