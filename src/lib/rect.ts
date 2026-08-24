import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  SUGGESTED_STARTER_SIZE,
  MAX_SELECTION_PIXELS,
  MIN_SELECTION_HEIGHT,
  MIN_SELECTION_PIXELS,
  MIN_SELECTION_WIDTH,
} from "./constants";
import { unitPriceCentsForSoldPixels } from "./pricing";
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
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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

export function suggestedStarterRect(anchor: Point = { x: 0, y: 0 }): PixelRect {
  const width = Math.min(SUGGESTED_STARTER_SIZE, BOARD_WIDTH);
  const height = Math.min(SUGGESTED_STARTER_SIZE, BOARD_HEIGHT);
  return {
    x: Math.max(0, Math.min(BOARD_WIDTH - width, Math.floor(anchor.x))),
    y: Math.max(0, Math.min(BOARD_HEIGHT - height, Math.floor(anchor.y))),
    width,
    height,
  };
}

export function centeredStarterRect(): PixelRect {
  return suggestedStarterRect({
    x: Math.floor((BOARD_WIDTH - SUGGESTED_STARTER_SIZE) / 2),
    y: Math.floor((BOARD_HEIGHT - SUGGESTED_STARTER_SIZE) / 2),
  });
}

export function selectionConstraintReason(rect: PixelRect): string | undefined {
  if (!rectWithinBoard(rect)) {
    return "Selection must stay inside the canvas.";
  }
  if (rect.width < MIN_SELECTION_WIDTH || rect.height < MIN_SELECTION_HEIGHT) {
    return `Width and height must each be at least ${MIN_SELECTION_WIDTH} pixels.`;
  }
  const area = rectArea(rect);
  if (area < MIN_SELECTION_PIXELS) {
    return `Select at least ${MIN_SELECTION_PIXELS} pixels. A ${SUGGESTED_STARTER_SIZE} × ${SUGGESTED_STARTER_SIZE} starter works.`;
  }
  if (area > MAX_SELECTION_PIXELS) {
    return `Selections are limited to ${MAX_SELECTION_PIXELS.toLocaleString()} pixels.`;
  }
  return undefined;
}

export function evaluateSelection(
  rect: PixelRect,
  hasOverlap: boolean,
  soldPixels = 0,
): SelectionEvaluation {
  const pixelCount = rectArea(rect);
  const unitPriceCents = unitPriceCentsForSoldPixels(Math.max(0, soldPixels));
  let reason = selectionConstraintReason(rect);

  if (!reason && hasOverlap) {
    reason = "This selection overlaps an owned region.";
  }

  return {
    rect,
    pixelCount,
    unitPriceCents,
    priceCents: pixelCount > 0 ? pixelCount * unitPriceCents : 0,
    valid: reason === undefined,
    reason,
  };
}
