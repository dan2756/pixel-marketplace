"use client";

import {
  Focus,
  Hand,
  LocateFixed,
  Minus,
  MousePointer2,
  Plus,
  ScanLine,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  BOARD_BACKGROUND,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DETAIL_LOD_ZOOM,
  GRID_LOD_ZOOM,
} from "@/lib/constants";
import {
  initialInteractionState,
  interactionReducer,
  type BoardMode,
  type InteractionAction,
} from "@/lib/interaction";
import { ownedRegionAt } from "@/lib/ownership";
import { clampCell } from "@/lib/rect";
import {
  centerOn,
  fitBoard,
  panBy,
  screenToWorld,
  transformToQuery,
  visibleWorldRect,
  worldToScreen,
  zoomAt,
} from "@/lib/transform";
import type {
  OwnedRegion,
  PixelRect,
  Point,
  SelectionEvaluation,
  ViewTransform,
} from "@/lib/types";

import { Minimap } from "./Minimap";

type BoardCanvasProps = {
  regions: OwnedRegion[];
  ownershipIndex: Int32Array;
  selection: PixelRect | null;
  evaluation: SelectionEvaluation | null;
  previewColor: string;
  mode: BoardMode;
  onModeChange: (mode: BoardMode) => void;
  onSelectionChange: (selection: PixelRect | null) => void;
  loadingMessage?: string;
  focusRegionId?: string | null;
};

type HoverState = {
  region: OwnedRegion;
  screen: Point;
};

type Dimensions = {
  width: number;
  height: number;
};

