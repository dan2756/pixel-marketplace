import { describe, expect, it } from "vitest";

import { MIN_CHARGE_CENTS, UNIT_PRICE_CENTS } from "@/lib/constants";
import {
  calculatePriceCents,
  checkoutRequestSchema,
  normalizeColor,
  normalizeDestinationUrl,
} from "@/lib/validation";

describe("pricing", () => {
  it("uses the server-side 25-cent snapshot and enforces the two-pixel minimum", () => {
    expect(calculatePriceCents(2, 1)).toBe(MIN_CHARGE_CENTS);
    expect(calculatePriceCents(40, 20)).toBe(800 * UNIT_PRICE_CENTS);

    const result = checkoutRequestSchema.safeParse({
      rect: { x: 10, y: 20, width: 1, height: 1 },
      color: "#6857F5",
      destinationUrl: "example.com",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid, fractional, and out-of-bounds selections", () => {
    for (const rect of [
      { x: -1, y: 0, width: 2, height: 1 },
      { x: 1279, y: 719, width: 2, height: 1 },
      { x: 0.5, y: 0, width: 2, height: 1 },
    ]) {
      expect(
        checkoutRequestSchema.safeParse({
          rect,
          color: "#6857F5",
          destinationUrl: "https://example.com",
          idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
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
