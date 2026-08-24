# One Million Pixels

A production-oriented MVP for selling rectangular regions of a fixed 1280 × 720 logical-pixel
canvas. The UI renders 921,600 cells with Canvas 2D (never DOM nodes), while PostgreSQL and
Stripe webhooks remain authoritative for inventory and ownership.

## Stack

- Next.js App Router, React, and TypeScript
- Canvas 2D with an offscreen ownership raster and an O(1) `Int32Array` hit-test index
- Drizzle ORM with Neon Postgres
- Stripe-hosted Checkout Sessions with dynamic payment methods
- Cloudflare Turnstile on checkout creation
- Vitest, fast-check, and Playwright

## Local setup

1. Copy `.env.example` to `.env.local` and provide a Neon `DATABASE_URL`.
2. Apply the hand-authored migration:

   ```bash
   npm run db:migrate
   ```

3. Optionally add sample owned regions:

   ```bash
   npm run db:seed
   ```

4. Add Stripe test-mode credentials and forward events:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   npm run dev
   ```

Use a Stripe restricted key with only the Checkout Session permissions this service needs. The
webhook secret, Stripe key, database URL, Turnstile secret, and cron secret are server-only.

Turnstile is optional outside production. In production, both
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` must be configured or checkout fails
closed.

## Commands

```bash
npm run dev          # local Next.js server
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # unit/property tests
npm run test:db      # real Postgres tests; requires TEST_DATABASE_URL
npm run test:e2e     # Playwright desktop/mobile flows
npm run build        # production build
npm run format:check # formatting verification
```

The database test uses a temporary schema and is explicitly skipped when `TEST_DATABASE_URL` is
not set. Never point that variable at production.

## Payment and ownership lifecycle

Each logical pixel costs $0.25. Checkout requires at least two pixels ($0.50). Creating Checkout
atomically inserts a short reservation with price and product snapshots. A PostgreSQL GiST
exclusion constraint over generated half-open X/Y ranges prevents concurrent active rectangles
from overlapping.

Stripe Checkout is hosted by Stripe and omits `payment_method_types`, allowing dynamic payment
methods such as Link when eligible. A browser return never grants ownership. Only a verified,
idempotently recorded webhook can move a claim to `owned`. Unpaid completed sessions remain
`payment_pending`, so delayed payment methods do not release inventory before their final result.
The Vercel cron reconciles missed events and stale sessions every five minutes.

## Deployment

The app is ready for Vercel. Configure the environment values from `.env.example`, run the
migration against the production Neon database, deploy, then register:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

for `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.

See [architecture](docs/ARCHITECTURE.md) and [operations/security](docs/OPERATIONS.md) for the
concurrency model, webhook behavior, reconciliation, Vercel protections, and optional Cloudflare
WAF configuration.