export function BoardCanvas({
  regions,
  ownershipIndex,
  selection,
  evaluation,
  previewColor,
  mode,
  onModeChange,
  onSelectionChange,
  loadingMessage,
  focusRegionId,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const initializedRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{
    distance: number;
    midpoint: Point;
    transform: ViewTransform;
  } | null>(null);
  const spacePressedRef = useRef(false);
  const keyboardAnchorRef = useRef<Point | null>(null);
  const interactionRef = useRef(initialInteractionState(mode));
  const [interaction, rawDispatch] = useReducer(interactionReducer, initialInteractionState(mode));
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 1, height: 1 });
  const [transform, setTransformState] = useState<ViewTransform>(() => fitBoard(1, 1, 0));
  const transformRef = useRef(transform);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [keyboardCell, setKeyboardCell] = useState<Point>({ x: 640, y: 360 });
  const [announcement, setAnnouncement] = useState(
    "Canvas ready. Use arrow keys to explore and Shift plus arrows to select.",
  );

  const setTransform = useCallback((next: ViewTransform) => {
    transformRef.current = next;
    setTransformState(next);
  }, []);

  const dispatch = useCallback(
    (action: InteractionAction) => {
      interactionRef.current = interactionReducer(interactionRef.current, action);
      rawDispatch(action);
      return interactionRef.current;
    },
    [rawDispatch],
  );

  useEffect(() => {
    if (interactionRef.current.mode !== mode) {
      dispatch({ type: "set_mode", mode });
    }
  }, [dispatch, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, entry.contentRect.width);
      const height = Math.max(1, entry.contentRect.height);
      setDimensions({ width, height });

      if (!initializedRef.current) {
        initializedRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const x = Number(params.get("x"));
        const y = Number(params.get("y"));
        const z = Number(params.get("z"));
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(z) &&
          z > 0 &&
          params.has("x") &&
          params.has("y") &&
          params.has("z")
        ) {
          setTransform(centerOn({ x, y }, z, width, height));
        } else {
          setTransform(fitBoard(width, height));
        }
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setTransform]);

  useEffect(() => {
    if (!focusRegionId || dimensions.width <= 1) return;
    const region = regions.find((candidate) => candidate.id === focusRegionId);
    if (!region) return;
    const scale = Math.min(
      20,
      Math.max(
        transformRef.current.scale,
        Math.min(
          dimensions.width / Math.max(region.width * 2.4, 80),
          dimensions.height / Math.max(region.height * 2.4, 80),
        ),
      ),
    );
    setTransform(
      centerOn(
        { x: region.x + region.width / 2, y: region.y + region.height / 2 },
        scale,
        dimensions.width,
        dimensions.height,
      ),
    );
  }, [dimensions.height, dimensions.width, focusRegionId, regions, setTransform]);

  useEffect(() => {
    const offscreen = document.createElement("canvas");
    offscreen.width = BOARD_WIDTH;
    offscreen.height = BOARD_HEIGHT;
    const context = offscreen.getContext("2d", { alpha: false });
    if (!context) return;

    context.fillStyle = BOARD_BACKGROUND;
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    for (const region of regions) {
      context.fillStyle = region.color;
      context.fillRect(region.x, region.y, region.width, region.height);
    }
    offscreenRef.current = offscreen;
  }, [regions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = transformToQuery(transform, dimensions.width, dimensions.height);
      const url = new URL(window.location.href);
      url.searchParams.set("x", String(query.x));
      url.searchParams.set("y", String(query.y));
      url.searchParams.set("z", String(query.z));
      window.history.replaceState({}, "", `${url.pathname}?${url.searchParams}${url.hash}`);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [dimensions.height, dimensions.width, transform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const targetWidth = Math.round(dimensions.width * dpr);
    const targetHeight = Math.round(dimensions.height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    let frame = requestAnimationFrame(() => {
      drawBoard({
        canvas,
        dpr,
        dimensions,
        transform,
        offscreen: offscreenRef.current,
        selection,
        evaluation,
        previewColor,
        keyboardCell,
        hoverCell: hover ? screenToWorld(hover.screen, transform) : null,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [dimensions, evaluation, hover, keyboardCell, previewColor, regions, selection, transform]);

  useEffect(() => {
    function keyUp(event: KeyboardEvent) {
      if (event.code === "Space") spacePressedRef.current = false;
    }
    window.addEventListener("keyup", keyUp);
    return () => window.removeEventListener("keyup", keyUp);
  }, []);

  const viewport = useMemo(
    () => visibleWorldRect(transform, dimensions.width, dimensions.height),
    [dimensions.height, dimensions.width, transform],
  );

  function eventPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const screen = eventPoint(event);
    pointersRef.current.set(event.pointerId, screen);

    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.max(1, distance(first, second)),
        midpoint: midpoint(first, second),
        transform: transformRef.current,
      };
      dispatch({ type: "pinch_start" });
      return;
    }

    const cell = clampCell(screenToWorld(screen, transformRef.current));
    const next = dispatch({
      type: "pointer_down",
      pointerId: event.pointerId,
      screen,
      cell,
      pan:
        mode === "explore" ||
        event.button === 1 ||
        event.altKey ||
        event.metaKey ||
        spacePressedRef.current,
    });
    if (next.phase === "selecting") {
      onSelectionChange(next.selection);
      setAnnouncement(`Selection started at column ${cell.x}, row ${cell.y}.`);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const screen = eventPoint(event);
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, screen);
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      event.preventDefault();
      const [first, second] = [...pointersRef.current.values()];
      const currentMidpoint = midpoint(first, second);
      const ratio = distance(first, second) / pinchRef.current.distance;
      const zoomed = zoomAt(
        pinchRef.current.transform,
        pinchRef.current.midpoint,
        pinchRef.current.transform.scale * ratio,
      );
      setTransform(
        panBy(zoomed, {
          x: currentMidpoint.x - pinchRef.current.midpoint.x,
          y: currentMidpoint.y - pinchRef.current.midpoint.y,
        }),
      );
      return;
    }

    const current = interactionRef.current;
    if (current.pointerId === event.pointerId) {
      event.preventDefault();
      const previous = current.last ?? screen;
      const cell = clampCell(screenToWorld(screen, transformRef.current));
      const next = dispatch({
        type: "pointer_move",
        pointerId: event.pointerId,
        screen,
        cell,
        dragThreshold: event.pointerType === "touch" ? 9 : 5,
      });

      if (current.phase === "panning") {
        setTransform(
          panBy(transformRef.current, {
            x: screen.x - previous.x,
            y: screen.y - previous.y,
          }),
        );
      } else if (current.phase === "selecting" && next.selection) {
        onSelectionChange(next.selection);
      }
      setHover(null);
      return;
    }

    if (event.pointerType === "mouse") {
      const region = ownedRegionAt(
        screenToWorld(screen, transformRef.current),
        ownershipIndex,
        regions,
      );
      setHover(region ? { region, screen } : null);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const screen = eventPoint(event);
    const before = interactionRef.current;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (before.pointerId === event.pointerId) {
      dispatch({ type: "pointer_up", pointerId: event.pointerId });
      if (before.phase === "panning" && !before.moved) {
        const region = ownedRegionAt(
          screenToWorld(screen, transformRef.current),
          ownershipIndex,
          regions,
        );
        if (region) {
          window.open(region.destinationUrl, "_blank", "noopener,noreferrer");
          setAnnouncement("Opened the owned region destination in a new tab.");
        }
      } else if (before.phase === "selecting" && before.selection) {
        setAnnouncement(
          `Selected ${before.selection.width} by ${before.selection.height} pixels.`,
        );
      }
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const screen = eventPoint(event as unknown as React.PointerEvent<HTMLCanvasElement>);
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.006 : 0.0015));
    setTransform(zoomAt(transformRef.current, screen, transformRef.current.scale * factor));
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (event.code === "Space") {
      spacePressedRef.current = true;
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      dispatch({ type: "cancel" });
      onSelectionChange(null);
      keyboardAnchorRef.current = null;
      setAnnouncement("Selection cleared.");
      return;
    }
    if (event.key === "f" || event.key === "F" || event.key === "0") {
      setTransform(fitBoard(dimensions.width, dimensions.height));
      setAnnouncement("Canvas fitted to the window.");
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      const direction = event.key === "-" ? 1 / 1.35 : 1.35;
      setTransform(
        zoomAt(
          transformRef.current,
          { x: dimensions.width / 2, y: dimensions.height / 2 },
          transformRef.current.scale * direction,
        ),
      );
      event.preventDefault();
      return;
    }

    const delta: Point | null =
      event.key === "ArrowLeft"
        ? { x: -1, y: 0 }
        : event.key === "ArrowRight"
          ? { x: 1, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -1 }
            : event.key === "ArrowDown"
              ? { x: 0, y: 1 }
              : null;

    if (delta) {
      event.preventDefault();
      const next = clampCell({ x: keyboardCell.x + delta.x, y: keyboardCell.y + delta.y });
      setKeyboardCell(next);
      if (event.shiftKey) {
        const anchor = keyboardAnchorRef.current ?? keyboardCell;
        keyboardAnchorRef.current = anchor;
        const nextSelection = {
          x: Math.min(anchor.x, next.x),
          y: Math.min(anchor.y, next.y),
          width: Math.abs(anchor.x - next.x) + 1,
          height: Math.abs(anchor.y - next.y) + 1,
        };
        onSelectionChange(nextSelection);
        onModeChange("select");
      } else {
        keyboardAnchorRef.current = null;
      }

      const screenPosition = worldToScreen({ x: next.x + 0.5, y: next.y + 0.5 }, transformRef.current);
      const margin = 48;
      if (
        screenPosition.x < margin ||
        screenPosition.y < margin ||
        screenPosition.x > dimensions.width - margin ||
        screenPosition.y > dimensions.height - margin
      ) {
        setTransform(
          centerOn(next, transformRef.current.scale, dimensions.width, dimensions.height),
        );
      }
      setAnnouncement(`Column ${next.x}, row ${next.y}.`);
      return;
    }

    if (event.key === "Enter") {
      const region = ownedRegionAt(keyboardCell, ownershipIndex, regions);
      if (region) {
        window.open(region.destinationUrl, "_blank", "noopener,noreferrer");
        setAnnouncement("Opened the owned region destination in a new tab.");
      } else {
        onModeChange("select");
        onSelectionChange({ x: keyboardCell.x, y: keyboardCell.y, width: 1, height: 1 });
        keyboardAnchorRef.current = keyboardCell;
        setAnnouncement("Selection started. Hold Shift and use arrow keys to resize.");
      }
    }
  }

  function changeMode(nextMode: BoardMode) {
    onModeChange(nextMode);
    setAnnouncement(
      nextMode === "select"
        ? "Select mode. Drag on open pixels to create a rectangle."
        : "Explore mode. Drag to pan or click an owned region to open it.",
    );
  }

  const selectionBadgePosition =
    selection && evaluation
      ? badgePosition(selection, transform, dimensions.width, dimensions.height)
      : null;
  const hoverPosition = hover
    ? {
        left: Math.min(dimensions.width - 250, Math.max(10, hover.screen.x + 14)),
        top: Math.min(dimensions.height - 112, Math.max(10, hover.screen.y + 14)),
      }
    : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        data-mode={mode}
        data-dragging={interaction.phase === "panning" && interaction.moved}
        tabIndex={0}
        role="application"
        aria-label="Interactive 1280 by 720 pixel ownership canvas"
        aria-describedby="canvas-instructions"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={handleWheel}
        onKeyDown={handleKeyboard}
      >
        A 1280 by 720 interactive pixel canvas. Use the coordinate fields to make a selection
        without dragging.
      </canvas>
      <p id="canvas-instructions" className="sr-only">
        Use arrow keys to move one cell. Hold Shift with an arrow key to select. Press Enter to
        open an owned region or start a selection. Press F to fit, plus or minus to zoom, and
        Escape to clear.
      </p>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        <button
          type="button"
          className="tool-button"
          aria-label="Explore and pan"
          aria-pressed={mode === "explore"}
          onClick={() => changeMode("explore")}
        >
          <Hand size={15} />
        </button>
        <button
          type="button"
          className="tool-button"
          aria-label="Select pixels"
          aria-pressed={mode === "select"}
          onClick={() => changeMode("select")}
        >
          <MousePointer2 size={15} />
        </button>
        <span className="tool-divider" />
        <button
          type="button"
          className="tool-button"
          aria-label="Fit canvas"
          onClick={() => setTransform(fitBoard(dimensions.width, dimensions.height))}
        >
          <Focus size={15} />
        </button>
      </div>

      <div className="mode-switcher" aria-label="Mobile canvas mode">
        <button
          type="button"
          className="segmented-button"
          aria-pressed={mode === "explore"}
          onClick={() => changeMode("explore")}
        >
          Explore
        </button>
        <button
          type="button"
          className="segmented-button"
          aria-pressed={mode === "select"}
          onClick={() => changeMode("select")}
        >
          Select
        </button>
      </div>

      <div className="zoom-controls" role="group" aria-label="Zoom controls">
        <button
          type="button"
          className="tool-button"
          aria-label="Zoom out"
          onClick={() =>
            setTransform(
              zoomAt(
                transformRef.current,
                { x: dimensions.width / 2, y: dimensions.height / 2 },
                transformRef.current.scale / 1.35,
              ),
            )
          }
        >
          <Minus size={14} />
        </button>
        <span className="zoom-label">{Math.round(transform.scale * 100)}%</span>
        <button
          type="button"
          className="tool-button"
          aria-label="Zoom in"
          onClick={() =>
            setTransform(
              zoomAt(
                transformRef.current,
                { x: dimensions.width / 2, y: dimensions.height / 2 },
                transformRef.current.scale * 1.35,
              ),
            )
          }
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="tool-button"
          aria-label="Reset to fit"
          onClick={() => setTransform(fitBoard(dimensions.width, dimensions.height))}
        >
          <LocateFixed size={14} />
        </button>
      </div>

      {loadingMessage ? (
        <div className="canvas-message" role="status">
          <span className="spinner" />
          {loadingMessage}
        </div>
      ) : null}

      {selectionBadgePosition && evaluation ? (
        <div
          className="selection-badge"
          data-valid={evaluation.valid}
          style={selectionBadgePosition}
          aria-hidden="true"
        >
          <ScanLine size={13} />
          {evaluation.rect.width} × {evaluation.rect.height} ·{" "}
          {evaluation.pixelCount.toLocaleString()} px · ${(evaluation.priceCents / 100).toFixed(2)}
        </div>
      ) : null}

      {hover && hoverPosition ? (
        <div className="hover-card" style={hoverPosition}>
          <div className="hover-card-color" style={{ background: hover.region.color }} />
          <div className="hover-card-body">
            <span className="eyebrow">Owned region</span>
            <strong>
              {hover.region.width} × {hover.region.height} at {hover.region.x}, {hover.region.y}
            </strong>
            <div className="truncate">{new URL(hover.region.destinationUrl).hostname}</div>
          </div>
        </div>
      ) : null}

      <Minimap
        regions={regions}
        viewport={viewport}
        onNavigate={(point) =>
          setTransform(
            centerOn(point, transformRef.current.scale, dimensions.width, dimensions.height),
          )
        }
      />
    </>
  );
}

type DrawBoardOptions = {
  canvas: HTMLCanvasElement;
  dpr: number;
  dimensions: Dimensions;
  transform: ViewTransform;
  offscreen: HTMLCanvasElement | null;
  selection: PixelRect | null;
  evaluation: SelectionEvaluation | null;
  previewColor: string;
  keyboardCell: Point;
  hoverCell: Point | null;
};

function drawBoard({
  canvas,
  dpr,
  dimensions,
  transform,
  offscreen,
  selection,
  evaluation,
  previewColor,
  keyboardCell,
  hoverCell,
}: DrawBoardOptions) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, dimensions.width, dimensions.height);

  const boardX = transform.offsetX;
  const boardY = transform.offsetY;
  const boardWidth = BOARD_WIDTH * transform.scale;
  const boardHeight = BOARD_HEIGHT * transform.scale;

  context.save();
  context.shadowColor = "rgb(23 23 22 / 16%)";
  context.shadowBlur = 26;
  context.shadowOffsetY = 7;
  context.fillStyle = BOARD_BACKGROUND;
  context.fillRect(boardX, boardY, boardWidth, boardHeight);
  context.restore();

  context.save();
  context.beginPath();
  context.rect(boardX, boardY, boardWidth, boardHeight);
  context.clip();
  context.imageSmoothingEnabled = false;
  if (offscreen) {
    context.drawImage(offscreen, boardX, boardY, boardWidth, boardHeight);
  } else {
    context.fillStyle = BOARD_BACKGROUND;
    context.fillRect(boardX, boardY, boardWidth, boardHeight);
  }

  if (transform.scale >= GRID_LOD_ZOOM) {
    drawGrid(context, transform, dimensions, transform.scale >= DETAIL_LOD_ZOOM);
  }

  if (hoverCell && transform.scale >= DETAIL_LOD_ZOOM) {
    const cell = clampCell(hoverCell);
    context.fillStyle = "rgb(255 255 255 / 18%)";
    context.fillRect(
      boardX + cell.x * transform.scale,
      boardY + cell.y * transform.scale,
      transform.scale,
      transform.scale,
    );
  }

  if (selection && evaluation) {
    const x = boardX + selection.x * transform.scale;
    const y = boardY + selection.y * transform.scale;
    const width = selection.width * transform.scale;
    const height = selection.height * transform.scale;

    context.globalAlpha = evaluation.valid ? 0.42 : 0.2;
    context.fillStyle = evaluation.valid ? previewColor : "#B74034";
    context.fillRect(x, y, width, height);
    context.globalAlpha = 1;
    if (!evaluation.valid) {
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      context.strokeStyle = "rgb(183 64 52 / 55%)";
      context.lineWidth = 2;
      for (let offset = -height; offset < width + height; offset += 10) {
        context.beginPath();
        context.moveTo(x + offset, y);
        context.lineTo(x + offset - height, y + height);
        context.stroke();
      }
      context.restore();
    }
    context.strokeStyle = evaluation.valid ? "#6857F5" : "#B74034";
    context.lineWidth = 2;
    context.setLineDash(evaluation.valid ? [] : [6, 4]);
    context.strokeRect(x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2));
    context.setLineDash([]);
  }

  if (transform.scale >= DETAIL_LOD_ZOOM) {
    const x = boardX + keyboardCell.x * transform.scale;
    const y = boardY + keyboardCell.y * transform.scale;
    context.strokeStyle = "#0875E1";
    context.lineWidth = 2;
    context.strokeRect(x + 2, y + 2, transform.scale - 4, transform.scale - 4);
  }
  context.restore();

  context.strokeStyle = "rgb(23 23 22 / 38%)";
  context.lineWidth = 1;
  context.strokeRect(boardX - 0.5, boardY - 0.5, boardWidth + 1, boardHeight + 1);
}

