import { BOARD_HEIGHT, BOARD_WIDTH, MIN_SELECTION_PIXELS, UNIT_PRICE_CENTS } from "./constants";
import type { PixelRect, Point, SelectionEvaluation } from "./types";

export function rectFromCells(start: Point, end: Point): PixelRect {
  const x = Math.min(Math.floor(start.x), Math.floor(end.x));
  const y = Math.min(Math.floor(start.y), Math.floor(end.y));

  return {
    x,
    y,
    width: Math.abs(Math.floor(end.x) - Math.floor(start.x)) + 1,
    height: Math.abs(Math.floor(end.y) - Math.floor(start.y)) + 1,
  };
}

export function rectArea(rect: PixelRect): number {
  return rect.width * rect.height;
}

export function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectContainsPoint(rect: PixelRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

export function rectWithinBoard(rect: PixelRect): boolean {
  return (
    Number.isInteger(rect.x) &&
    Number.isInteger(rect.y) &&
    Number.isInteger(rect.width) &&
    Number.isInteger(rect.height) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= BOARD_WIDTH &&
    rect.y + rect.height <= BOARD_HEIGHT
  );
}

export function clampCell(point: Point): Point {
  return {
    x: Math.max(0, Math.min(BOARD_WIDTH - 1, Math.floor(point.x))),
    y: Math.max(0, Math.min(BOARD_HEIGHT - 1, Math.floor(point.y))),
  };
}

export function evaluateSelection(
  rect: PixelRect,
  hasOverlap: boolean,
): SelectionEvaluation {
  const pixelCount = rectArea(rect);
  let reason: string | undefined;

  if (!rectWithinBoard(rect)) {
    reason = "Selection must stay inside the canvas.";
  } else if (pixelCount < MIN_SELECTION_PIXELS) {
    reason = `Select at least ${MIN_SELECTION_PIXELS} pixels.`;
  } else if (hasOverlap) {
    reason = "This selection overlaps an owned region.";
  }

  return {
    rect,
    pixelCount,
    priceCents: pixelCount * UNIT_PRICE_CENTS,
    valid: reason === undefined,
    reason,
  };
}
