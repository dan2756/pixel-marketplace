import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { deriveClaimTransition } from "@/lib/payment-state";

import { getDatabase } from "./db/client";
import { boardState, claims, processedStripeEvents } from "./db/schema";
import { getStripe } from "./stripe";

const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export function constructStripeEvent(rawBody: string, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function processStripeEvent(
  event: Stripe.Event,
  rawBody: string,
): Promise<{ duplicate: boolean; handled: boolean }> {
  const db = getDatabase();
  const session = handledEvents.has(event.type)
    ? (event.data.object as Stripe.Checkout.Session)
    : null;
  const claimId = session ? getClaimId(session) : null;
  const digest = createHash("sha256").update(rawBody).digest("hex");

  return db.transaction(async (transaction) => {
    const [inserted] = await transaction
      .insert(processedStripeEvents)
      .values({
        eventId: event.id,
        eventType: event.type,
        eventCreatedAt: new Date(event.created * 1000),
        claimId,
        payloadDigest: digest,
      })
      .onConflictDoNothing()
      .returning({ eventId: processedStripeEvents.eventId });

    if (!inserted) return { duplicate: true, handled: handledEvents.has(event.type) };
    if (!session || !claimId) return { duplicate: false, handled: false };

    await applySessionTransition(transaction, session, event.type, new Date(event.created * 1000));
    return { duplicate: false, handled: true };
  });
}

export async function reconcileCheckouts(): Promise<{
  examined: number;
  updated: number;
  errors: number;
}> {
  const db = getDatabase();
  const candidates = await db.query.claims.findMany({
    columns: {
      id: true,
      checkoutSessionId: true,
      status: true,
      expiresAt: true,
    },
    where: and(
      inArray(claims.status, ["reserved", "payment_pending"]),
      sql`${claims.updatedAt} < transaction_timestamp() - interval '90 seconds'`,
    ),
    orderBy: (claim, { asc }) => [asc(claim.updatedAt)],
    limit: 100,
  });

  let updated = 0;
  let errors = 0;
  const stripe = getStripe();

  for (const candidate of candidates) {
    try {
      if (!candidate.checkoutSessionId) {
        if (candidate.expiresAt.getTime() <= Date.now()) {
          const result = await db
            .update(claims)
            .set({
              status: "expired",
              failureReason: "Checkout was not created before the reservation lease expired.",
              updatedAt: sql`transaction_timestamp()`,
            })
            .where(and(eq(claims.id, candidate.id), eq(claims.status, "reserved")))
            .returning({ id: claims.id });
          updated += result.length;
        }
        continue;
      }

      const session = await stripe.checkout.sessions.retrieve(candidate.checkoutSessionId);
      const changed = await db.transaction(async (transaction) =>
        applySessionTransition(
          transaction,
          session,
          reconciliationEventType(session),
          new Date(),
        ),
      );
      if (changed) updated += 1;
    } catch {
      errors += 1;
    }
  }

  return { examined: candidates.length, updated, errors };
}

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

async function applySessionTransition(
  transaction: Transaction,
  session: Stripe.Checkout.Session,
  eventType: string,
  eventCreatedAt: Date,
): Promise<boolean> {
  const claimId = getClaimId(session);
  if (!claimId) return false;

  const existing = await transaction.query.claims.findFirst({
    where: eq(claims.id, claimId),
  });
  if (!existing) return false;

  const desired = deriveClaimTransition({
    eventType,
    checkoutStatus: session.status,
    paymentStatus: session.payment_status,
    currentStatus: existing.status,
  });
  if (!desired) return false;
  const eligibleStatuses =
    desired === "owned"
      ? (["reserved", "payment_pending", "failed", "expired", "cancelled"] as const)
      : desired === "payment_pending" || desired === "expired"
        ? (["reserved"] as const)
        : (["reserved", "payment_pending"] as const);

  const [updated] = await transaction
    .update(claims)
    .set({
      status: desired,
      checkoutSessionId: session.id,
      checkoutUrl: null,
      customerEmail: customerEmail(session) ?? existing.customerEmail,
      purchasedAt: desired === "owned" ? sql`transaction_timestamp()` : existing.purchasedAt,
      failureReason:
        desired === "failed"
          ? "Stripe reported that the asynchronous payment failed."
          : desired === "expired"
            ? "Stripe Checkout expired before payment."
            : null,
      stripeEventCreatedAt: latestDate(existing.stripeEventCreatedAt, eventCreatedAt),
      updatedAt: sql`transaction_timestamp()`,
    })
    .where(and(eq(claims.id, existing.id), inArray(claims.status, [...eligibleStatuses])))
    .returning({ id: claims.id });

  if (updated && desired === "owned") {
    await transaction
      .update(boardState)
      .set({
        revision: sql`${boardState.revision} + 1`,
        updatedAt: sql`transaction_timestamp()`,
      })
      .where(eq(boardState.singleton, true));
  }

  return Boolean(updated);
}

function reconciliationEventType(session: Stripe.Checkout.Session): string {
  return session.status === "expired" ? "checkout.session.expired" : "reconcile";
}

function getClaimId(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.reservation_id ?? session.client_reference_id ?? null;
}

function customerEmail(session: Stripe.Checkout.Session): string | null {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

function latestDate(current: Date | null, next: Date): Date {
  return !current || next > current ? next : current;
}
