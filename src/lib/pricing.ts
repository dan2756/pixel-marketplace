import { UNIT_PRICE_CENTS } from "./constants";

export function calculatePriceCents(
  width: number,
  height: number,
  unitPriceCents = UNIT_PRICE_CENTS,
): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Pixel dimensions must be positive integers.");
  }
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Unit price must be a positive integer.");
  }
  return width * height * unitPriceCents;
}

export function snapshotReservationPrice(
  width: number,
  height: number,
): { unitPriceCents: number; totalCents: number } {
  return {
    unitPriceCents: UNIT_PRICE_CENTS,
    totalCents: calculatePriceCents(width, height),
  };
}
