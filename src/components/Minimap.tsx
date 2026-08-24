"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BOARD_HEIGHT, BOARD_WIDTH } from "@/lib/constants";
import type { OwnedRegion, PixelRect, Point } from "@/lib/types";

type MinimapProps = {
  regions: OwnedRegion[];
  viewport: PixelRect;
  onNavigate: (point: Point) => void;
};

export function Minimap({ regions, viewport, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || collapsed) return;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#F3F2EE";
    context.fillRect(0, 0, cssWidth, cssHeight);

    const scaleX = cssWidth / BOARD_WIDTH;
    const scaleY = cssHeight / BOARD_HEIGHT;
    for (const region of regions) {
      context.fillStyle = region.color;
      context.fillRect(
        region.x * scaleX,
        region.y * scaleY,
        Math.max(1, region.width * scaleX),
        Math.max(1, region.height * scaleY),
      );
    }

    context.fillStyle = "rgb(104 87 245 / 8%)";
    context.strokeStyle = "#6857F5";
    context.lineWidth = 1.5;
    context.fillRect(
      viewport.x * scaleX,
      viewport.y * scaleY,
      viewport.width * scaleX,
      viewport.height * scaleY,
    );
    context.strokeRect(
      viewport.x * scaleX,
      viewport.y * scaleY,
      viewport.width * scaleX,
      viewport.height * scaleY,
    );
  }, [collapsed, regions, viewport]);

  function handlePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    onNavigate({
      x: ((event.clientX - bounds.left) / bounds.width) * BOARD_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * BOARD_HEIGHT,
    });
  }

  return (
    <section className="minimap" data-collapsed={collapsed} aria-label="Canvas minimap">
      <div className="minimap-header">
        <span>Overview</span>
        <button
          className="icon-button"
          type="button"
          aria-label={collapsed ? "Expand minimap" : "Collapse minimap"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={182}
        height={102}
        aria-label="Navigate the full canvas"
        onPointerDown={handlePointer}
        onPointerMove={(event) => {
          if (event.buttons === 1) handlePointer(event);
        }}
      />
    </section>
  );
}
