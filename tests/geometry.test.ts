import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BOARD_HEIGHT, BOARD_WIDTH } from "@/lib/constants";
import { rectArea, rectFromCells, rectsOverlap, rectWithinBoard } from "@/lib/rect";
import { screenToWorld, worldToScreen, zoomAt } from "@/lib/transform";

describe("rectangle geometry", () => {
  it("creates a normalized inclusive rectangle in every drag direction", () => {
    expect(rectFromCells({ x: 8, y: 9 }, { x: 4, y: 3 })).toEqual({
      x: 4,
      y: 3,
      width: 5,
      height: 7,
    });
  });

  it("treats half-open adjacent rectangles as non-overlapping", () => {
    expect(
      rectsOverlap(
        { x: 0, y: 0, width: 4, height: 4 },
        { x: 4, y: 0, width: 3, height: 4 },
      ),
    ).toBe(false);
  });

  it("keeps overlap symmetric for arbitrary in-board rectangles", () => {
    fc.assert(
      fc.property(pixelRectArbitrary, pixelRectArbitrary, (a, b) => {
        expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
      }),
    );
  });

  it("calculates area and verifies board bounds", () => {
    fc.assert(
      fc.property(pixelRectArbitrary, (rect) => {
        expect(rectArea(rect)).toBe(rect.width * rect.height);
        expect(rectWithinBoard(rect)).toBe(true);
      }),
    );
  });
});

describe("screen/world transforms", () => {
  it("round-trips points across arbitrary valid transforms", () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.double({ min: -5000, max: 5000, noNaN: true }),
          y: fc.double({ min: -5000, max: 5000, noNaN: true }),
        }),
        fc.record({
          scale: fc.double({ min: 0.08, max: 64, noNaN: true }),
          offsetX: fc.double({ min: -3000, max: 3000, noNaN: true }),
          offsetY: fc.double({ min: -3000, max: 3000, noNaN: true }),
        }),
        (point, transform) => {
          const result = screenToWorld(worldToScreen(point, transform), transform);
          expect(result.x).toBeCloseTo(point.x, 8);
          expect(result.y).toBeCloseTo(point.y, 8);
        },
      ),
    );
  });

  it("preserves the world point under a pointer-centered zoom", () => {
    fc.assert(
      fc.property(
        fc.record({
          scale: fc.double({ min: 0.08, max: 64, noNaN: true }),
          offsetX: fc.double({ min: -2000, max: 2000, noNaN: true }),
          offsetY: fc.double({ min: -2000, max: 2000, noNaN: true }),
        }),
        fc.record({
          x: fc.double({ min: 0, max: 2000, noNaN: true }),
          y: fc.double({ min: 0, max: 1200, noNaN: true }),
        }),
        fc.double({ min: 0.08, max: 64, noNaN: true }),
        (transform, anchor, requestedScale) => {
          const before = screenToWorld(anchor, transform);
          const after = screenToWorld(anchor, zoomAt(transform, anchor, requestedScale));
          expect(after.x).toBeCloseTo(before.x, 8);
          expect(after.y).toBeCloseTo(before.y, 8);
        },
      ),
    );
  });
});

const pixelRectArbitrary = fc
  .record({
    x: fc.integer({ min: 0, max: BOARD_WIDTH - 1 }),
    y: fc.integer({ min: 0, max: BOARD_HEIGHT - 1 }),
    widthSeed: fc.integer({ min: 1, max: BOARD_WIDTH }),
    heightSeed: fc.integer({ min: 1, max: BOARD_HEIGHT }),
  })
  .map(({ x, y, widthSeed, heightSeed }) => ({
    x,
    y,
    width: Math.min(widthSeed, BOARD_WIDTH - x),
    height: Math.min(heightSeed, BOARD_HEIGHT - y),
  }));
