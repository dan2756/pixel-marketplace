import { BOARD_HEIGHT, BOARD_WIDTH, MAX_ZOOM, MIN_ZOOM } from "./constants";
import type { PixelRect, Point, ViewTransform } from "./types";

export function worldToScreen(point: Point, transform: ViewTransform): Point {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

export function screenToWorld(point: Point, transform: ViewTransform): Point {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

export function fitBoard(width: number, height: number, padding = 28): ViewTransform {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / BOARD_WIDTH, availableHeight / BOARD_HEIGHT);

  return {
    scale,
    offsetX: (width - BOARD_WIDTH * scale) / 2,
    offsetY: (height - BOARD_HEIGHT * scale) / 2,
  };
}

export function zoomAt(
  transform: ViewTransform,
  anchor: Point,
  requestedScale: number,
): ViewTransform {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedScale));
  const worldAnchor = screenToWorld(anchor, transform);

  return {
    scale,
    offsetX: anchor.x - worldAnchor.x * scale,
    offsetY: anchor.y - worldAnchor.y * scale,
  };
}

export function panBy(transform: ViewTransform, delta: Point): ViewTransform {
  return {
    ...transform,
    offsetX: transform.offsetX + delta.x,
    offsetY: transform.offsetY + delta.y,
  };
}

export function visibleWorldRect(
  transform: ViewTransform,
  width: number,
  height: number,
): PixelRect {
  const topLeft = screenToWorld({ x: 0, y: 0 }, transform);
  const bottomRight = screenToWorld({ x: width, y: height }, transform);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

export function centerOn(
  point: Point,
  scale: number,
  screenWidth: number,
  screenHeight: number,
): ViewTransform {
  const safeScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
  return {
    scale: safeScale,
    offsetX: screenWidth / 2 - point.x * safeScale,
    offsetY: screenHeight / 2 - point.y * safeScale,
  };
}

export function transformToQuery(transform: ViewTransform, width: number, height: number) {
  const center = screenToWorld({ x: width / 2, y: height / 2 }, transform);
  return {
    x: Math.round(center.x * 100) / 100,
    y: Math.round(center.y * 100) / 100,
    z: Math.round(transform.scale * 1000) / 1000,
  };
}
