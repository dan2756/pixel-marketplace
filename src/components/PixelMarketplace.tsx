"use client";

import { CircleHelp, Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BOARD_HEIGHT, BOARD_WIDTH, DEFAULT_COLOR } from "@/lib/constants";
import type { BoardMode } from "@/lib/interaction";
import { buildOwnershipIndex, selectionOverlapsOwnership } from "@/lib/ownership";
import { centeredStarterRect, evaluateSelection } from "@/lib/rect";
import type { OwnershipManifest, PixelRect } from "@/lib/types";
import { normalizeColor, normalizeDestinationUrl } from "@/lib/validation";

import { BoardCanvas } from "./BoardCanvas";
import { BrandMark } from "./BrandMark";
import { Inspector } from "./Inspector";

const emptyManifest: OwnershipManifest = {
  revision: 0,
  generatedAt: new Date(0).toISOString(),
  regions: [],
};

export function PixelMarketplace() {
  const [manifest, setManifest] = useState<OwnershipManifest>(emptyManifest);
  const [manifestState, setManifestState] = useState<"loading" | "ready" | "error">("loading");
  const [selection, setSelection] = useState<PixelRect | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [mode, setMode] = useState<BoardMode>("explore");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focusRegionId, setFocusRegionId] = useState<string | null>(null);
  const idempotencyRef = useRef<{ key: string; fingerprint: string } | null>(null);

  const loadManifest = useCallback(async () => {
    try {
      const response = await fetch("/api/manifest", {
        headers: { Accept: "application/json" },
        cache: "no-cache",
      });
      if (!response.ok) throw new Error("Manifest request failed");
      const next = (await response.json()) as OwnershipManifest;
      setManifest(next);
      setManifestState("ready");
    } catch {
      setManifestState("error");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadManifest(), 0);
    const timer = window.setInterval(() => void loadManifest(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadManifest]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setShowCoachmark(localStorage.getItem("pixel-marketplace-coachmark") !== "dismissed");
      setFocusRegionId(new URLSearchParams(window.location.search).get("region"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const ownershipIndex = useMemo(() => buildOwnershipIndex(manifest.regions), [manifest.regions]);
  const claimedPixels = useMemo(
    () => manifest.regions.reduce((total, region) => total + region.width * region.height, 0),
    [manifest.regions],
  );

  const evaluation = useMemo(() => {
    if (!selection) return null;
    const evaluated = evaluateSelection(
      selection,
      selection.width > 0 &&
        selection.height > 0 &&
        selection.x >= 0 &&
        selection.y >= 0 &&
        selection.x + selection.width <= BOARD_WIDTH &&
        selection.y + selection.height <= BOARD_HEIGHT
        ? selectionOverlapsOwnership(selection, ownershipIndex)
        : false,
      claimedPixels,
    );
    if (manifestState !== "ready") {
      return {
        ...evaluated,
        valid: false,
        reason: "Availability data must load before checkout.",
      };
    }
    return evaluated;
  }, [claimedPixels, manifestState, ownershipIndex, selection]);

  function handleSelectionChange(next: PixelRect | null) {
    setSelection(next);
    if (next) setMode("select");
  }

  async function startCheckout(turnstileToken: string) {
    if (!selection || !evaluation?.valid) return;
    setCheckoutPending(true);
    setCheckoutError(null);

    try {
      const normalizedColor = normalizeColor(color);
      const normalizedUrl = normalizeDestinationUrl(destinationUrl);
      const fingerprint = JSON.stringify({ selection, color: normalizedColor, normalizedUrl });
      const idempotencyKey =
        idempotencyRef.current?.fingerprint === fingerprint
          ? idempotencyRef.current.key
          : crypto.randomUUID();
      idempotencyRef.current = { key: idempotencyKey, fingerprint };
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          rect: selection,
          color: normalizedColor,
          destinationUrl: normalizedUrl,
          idempotencyKey,
          turnstileToken,
        }),
      });
      const body = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !body.checkoutUrl) {
        if (response.status === 409) {
          idempotencyRef.current = null;
          await loadManifest();
        }
        throw new Error(body.error ?? "Checkout could not be started.");
      }
      window.location.assign(body.checkoutUrl);
    } catch (error) {
      setCheckoutPending(false);
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout could not be started. Try again.",
      );
    }
  }

  async function copyViewLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  }

  function dismissCoachmark() {
    localStorage.setItem("pixel-marketplace-coachmark", "dismissed");
    setShowCoachmark(false);
  }

  function placeStarter() {
    handleSelectionChange(centeredStarterRect());
    setShowCoachmark(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-meta" aria-live="polite">
          <span className="status-dot" />
          {manifestState === "ready"
            ? `${claimedPixels.toLocaleString()} claimed · revision ${manifest.revision}`
            : manifestState === "error"
              ? "Ownership feed unavailable"
              : "Loading ownership"}
        </div>
        <div className="topbar-actions">
          {manifestState === "error" ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Retry ownership data"
              onClick={() => void loadManifest()}
            >
              <RefreshCw size={15} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-button"
            aria-label="Copy this canvas view link"
            onClick={() => void copyViewLink()}
          >
            <Copy size={15} />
            <span className="sr-only" aria-live="polite">
              {copied ? "View link copied" : ""}
            </span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Show canvas help"
            onClick={() => setShowCoachmark(true)}
          >
            <CircleHelp size={16} />
          </button>
          <span className="kbd-hint">
            Fit <kbd>F</kbd>
          </span>
        </div>
      </header>

      <div className="workspace">
        <section className="canvas-stage" aria-label="Pixel canvas workspace">
          <BoardCanvas
            regions={manifest.regions}
            ownershipIndex={ownershipIndex}
            selection={selection}
            evaluation={evaluation}
            previewColor={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR}
            mode={mode}
            onModeChange={setMode}
            onSelectionChange={handleSelectionChange}
            loadingMessage={
              manifestState === "loading"
                ? "Loading the ownership snapshot…"
                : manifestState === "error"
                  ? "Ownership data is unavailable. Browsing remains available; checkout is paused."
                  : manifest.regions.length === 0
                    ? "The canvas is open — be the first to claim a region."
                    : undefined
            }
            focusRegionId={focusRegionId}
          />

          {showCoachmark ? (
            <aside className="coachmark" aria-labelledby="coachmark-title">
              <h2 id="coachmark-title">One 720p frame. 921,600 pixels. Sold once.</h2>
              <p>
                A public mosaic, not an ad network and not an NFT. Drag to pan, then Select any
                rectangle. A 10×10 starter is the recommended first purchase. Pay with Stripe or
                Link.
              </p>
              <button type="button" onClick={dismissCoachmark}>
                Got it
              </button>
            </aside>
          ) : null}
        </section>

        <Inspector
          selection={selection}
          evaluation={evaluation}
          soldPixels={claimedPixels}
          color={color}
          destinationUrl={destinationUrl}
          checkoutPending={checkoutPending}
          checkoutError={checkoutError}
          onSelectionChange={handleSelectionChange}
          onPlaceStarter={placeStarter}
          onColorChange={setColor}
          onDestinationUrlChange={setDestinationUrl}
          onCheckout={startCheckout}
        />
      </div>
    </main>
  );
}
