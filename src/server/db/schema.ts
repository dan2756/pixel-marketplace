import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { BOARD_HEIGHT, BOARD_WIDTH, UNIT_PRICE_CENTS } from "@/lib/constants";

export const claimStatus = pgEnum("claim_status", [
  "reserved",
  "payment_pending",
  "owned",
  "expired",
  "cancelled",
  "failed",
]);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey(),
    status: claimStatus("status").notNull().default("reserved"),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    destinationUrl: text("destination_url").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull().default(UNIT_PRICE_CENTS),
    totalCents: integer("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    checkoutSessionId: text("checkout_session_id"),
    checkoutUrl: text("checkout_url"),
    customerEmail: text("customer_email"),
    ownerSubject: text("owner_subject"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    stripeEventCreatedAt: timestamp("stripe_event_created_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("claims_idempotency_key_uq").on(table.idempotencyKey),
    uniqueIndex("claims_checkout_session_id_uq")
      .on(table.checkoutSessionId)
      .where(sql`${table.checkoutSessionId} is not null`),
    index("claims_status_expires_idx").on(table.status, table.expiresAt),
    index("claims_owned_purchased_idx")
      .on(table.purchasedAt)
      .where(sql`${table.status} = 'owned'`),
    check("claims_x_bounds", sql`${table.x} >= 0 and ${table.x} < ${BOARD_WIDTH}`),
    check("claims_y_bounds", sql`${table.y} >= 0 and ${table.y} < ${BOARD_HEIGHT}`),
    check(
      "claims_dimensions",
      sql`${table.width} > 0 and ${table.height} > 0 and ${table.x} + ${table.width} <= ${BOARD_WIDTH} and ${table.y} + ${table.height} <= ${BOARD_HEIGHT}`,
    ),
    check(
      "claims_price_snapshot",
      sql`${table.unitPriceCents} > 0 and ${table.totalCents} = ${table.width} * ${table.height} * ${table.unitPriceCents}`,
    ),
  ],
);

export const processedStripeEvents = pgTable("processed_stripe_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
  claimId: uuid("claim_id"),
  payloadDigest: varchar("payload_digest", { length: 64 }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardState = pgTable("board_state", {
  singleton: boolean("singleton").primaryKey().default(true),
  revision: bigint("revision", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.identifierHash, table.windowStart] }),
    check("rate_limits_positive_count", sql`${table.requestCount} > 0`),
  ],
);

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
