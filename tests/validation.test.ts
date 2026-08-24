import { describe, expect, it } from "vitest";

import {
  FOUNDING_PIXEL_CAP,
  FOUNDING_PRICE_CENTS,
  MAX_SELECTION_PIXELS,
  MIN_SELECTION_PIXELS,
  SUGGESTED_STARTER_SIZE,
  UNIT_PRICE_CENTS,
} from "@/lib/constants";
import {
  calculatePriceCents,
  snapshotReservationPrice,
  unitPriceCentsForSoldPixels,
} from "@/lib/pricing";
import { evaluateSelection, selectionConstraintReason } from "@/lib/rect";
import { checkoutRequestSchema, normalizeColor, normalizeDestinationUrl } from "@/lib/validation";

const checkoutBase = {
  color: "#6857F5",
  destinationUrl: "https://example.com",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
};

describe("pricing", () => {
  it("uses $0.20/px until 10,000 owned pixels, then $0.25/px", () => {
    expect(unitPriceCentsForSoldPixels(0)).toBe(FOUNDING_PRICE_CENTS);
    expect(unitPriceCentsForSoldPixels(FOUNDING_PIXEL_CAP - 1)).toBe(FOUNDING_PRICE_CENTS);
    expect(unitPriceCentsForSoldPixels(FOUNDING_PIXEL_CAP)).toBe(UNIT_PRICE_CENTS);
    expect(unitPriceCentsForSoldPixels(FOUNDING_PIXEL_CAP + 1)).toBe(UNIT_PRICE_CENTS);

    expect(snapshotReservationPrice(10, 10, 0)).toEqual({
      unitPriceCents: FOUNDING_PRICE_CENTS,
      totalCents: 100 * FOUNDING_PRICE_CENTS,
    });
    expect(snapshotReservationPrice(10, 10, FOUNDING_PIXEL_CAP)).toEqual({
      unitPriceCents: UNIT_PRICE_CENTS,
      totalCents: 100 * UNIT_PRICE_CENTS,
    });
    expect(calculatePriceCents(40, 20, UNIT_PRICE_CENTS)).toBe(800 * UNIT_PRICE_CENTS);
  });

  it("previews founding vs standard rate from the owned-pixel snapshot", () => {
    const founding = evaluateSelection({ x: 0, y: 0, width: 10, height: 10 }, false, 0);
    expect(founding.valid).toBe(true);
    expect(founding.unitPriceCents).toBe(FOUNDING_PRICE_CENTS);
    expect(founding.priceCents).toBe(2_000);

    const standard = evaluateSelection(
      { x: 0, y: 0, width: 10, height: 10 },
      false,
      FOUNDING_PIXEL_CAP,
    );
    expect(standard.unitPriceCents).toBe(UNIT_PRICE_CENTS);
    expect(standard.priceCents).toBe(2_500);
  });
});

describe("minimum selection", () => {
  it("accepts area ≥ 100 with width ≥ 4 and height ≥ 4, including a 10×10 starter", () => {
    for (const rect of [
      { x: 0, y: 0, width: SUGGESTED_STARTER_SIZE, height: SUGGESTED_STARTER_SIZE },
      { x: 0, y: 0, width: 25, height: 4 },
      { x: 0, y: 0, width: 4, height: 25 },
      { x: 0, y: 0, width: 20, height: 5 },
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

  it("rejects the old 2px minimum and other undersized or oversized rectangles", () => {
    const rejected = [
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 0, y: 0, width: 50, height: 2 },
      { x: 0, y: 0, width: 2, height: 50 },
      { x: 0, y: 0, width: 100, height: 1 },
      { x: 0, y: 0, width: 33, height: 3 },
      { x: 0, y: 0, width: 101, height: 100 },
    ];

    for (const rect of rejected) {
      expect(selectionConstraintReason(rect)).toBeTypeOf("string");
      expect(evaluateSelection(rect, false).valid).toBe(false);
      expect(
        checkoutRequestSchema.safeParse({
          ...checkoutBase,
          rect,
        }).success,
      ).toBe(false);
    }

    expect(evaluateSelection({ x: 0, y: 0, width: 2, height: 1 }, false).reason).toMatch(
      /at least 4/,
    );
    expect(MAX_SELECTION_PIXELS).toBe(MIN_SELECTION_PIXELS * 100);
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
