import { describe, expect, it } from "vitest";

import {
  MIN_CHARGE_CENTS,
  MIN_SELECTION_PIXELS,
  SUGGESTED_STARTER_SIZE,
  UNIT_PRICE_CENTS,
} from "@/lib/constants";
import { calculatePriceCents, snapshotReservationPrice } from "@/lib/pricing";
import { evaluateSelection, selectionConstraintReason } from "@/lib/rect";
import { checkoutRequestSchema, normalizeColor, normalizeDestinationUrl } from "@/lib/validation";

const checkoutBase = {
  color: "#6857F5",
  destinationUrl: "https://example.com",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
};

describe("pricing", () => {
  it("always snapshots the fixed $0.25 price", () => {
    expect(snapshotReservationPrice(10, 10)).toEqual({
      unitPriceCents: UNIT_PRICE_CENTS,
      totalCents: 100 * UNIT_PRICE_CENTS,
    });
    expect(calculatePriceCents(2, 1)).toBe(MIN_CHARGE_CENTS);
    expect(calculatePriceCents(40, 20)).toBe(800 * UNIT_PRICE_CENTS);
    expect(evaluateSelection({ x: 0, y: 0, width: 10, height: 10 }, false)).toMatchObject({
      unitPriceCents: UNIT_PRICE_CENTS,
      priceCents: 2_500,
    });
  });
});

describe("minimum selection", () => {
  it("accepts every in-bounds rectangle with at least two pixels", () => {
    for (const rect of [
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 0, y: 0, width: 1, height: 2 },
      { x: 0, y: 0, width: SUGGESTED_STARTER_SIZE, height: SUGGESTED_STARTER_SIZE },
      { x: 0, y: 0, width: 1280, height: 720 },
    ]) {
      expect(selectionConstraintReason(rect)).toBeUndefined();
      expect(
        checkoutRequestSchema.safeParse({
          ...checkoutBase,
          rect,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects a single pixel to satisfy Stripe's typical $0.50 floor", () => {
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    expect(selectionConstraintReason(rect)).toMatch(/at least 2 pixels/);
    expect(evaluateSelection(rect, false).valid).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...checkoutBase, rect }).success).toBe(false);
    expect(MIN_SELECTION_PIXELS).toBe(2);
  });

  it("rejects invalid, fractional, and out-of-bounds selections", () => {
    for (const rect of [
      { x: -1, y: 0, width: 10, height: 10 },
      { x: 1271, y: 711, width: 10, height: 10 },
      { x: 0.5, y: 0, width: 10, height: 10 },
    ]) {
      expect(
        checkoutRequestSchema.safeParse({
          ...checkoutBase,
          rect,
        }).success,
      ).toBe(false);
    }
  });
});

describe("destination URL validation", () => {
  it("adds https and normalizes a hostname", () => {
    expect(normalizeDestinationUrl("example.com/path")).toBe("https://example.com/path");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com",
    "https://user:password@example.com",
    "",
  ])("rejects unsafe destination %s", (value) => {
    expect(() => normalizeDestinationUrl(value)).toThrow();
  });
});

describe("color validation", () => {
  it("normalizes six-digit hex colors", () => {
    expect(normalizeColor(" #a0b1c2 ")).toBe("#A0B1C2");
  });

  it.each(["#fff", "6857F5", "#GG0000", "red"])("rejects malformed color %s", (value) => {
    expect(() => normalizeColor(value)).toThrow();
  });
});
