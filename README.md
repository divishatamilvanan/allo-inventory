# Allo Inventory — Take-Home Exercise

A Next.js inventory & reservation platform for multi-warehouse retail. Solves the checkout race-condition problem by holding stock for 10 minutes during payment.

## Live Demo

> Deploy to Vercel (instructions below) and paste your URL here.

---

## Local Setup

### Prerequisites
- Node.js 18+
- A hosted Postgres (Neon / Supabase / Railway — free tier is fine)
- A hosted Redis (Upstash — free tier is fine)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory.git
cd allo-inventory
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `REDIS_URL` | Upstash → Redis → Connect → ioredis URL |
| `CRON_SECRET` | Any random string you choose |

### 3. Apply schema & seed

```bash
npx prisma db push        # Creates all tables
npm run db:seed           # Adds 5 products, 3 warehouses, stock levels
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Reservation Expiry — How It Works

**Approach: Vercel Cron + lazy cleanup on read**

Two complementary mechanisms:

1. **Vercel Cron** (`vercel.json`) runs `GET /api/cron/expire-reservations` every minute. It queries for all `PENDING` reservations where `expiresAt < now()`, then for each one atomically decrements the `reserved` count and sets status to `RELEASED`. This is the primary cleanup path in production.

2. **Lazy cleanup on confirm**: When a client POSTs to confirm a reservation, the server checks `expiresAt` before proceeding. If expired, it releases the hold and returns `410 Gone`. This covers edge cases where the cron hasn't run yet.

3. **UI countdown**: The frontend checks expiry client-side. When the timer reaches zero, it updates the displayed status immediately without a page refresh, giving instant feedback even before the cron fires.

The cron is protected by a `CRON_SECRET` env var so it can only be called by Vercel's infrastructure.

---

## Concurrency — How the Race Condition Is Solved

This is the core of the exercise.

**The problem**: Two requests arrive simultaneously for the last unit. Both read `available = 1`, both decrement, and both succeed — overselling by 1.

**The solution: Redis distributed lock + Postgres transaction**

```
Request A ──► SET lock NX ──► acquired ──► read stock ──► UPDATE reserved++ ──► CREATE reservation ──► DEL lock
Request B ──► SET lock NX ──► NOT acquired ──► 503 retry
```

1. Before touching the DB, we attempt `SET lockKey lockToken PX 5000 NX` in Redis. This is atomic — Redis guarantees only one caller gets `NX` (the "only if not exists" flag) when two arrive simultaneously.

2. The winning caller opens a Postgres transaction, re-reads the stock, checks `available >= quantity`, increments `reserved`, and creates the reservation — all in one ACID transaction.

3. The lock is released when done (checked by token to avoid releasing someone else's lock).

4. The losing caller gets a `503` and should retry after a brief backoff.

**Why not just a Postgres transaction?** A plain `SELECT + UPDATE` in Postgres without `SELECT FOR UPDATE` still has a TOCTOU window at the application level. With Redis locking, we serialize access to the critical section entirely, making the DB transaction a safety net rather than the primary guard.

---

## Idempotency (Bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` accept an `Idempotency-Key` header.

If the same key is sent twice, the server:
1. Checks the `IdempotencyKey` table for a matching record
2. Returns the stored response with the original status code — no side effect is repeated

The key is namespaced by endpoint (`reserve:KEY`, `confirm:KEY`) to prevent collisions between operations. Keys are stored indefinitely (a production system would clean them up after 24–48 hours).

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve units. Returns 409 if insufficient stock |
| POST | `/api/reservations/:id/confirm` | Confirm reservation. Returns 410 if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/cron/expire-reservations` | Called by Vercel Cron every minute |

---

## Deploying to Vercel (Step-by-step)

### Step 1: Push to GitHub

```bash
cd allo-inventory
git init
git add .
git commit -m "initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/allo-inventory.git
git branch -M main
git push -u origin main
```

### Step 2: Set up Neon (free Postgres)

1. Go to https://neon.tech → Sign up → New Project
2. Copy the **Connection string** (looks like `postgresql://user:pass@host/db?sslmode=require`)

### Step 3: Set up Upstash (free Redis)

1. Go to https://upstash.com → Sign up → Create Database
2. Choose Redis, pick a region
3. Copy the **ioredis** connection URL from the Connect tab

### Step 4: Deploy on Vercel

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. In **Environment Variables**, add:
   - `DATABASE_URL` = your Neon connection string
   - `REDIS_URL` = your Upstash ioredis URL
   - `CRON_SECRET` = any random string
3. Click **Deploy**

### Step 5: Run migrations & seed on production

After deploy, open **Vercel Dashboard → your project → Settings → Functions** and note your production URL. Then run locally against the prod DB:

```bash
# Still in your local project, with .env.local pointing to the SAME Neon DB
npx prisma db push
npm run db:seed
```

Your live URL is now seeded and ready to demo.

---

## Trade-offs & What I'd Do With More Time

- **Redis lock timeout**: 5 seconds is conservative. Under very high load, 503s could spike. A retry with exponential backoff on the client would smooth this out.
- **Idempotency TTL**: Keys are stored forever. A nightly cleanup job deleting keys older than 48 hours would be the right call.
- **Cron granularity**: Vercel Cron fires at most once per minute. Units stay "reserved" for up to 1 minute past their true expiry. A background worker (e.g., BullMQ + Upstash QStash) would fire exactly at `expiresAt`.
- **Optimistic locking fallback**: If Redis is unavailable, the app currently returns 503. A fallback to `SELECT FOR UPDATE` in Postgres would maintain correctness at the cost of higher DB load.
- **Auth**: There's no user auth — reservations are anonymous. In production, each reservation would be tied to a user session.
- **Tests**: I'd add unit tests for the reservation logic (mocking Prisma transactions) and integration tests for the concurrency scenario (sending 2 simultaneous requests for the last unit).
