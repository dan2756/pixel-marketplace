# Architecture

## Rendering and interaction

The board has a fixed 1280 × 720 world coordinate system. `BoardCanvas` owns a responsive visible
canvas sized in CSS pixels and a DPR-scaled backing store. Ownership is painted once into an
offscreen 1280 × 720 raster, then drawn to the visible canvas with nearest-neighbor sampling.
There is no element per logical pixel.

The public manifest also becomes an `Int32Array` with one integer per logical cell. Its value is a
region index plus one, so hover and deliberate-click ownership lookup is O(1). Selection overlap
checks scan only the proposed rectangle.

Transforms use:

```text
screen = world × scale + offset
```

Wheel and pinch zoom preserve the world coordinate under the pointer/midpoint. The renderer uses
dirty `requestAnimationFrame` passes and three levels of detail: raster only, coarse grid, and
cell-detail grid. Dragging uses an explicit idle/panning/selecting/pinching state machine and a
movement threshold, preventing a pan from opening an owned URL.

The URL stores viewport center and zoom (`x`, `y`, and `z`). `?region=<uuid>` focuses a region.
Every fulfilled claim also has a canonical `/r/<uuid>` page.

## Inventory model

`claims` is a unified reservation/order/ownership table. It stores geometry, chosen color and URL,
unit-price and total snapshots, checkout identifiers, customer email, lease timestamps, and
status. `owner_subject` is nullable groundwork for attaching ownership to a future account
without changing fulfilled purchase identifiers.

PostgreSQL generates half-open integer ranges:

```sql
x_range = int4range(x, x + width, '[)')
y_range = int4range(y, y + height, '[)')
```

A partial GiST exclusion constraint rejects any X _and_ Y overlap while status is `reserved`,
`payment_pending`, or `owned`. Adjacent rectangles are valid. This database constraint, not a
client availability check, is the concurrency guarantee.

Checkout creation validates integers, bounds, the two-pixel minimum, color, normalized HTTP(S)
URL, origin, rate limit, and Turnstile. The reservation insert snapshots the fixed $0.25 unit
price and total, and the overlap decision happens in one transaction using database time. Stripe
creation uses the reservation UUID as its idempotency key. A request UUID uniquely identifies
retries of the same browser attempt.

## Payment state machine

The browser never fulfills a claim. `/api/stripe/webhook` reads the raw request body and verifies
the Stripe signature before processing. `processed_stripe_events.event_id` gives durable
idempotency in the same transaction as the claim transition.

```text
reserved ── Checkout complete/unpaid ──> payment_pending
reserved/payment_pending ── paid webhook ──> owned
reserved/payment_pending ── async failure ──> failed
reserved ── Checkout expiry ──> expired
```

`owned` is terminal for failure/expiry events. A verified paid event can repair an out-of-order
terminal transition; the exclusion constraint still prevents it from silently taking inventory
that has since been allocated.

Dynamic payment methods are enabled by omitting `payment_method_types`. Therefore an unpaid
completed Checkout remains `payment_pending` and continues to exclude overlaps until Stripe
reports success or failure. The reconciliation cron retrieves active Checkout Sessions to recover
from missed webhook deliveries. Reservations with no Checkout Session are released only after
their database-time lease expires.

## Public ownership snapshot

`GET /api/manifest` returns all owned rectangles and one monotonic board revision. It uses a stable
ETag (`"pixels-<revision>"`) plus Vercel CDN revalidation. Since the entire world has only 921,600
cells, one compact snapshot avoids per-viewport database requests and keeps rendering
deterministic.

## Trust boundaries

- Browser: interaction preview only; never authoritative for availability, price, or fulfillment.
- Next.js server: validates requests and coordinates Stripe/database operations.
- PostgreSQL: final arbiter of non-overlap, idempotency, and atomic state.
- Stripe webhook: final arbiter of paid ownership.
- Vercel: origin hosting, DDoS mitigation, firewall, cron, and security headers.
- Cloudflare Turnstile: bot friction on checkout creation, not an inventory guarantee.
