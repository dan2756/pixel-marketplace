import { FOUNDING_PIXEL_CAP, FOUNDING_PRICE_CENTS, UNIT_PRICE_CENTS } from "./constants";

export function unitPriceCentsForSoldPixels(soldPixels: number): number {
  if (!Number.isFinite(soldPixels) || soldPixels < 0) {
    throw new Error("Sold pixel count must be a non-negative number.");
  }
  return soldPixels < FOUNDING_PIXEL_CAP ? FOUNDING_PRICE_CENTS : UNIT_PRICE_CENTS;
}

export function calculatePriceCents(width: number, height: number, unitPriceCents: number): number {
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
  soldPixels: number,
): { unitPriceCents: number; totalCents: number } {
  const unitPriceCents = unitPriceCentsForSoldPixels(soldPixels);
  return {
    unitPriceCents,
    totalCents: calculatePriceCents(width, height, unitPriceCents),
  };
}
