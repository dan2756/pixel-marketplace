import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import type { z } from "zod";

import { RESERVATION_LEASE_MINUTES, UNIT_PRICE_CENTS } from "@/lib/constants";
import type { OwnershipManifest, ReservationStatus } from "@/lib/types";
import { calculatePriceCents } from "@/lib/validation";
import type { checkoutRequestSchema } from "@/lib/validation";

import { getDatabase } from "./db/client";
import { boardState, claims, type Claim } from "./db/schema";
import { appUrl } from "./env";
import { getStripe, integrationIdentifier } from "./stripe";

type CheckoutInput = z.infer<typeof checkoutRequestSchema>;

export type CheckoutResult = {
  reservationId: string;
  checkoutUrl: string;
  expiresAt: string;
};

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const db = getDatabase();
  const totalCents = calculatePriceCents(input.rect.width, input.rect.height);
  let claim: Claim;

  try {
    claim = await db.transaction(async (transaction) => {
      await transaction
        .update(claims)
        .set({
          status: "expired",
          failureReason: "Reservation lease expired before Checkout was created.",
          updatedAt: sql`transaction_timestamp()`,
        })
        .where(
          and(
            eq(claims.status, "reserved"),
            lt(claims.expiresAt, sql`transaction_timestamp()`),
            sql`${claims.checkoutSessionId} is null`,
          ),
        );

      const existing = await transaction.query.claims.findFirst({
        where: eq(claims.idempotencyKey, input.idempotencyKey),
      });

      if (existing) {
        if (!sameCheckoutRequest(existing, input, totalCents)) {
          throw new CheckoutConflictError(
            "This idempotency key was already used for a different selection.",
          );
        }
        if (!["reserved", "payment_pending"].includes(existing.status)) {
          throw new CheckoutConflictError("This checkout attempt can no longer be resumed.");
        }
        return existing;
      }

      const [created] = await transaction
        .insert(claims)
        .values({
          id: randomUUID(),
          x: input.rect.x,
          y: input.rect.y,
          width: input.rect.width,
          height: input.rect.height,
          color: input.color,
          destinationUrl: input.destinationUrl,
          unitPriceCents: UNIT_PRICE_CENTS,
          totalCents,
          idempotencyKey: input.idempotencyKey,
          expiresAt: sql`transaction_timestamp() + (${RESERVATION_LEASE_MINUTES} * interval '1 minute')`,
        })
        .returning();

      return created;
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23P01") {
      throw new InventoryConflictError("Some pixels in this selection are no longer available.");
    }
    if (postgresErrorCode(error) === "23505") {
      const existing = await db.query.claims.findFirst({
        where: eq(claims.idempotencyKey, input.idempotencyKey),
      });
      if (existing && sameCheckoutRequest(existing, input, totalCents)) {
        claim = existing;
      } else {
        throw new CheckoutConflictError("Checkout request could not be safely resumed.");
      }
    } else {
      throw error;
    }
  }

  if (claim.checkoutUrl) {
    return {
      reservationId: claim.id,
      checkoutUrl: claim.checkoutUrl,
      expiresAt: claim.expiresAt.toISOString(),
    };
  }

  const stripe = getStripe();
  const baseUrl = appUrl();
  const sessionParameters: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_creation: "always",
    client_reference_id: claim.id,
    integration_identifier: integrationIdentifier(claim.id),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: claim.totalCents,
          product_data: {
            name: `${claim.width} × ${claim.height} pixel region`,
            description: `Canvas position (${claim.x}, ${claim.y}) · ${(claim.width * claim.height).toLocaleString()} logical pixels`,
          },
        },
      },
    ],
    metadata: {
      reservation_id: claim.id,
      x: String(claim.x),
      y: String(claim.y),
      width: String(claim.width),
      height: String(claim.height),
    },
    payment_intent_data: {
      metadata: {
        reservation_id: claim.id,
      },
    },
    expires_at: Math.floor(claim.expiresAt.getTime() / 1000),
    success_url: `${baseUrl}/success?reservation_id=${claim.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?x=${claim.x + claim.width / 2}&y=${claim.y + claim.height / 2}&z=8&cancelled=1`,
  };

  const session = await stripe.checkout.sessions.create(sessionParameters, {
    idempotencyKey: `pixel-checkout-${claim.id}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a hosted Checkout URL.");
  }

  const [updated] = await db
    .update(claims)
    .set({
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      expiresAt: new Date(session.expires_at * 1000),
      updatedAt: sql`transaction_timestamp()`,
    })
    .where(and(eq(claims.id, claim.id), inArray(claims.status, ["reserved", "payment_pending"])))
    .returning();

  if (!updated) {
    throw new CheckoutConflictError("Reservation changed before Checkout could start.");
  }

  return {
    reservationId: updated.id,
    checkoutUrl: session.url,
    expiresAt: updated.expiresAt.toISOString(),
  };
}

export async function getOwnershipManifest(): Promise<OwnershipManifest> {
  const db = getDatabase();
  const [state, owned] = await Promise.all([
    db.query.boardState.findFirst({ where: eq(boardState.singleton, true) }),
    db.query.claims.findMany({
      columns: {
        id: true,
        x: true,
        y: true,
        width: true,
        height: true,
        color: true,
        destinationUrl: true,
        purchasedAt: true,
      },
      where: eq(claims.status, "owned"),
      orderBy: (claim, { asc }) => [asc(claim.purchasedAt), asc(claim.id)],
    }),
  ]);

  return {
    revision: state?.revision ?? 0,
    generatedAt: new Date().toISOString(),
    regions: owned.map((claim) => ({
      id: claim.id,
      x: claim.x,
      y: claim.y,
      width: claim.width,
      height: claim.height,
      color: claim.color,
      destinationUrl: claim.destinationUrl,
      purchasedAt: claim.purchasedAt?.toISOString() ?? new Date(0).toISOString(),
    })),
  };
}

export async function getReservationStatus(id: string): Promise<ReservationStatus | null> {
  const claim = await getDatabase().query.claims.findFirst({
    columns: {
      id: true,
      status: true,
      customerEmail: true,
      expiresAt: true,
      updatedAt: true,
    },
    where: eq(claims.id, id),
  });
  if (!claim) return null;

  return {
    id: claim.id,
    status: claim.status,
    regionUrl: claim.status === "owned" ? `${appUrl()}/r/${claim.id}` : null,
    customerEmail: maskEmail(claim.customerEmail),
    expiresAt: claim.expiresAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

export async function getPublicRegion(id: string) {
  return getDatabase().query.claims.findFirst({
    columns: {
      id: true,
      x: true,
      y: true,
      width: true,
      height: true,
      color: true,
      destinationUrl: true,
      purchasedAt: true,
    },
    where: and(eq(claims.id, id), eq(claims.status, "owned")),
  });
}

function sameCheckoutRequest(claim: Claim, input: CheckoutInput, totalCents: number): boolean {
  return (
    claim.x === input.rect.x &&
    claim.y === input.rect.y &&
    claim.width === input.rect.width &&
    claim.height === input.rect.height &&
    claim.color === input.color &&
    claim.destinationUrl === input.destinationUrl &&
    claim.totalCents === totalCents
  );
}

function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return postgresErrorCode(error.cause);
  return undefined;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  return `${local.slice(0, 2)}${local.length > 2 ? "•••" : ""}@${domain}`;
}

export class InventoryConflictError extends Error {}
export class CheckoutConflictError extends Error {}
