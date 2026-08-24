import { describe, expect, it } from "vitest";

import { initialInteractionState, interactionReducer } from "@/lib/interaction";
import { buildOwnershipIndex, ownedRegionAt, selectionOverlapsOwnership } from "@/lib/ownership";
import type { OwnedRegion } from "@/lib/types";

describe("interaction reducer", () => {
  it("does not turn an explore click into a selection", () => {
    let state = initialInteractionState("explore");
    state = interactionReducer(state, {
      type: "pointer_down",
      pointerId: 1,
      screen: { x: 100, y: 100 },
      cell: { x: 10, y: 10 },
      pan: false,
    });
    expect(state.phase).toBe("panning");
    expect(state.selection).toBeNull();

    state = interactionReducer(state, { type: "pointer_up", pointerId: 1 });
    expect(state.phase).toBe("idle");
    expect(state.moved).toBe(false);
  });

  it("snaps a select gesture and honors the deliberate-drag threshold", () => {
    let state = initialInteractionState("select");
    state = interactionReducer(state, {
      type: "pointer_down",
      pointerId: 7,
      screen: { x: 10, y: 10 },
      cell: { x: 4, y: 6 },
      pan: false,
    });
    state = interactionReducer(state, {
      type: "pointer_move",
      pointerId: 7,
      screen: { x: 14, y: 13 },
      cell: { x: 9, y: 11 },
      dragThreshold: 6,
    });
    expect(state.moved).toBe(false);
    expect(state.selection).toEqual({ x: 4, y: 6, width: 6, height: 6 });

    state = interactionReducer(state, {
      type: "pointer_move",
      pointerId: 7,
      screen: { x: 22, y: 10 },
      cell: { x: 2, y: 6 },
      dragThreshold: 6,
    });
    expect(state.moved).toBe(true);
    expect(state.selection).toEqual({ x: 2, y: 6, width: 3, height: 1 });
  });

  it("moves to an explicit pinch state without opening a region", () => {
    const state = interactionReducer(initialInteractionState("explore"), {
      type: "pinch_start",
    });
    expect(state.phase).toBe("pinching");
    expect(state.moved).toBe(true);
    expect(state.pointerId).toBeNull();
  });
});

describe("ownership raster", () => {
  const region: OwnedRegion = {
    id: "region-1",
    x: 20,
    y: 30,
    width: 5,
    height: 4,
    color: "#6857F5",
    destinationUrl: "https://example.com/",
    purchasedAt: "2026-01-01T00:00:00.000Z",
  };
  const index = buildOwnershipIndex([region]);

  it("provides constant-time hit testing", () => {
    expect(ownedRegionAt({ x: 21, y: 31 }, index, [region])).toEqual(region);
    expect(ownedRegionAt({ x: 25, y: 31 }, index, [region])).toBeNull();
  });

  it("detects selection overlap using the raster", () => {
    expect(
      selectionOverlapsOwnership({ x: 19, y: 29, width: 2, height: 2 }, index),
    ).toBe(true);
    expect(
      selectionOverlapsOwnership({ x: 25, y: 30, width: 2, height: 2 }, index),
    ).toBe(false);
  });
});