function drawGrid(
  context: CanvasRenderingContext2D,
  transform: ViewTransform,
  dimensions: Dimensions,
  detailed: boolean,
) {
  const world = visibleWorldRect(transform, dimensions.width, dimensions.height);
  const startX = Math.max(0, Math.floor(world.x));
  const endX = Math.min(BOARD_WIDTH, Math.ceil(world.x + world.width));
  const startY = Math.max(0, Math.floor(world.y));
  const endY = Math.min(BOARD_HEIGHT, Math.ceil(world.y + world.height));
  const step = detailed ? 1 : 5;

  context.beginPath();
  for (let x = Math.floor(startX / step) * step; x <= endX; x += step) {
    const screenX = Math.round(transform.offsetX + x * transform.scale) + 0.5;
    context.moveTo(screenX, transform.offsetY + startY * transform.scale);
    context.lineTo(screenX, transform.offsetY + endY * transform.scale);
  }
  for (let y = Math.floor(startY / step) * step; y <= endY; y += step) {
    const screenY = Math.round(transform.offsetY + y * transform.scale) + 0.5;
    context.moveTo(transform.offsetX + startX * transform.scale, screenY);
    context.lineTo(transform.offsetX + endX * transform.scale, screenY);
  }
  context.strokeStyle = detailed ? "rgb(23 23 22 / 17%)" : "rgb(23 23 22 / 12%)";
  context.lineWidth = 1;
  context.stroke();
}

function badgePosition(
  rect: PixelRect,
  transform: ViewTransform,
  screenWidth: number,
  screenHeight: number,
): React.CSSProperties {
  const target = worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }, transform);
  return {
    left: Math.max(10, Math.min(screenWidth - 270, target.x + 8)),
    top: Math.max(10, Math.min(screenHeight - 54, target.y + 8)),
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
