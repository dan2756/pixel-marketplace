import { BOARD_CELL_COUNT, BOARD_WIDTH } from "./constants";
import type { OwnedRegion, PixelRect, Point } from "./types";

export function buildOwnershipIndex(regions: OwnedRegion[]): Int32Array {
  const index = new Int32Array(BOARD_CELL_COUNT);

  regions.forEach((region, regionIndex) => {
    const value = regionIndex + 1;
    for (let y = region.y; y < region.y + region.height; y += 1) {
      const rowOffset = y * BOARD_WIDTH;
      index.fill(value, rowOffset + region.x, rowOffset + region.x + region.width);
    }
  });

  return index;
}

export function ownedRegionAt(
  point: Point,
  index: Int32Array,
  regions: OwnedRegion[],
): OwnedRegion | null {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= BOARD_WIDTH || y * BOARD_WIDTH + x >= index.length) {
    return null;
  }
  const regionIndex = index[y * BOARD_WIDTH + x] - 1;
  return regionIndex >= 0 ? regions[regionIndex] : null;
}

export function selectionOverlapsOwnership(rect: PixelRect, index: Int32Array): boolean {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    const rowOffset = y * BOARD_WIDTH;
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (index[rowOffset + x] !== 0) return true;
    }
  }
  return false;
}
