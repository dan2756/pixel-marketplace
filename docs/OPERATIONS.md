# Operations and security

## Required production values

| Variable                         | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                   | Pooled Neon Postgres URL                           |
| `STRIPE_SECRET_KEY`              | Prefer a least-privilege restricted key            |
| `STRIPE_WEBHOOK_SECRET`          | Signature verification for the production endpoint |
| `APP_URL`                        | Canonical HTTPS application origin                 |
| `ALLOWED_ORIGIN`                 | Exact browser origin allowed to create Checkout    |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser-visible Turnstile widget key               |
| `TURNSTILE_SECRET_KEY`           | Server-only Siteverify secret                      |
| `CRON_SECRET`                    | Bearer secret for reconciliation                   |

Store server values as sensitive Vercel environment variables. Use distinct Stripe keys,
webhook endpoints, databases, and Turnstile widgets for preview and production.

## Release sequence

1. Provision Neon and run `npm run db:migrate` against the target database.
2. Configure Vercel environment values for the intended environment.
3. Deploy and verify `GET /api/manifest`.
4. Register `/api/stripe/webhook` in Stripe Workbench with the four Checkout Session events listed
   in the README.
5. Complete a test-mode purchase and verify the claim changes only after the webhook.
6. Confirm the reconciliation cron receives Vercel's `Authorization: Bearer <CRON_SECRET>`.
7. Set Turnstile hostname restrictions to the production and intended preview domains.

The migration is hand-authored because Drizzle's generated schema does not fully express the
partial GiST exclusion constraint. Keep `drizzle/0000_pixel_marketplace.sql` as the source of
truth for that constraint.

## Cloudflare and Vercel

Vercel's DDoS mitigation and Firewall protect the actual Vercel origin and remain the primary
controls. Turnstile is validated server-side on checkout creation; its tokens are single-use and
expire after five minutes. The Stripe webhook is never challenged and is marked `no-store`.

An optional custom domain can be proxied through Cloudflare for additional managed WAF and rate
rules:

- Cache only public `GET /api/manifest` responses; bypass `/api/checkout`,
  `/api/status/*`, `/api/stripe/webhook`, and `/api/cron/*`.
- Do not apply challenges to `/api/stripe/webhook`.
- Restrict checkout requests by method and rate, but retain the application's database-backed
  limiter and Turnstile validation.
- Preserve WebSocket/HTTPS defaults and set SSL mode to Full (strict).

This proxy does **not** fully protect a directly reachable `*.vercel.app` origin. Do not claim that
it does. If the Vercel URL must not serve general traffic, use Vercel Deployment Protection or a
Vercel Firewall rule compatible with Stripe webhook delivery and operational access. Test those
rules before launch.

## Security properties

- Destination URLs are normalized once and restricted to HTTP(S), with embedded credentials
  rejected. External links use a new browsing context with `noopener,noreferrer`.
- A restrictive CSP permits only the app, Stripe, Link, and Turnstile surfaces required here.
- Checkout POSTs enforce an exact origin, a database-backed per-minute IP limit, body-size limits,
  Turnstile, and server-side schema validation.
- Stripe webhook signatures are verified from the untouched raw body.
- Secret values are not shipped to client bundles or committed.
- Manifest and canonical region responses never expose purchaser email. The unguessable
  reservation status endpoint returns only a masked email.
- `owned` claims are never released automatically. Refund/dispute policy is intentionally an
  operator decision for this MVP.

## Reconciliation and incident handling

The cron scans at most 100 stale active claims per run. It expires leases that never obtained a
Checkout Session and retrieves Stripe state for sessions that did. Pending asynchronous payments
remain reserved until a final event.

Monitor:

- 5xx responses from `/api/stripe/webhook`
- reconciliation `errors > 0`
- repeated GiST conflict failures during paid fulfillment
- active `reserved` or `payment_pending` claims older than policy allows
- Stripe events with no matching `reservation_id`

A paid fulfillment that conflicts after an unusual out-of-order release is intentionally rolled
back so Stripe retries. Investigate the two claims before manual correction or refund; never
disable the exclusion constraint to force fulfillment.

## External integration tests

`npm run test:db` runs the real exclusion and durable-event-idempotency tests only when
`TEST_DATABASE_URL` is present. It creates and drops a random schema. Stripe live/test network
calls are not part of automated CI: Playwright intercepts Checkout and status endpoints, while
unit tests exercise the payment transition reducer. Complete one Stripe test-mode end-to-end
purchase before launch.
