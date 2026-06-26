import { PrismaClient } from "@prisma/client"
import { randomBytes, randomUUID } from "crypto"

const prisma = new PrismaClient()

function slug(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("base64url")}`
}

async function main() {
  console.log("Seeding Bot Subio...")

  // Reset (safe for a fresh dev DB).
  await prisma.delivery.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.watchlistEntry.deleteMany()
  await prisma.auction.deleteMany()
  await prisma.fixedSale.deleteMany()
  await prisma.product.deleteMany()
  await prisma.walletTransaction.deleteMany()
  await prisma.wallet.deleteMany()
  await prisma.user.deleteMany()

  // --- Users + wallets ------------------------------------------------------
  const users = [
    { displayName: "Admin", alias: "Admin", role: "ADMIN" as const, balance: 0n },
    { displayName: "Sara M.", alias: `Bidder#${randomBytes(2).toString("hex")}`, role: "USER" as const, balance: 5_000_000n },
    { displayName: "Reza K.", alias: `Bidder#${randomBytes(2).toString("hex")}`, role: "USER" as const, balance: 8_000_000n },
    { displayName: "Niloofar T.", alias: `Bidder#${randomBytes(2).toString("hex")}`, role: "USER" as const, balance: 3_500_000n },
  ]

  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        displayName: u.displayName,
        alias: u.alias,
        role: u.role,
        username: u.displayName.toLowerCase().replace(/[^a-z]/g, "") || undefined,
      },
    })
    const wallet = await prisma.wallet.create({
      data: { userId: user.id, totalBalance: u.balance },
    })
    if (u.balance > 0n) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEPOSIT",
          amount: u.balance,
          balanceAfter: u.balance,
          frozenAfter: 0n,
          refType: "seed",
          note: "Initial demo balance",
        },
      })
    }
  }

  // --- Flash sale: automatic delivery (inventory pool) ----------------------
  const chatgpt = await prisma.product.create({
    data: {
      slug: slug("chatgpt-plus"),
      title: "ChatGPT Plus — 1 Month",
      description: "Premium GPT access with priority availability. Instant automatic delivery.",
      category: "AI",
      tags: ["ai", "openai", "subscription"],
      coverImage: "/products/chatgpt-plus.png",
      saleMode: "FIXED_PRICE",
      deliveryType: "AUTOMATIC",
      fixedSale: { create: { price: 750_000n, stock: 5, purchaseLimit: 2 } },
    },
  })
  // Inventory pool — each item is single-use.
  for (let i = 1; i <= 5; i++) {
    await prisma.inventoryItem.create({
      data: {
        productId: chatgpt.id,
        username: `gpt_user_${i}@subio.mail`,
        password: randomUUID().slice(0, 12),
        note: "Do not change the recovery email.",
      },
    })
  }

  // --- Flash sale: manual delivery ------------------------------------------
  await prisma.product.create({
    data: {
      slug: slug("premium-vpn"),
      title: "Premium VPN — 3 Months",
      description: "High-speed VPN across 60+ regions. Delivered manually within minutes.",
      category: "VPN",
      tags: ["vpn", "privacy"],
      coverImage: "/products/premium-vpn.png",
      saleMode: "FIXED_PRICE",
      deliveryType: "MANUAL",
      fixedSale: { create: { price: 480_000n, stock: 20 } },
    },
  })

  const now = Date.now()

  // --- Auction: standard with buy-now ---------------------------------------
  await prisma.product.create({
    data: {
      slug: slug("netflix-4k"),
      title: "Netflix Premium 4K — 1 Year",
      description: "Ultra HD, 4 screens. Bid to win or buy now instantly.",
      category: "Streaming",
      tags: ["netflix", "streaming", "4k"],
      coverImage: "/products/netflix-4k.png",
      saleMode: "AUCTION",
      deliveryType: "MANUAL",
      auction: {
        create: {
          startPrice: 1_200_000n,
          minimumIncrement: 50_000n,
          buyNowPrice: 4_500_000n,
          reservePrice: 2_000_000n,
          startTime: new Date(now - 60_000),
          endTime: new Date(now + 60 * 60 * 1000),
          status: "ACTIVE",
          quantity: 1,
        },
      },
    },
  })

  // --- Multi-winner auction -------------------------------------------------
  await prisma.product.create({
    data: {
      slug: slug("spotify-family"),
      title: "Spotify Premium — 6 Months",
      description: "Two winners! The top 2 bidders each receive a 6-month subscription.",
      category: "Music",
      tags: ["spotify", "music"],
      coverImage: "/products/spotify-family.png",
      saleMode: "AUCTION",
      deliveryType: "AUTOMATIC",
      auction: {
        create: {
          startPrice: 600_000n,
          minimumIncrement: 30_000n,
          startTime: new Date(now - 60_000),
          endTime: new Date(now + 30 * 60 * 1000),
          status: "ACTIVE",
          quantity: 2,
        },
      },
    },
  })
  // Give the multi-winner auction an automatic delivery pool too.
  const spotify = await prisma.product.findFirst({ where: { title: { contains: "Spotify" } } })
  if (spotify) {
    for (let i = 1; i <= 3; i++) {
      await prisma.inventoryItem.create({
        data: {
          productId: spotify.id,
          username: `spotify_${i}@subio.mail`,
          password: randomUUID().slice(0, 10),
        },
      })
    }
  }

  // --- Flash auction (short) ------------------------------------------------
  await prisma.product.create({
    data: {
      slug: slug("midjourney-pro"),
      title: "Midjourney Pro — Flash Auction",
      description: "5-minute flash auction with anti-sniping. Move fast!",
      category: "AI",
      tags: ["midjourney", "ai", "flash"],
      coverImage: "/products/midjourney-pro.png",
      saleMode: "AUCTION",
      deliveryType: "MANUAL",
      auction: {
        create: {
          startPrice: 900_000n,
          minimumIncrement: 25_000n,
          startTime: new Date(now - 30_000),
          endTime: new Date(now + 5 * 60 * 1000),
          antiSnipingEnabled: true,
          antiSnipingSeconds: 60,
          status: "ACTIVE",
          quantity: 1,
        },
      },
    },
  })

  // --- Demo deposit / withdrawal requests (for the admin finance queues) ----
  const sara = await prisma.user.findFirst({ where: { displayName: "Sara M." } })
  const reza = await prisma.user.findFirst({ where: { displayName: "Reza K." } })
  if (sara) {
    await prisma.depositRequest.create({
      data: {
        publicId: slug("dep"),
        userId: sara.id,
        amount: 2_000_000n,
        status: "PENDING",
        cardLast4: "4827",
        reference: "TRX-" + randomBytes(3).toString("hex").toUpperCase(),
        note: "واریز کارت به کارت بانک ملت",
      },
    })
    await prisma.withdrawalRequest.create({
      data: {
        publicId: slug("wd"),
        userId: sara.id,
        amount: 1_000_000n,
        status: "PENDING",
        iban: "IR820170000000123456789012",
        cardNumber: "6037-99**-****-4827",
        note: "درخواست برداشت به حساب شخصی",
      },
    })
  }
  if (reza) {
    await prisma.depositRequest.create({
      data: {
        publicId: slug("dep"),
        userId: reza.id,
        amount: 500_000n,
        status: "PENDING",
        cardLast4: "1135",
        reference: "TRX-" + randomBytes(3).toString("hex").toUpperCase(),
      },
    })
  }

  console.log("Seed complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
