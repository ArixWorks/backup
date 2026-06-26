# Bot Subio

A production-grade marketplace for digital goods built around **live auctions** and **flash sales**, with an internal wallet, automatic inventory delivery, and automatic rollback on delivery failure.

The platform is designed as a **shared core API** so that the web app, a Telegram bot, and a Telegram Mini App can all plug into the same backend without re-implementing business logic. New channels (mobile apps, admin panels, partner integrations) can be added later without touching the core.

## Architecture

```
                  ┌─────────────────────────────────────┐
   Web App ──────▶│                                     │
   Telegram Bot ─▶│   Shared REST API  (/api/v1/*)      │
   Mini App ─────▶│                                     │
   Mobile (future)│   ┌───────────────────────────────┐ │
                  │   │  Core domain services (lib/core)│ │
                  │   │  wallet · auction · flash-sale  │ │
                  │   │  delivery · catalog             │ │
                  │   └───────────────────────────────┘ │
                  └───────────────┬─────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              PostgreSQL 16                 Redis 7
        (ACID, row locking, indexes)  (cache · locks · queues · pub/sub)
```

### Core modules (`lib/core`)

| Module        | Responsibility |
|---------------|----------------|
| `wallet.ts`   | Internal wallet. Immutable ledger, atomic freeze/unfreeze/debit/credit inside DB transactions, optimistic locking, non-negative + `frozen <= total` invariants. |
| `auction.ts`  | Live auctions. Freezes only the **difference** on re-bids, releases outbid users, anti-sniping time extension, buy-now, multi-winner finalization, delivery with automatic refund on failure. |
| `flash-sale.ts` | Fixed-price sales. Temporary reservation (hold), direct purchase, automatic delivery, automatic rollback on delivery error. |
| `delivery.ts` | Inventory Pool. Atomically claims a stock item per order and supports rollback (returns the item to the pool + refunds). |
| `catalog.ts`  | Read-side queries for products, auctions, and flash sales. |

Bidding is serialized per-auction with a Redis distributed lock plus a serializable DB transaction, so concurrent bids cannot corrupt balances or the highest-bid state.

### Shared API (`app/api/v1`)

All clients use the same endpoints:

- `GET  /api/v1/auctions` · `GET /api/v1/auctions/:id`
- `POST /api/v1/auctions/:id/bids` · `/buy-now` · `/finalize`
- `GET  /api/v1/flash-sales`
- `POST /api/v1/flash-sales/:productId/reserve` · `/purchase`
- `GET  /api/v1/wallet` · `POST /api/v1/wallet/topup`
- `GET  /api/v1/orders`
- `GET/POST/DELETE /api/v1/auth/session`
- `POST /api/v1/cron/tick` — finalizes ended auctions and releases expired reservations (call from a scheduler/cron).

## Money

All amounts are stored as **`BigInt` in Toman** (no decimal places) to avoid floating-point errors. They are serialized to strings/numbers at the API boundary.

## Self-hosting

Requirements: Docker + Docker Compose.

```bash
cp .env.example .env
# edit SESSION_SECRET and credentials
docker compose up -d --build
```

This starts:
- **PostgreSQL 16** (persistent volume, health-checked)
- **Redis 7** (AOF persistence)
- **app** — applies migrations / schema, then serves on port 3000

### Local development (without Docker)

```bash
pnpm install
# point POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING at your Postgres
pnpm exec prisma db push      # or: pnpm run db:migrate
pnpm run db:seed              # demo users, products, auctions, inventory pool
pnpm dev
```

If `REDIS_URL` is unset, an in-memory Redis stand-in is used (development only — use real Redis in production for locks and pub/sub to work across instances).

## Demo accounts

The seed creates an admin and several bidders. Use the account switcher in the header to act as different users (demo auth — replace with real auth such as Telegram login or Better Auth for production).

## Extensibility

Because business logic lives in `lib/core` and is exposed only through `/api/v1`, you can add:
- a **Telegram bot** that calls the same endpoints,
- a **Telegram Mini App** (the web UI already works inside the Telegram WebView),
- an **admin panel**, **notifications service**, or **mobile app**,

without rewriting the core. Swap the demo session module (`lib/auth/session.ts`) for JWT or Better Auth when wiring real authentication.
