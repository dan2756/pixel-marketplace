"use client";

import { AlertTriangle, LockKeyhole, MousePointer2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { BOARD_HEIGHT, BOARD_WIDTH, MIN_SELECTION_PIXELS } from "@/lib/constants";
import type { PixelRect, SelectionEvaluation } from "@/lib/types";
import { formatUsd, normalizeColor, normalizeDestinationUrl } from "@/lib/validation";

import { TurnstileWidget } from "./TurnstileWidget";

type InspectorProps = {
  selection: PixelRect | null;
  evaluation: SelectionEvaluation | null;
  color: string;
  destinationUrl: string;
  checkoutPending: boolean;
  checkoutError: string | null;
  onSelectionChange: (selection: PixelRect | null) => void;
  onColorChange: (color: string) => void;
  onDestinationUrlChange: (url: string) => void;
  onCheckout: (turnstileToken: string) => Promise<void>;
};

export function Inspector({
  selection,
  evaluation,
  color,
  destinationUrl,
  checkoutPending,
  checkoutError,
  onSelectionChange,
  onColorChange,
  onDestinationUrlChange,
  onCheckout,
}: InspectorProps) {
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);
  const turnstileRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const formValid =
    Boolean(evaluation?.valid) &&
    !urlError &&
    !colorError &&
    destinationUrl.trim().length > 0 &&
    (!turnstileRequired || Boolean(turnstileToken));

  const validationText = useMemo(() => {
    if (!selection || !evaluation) return null;
    if (evaluation.reason) return evaluation.reason;
    if (colorError) return colorError;
    if (urlError) return urlError;
    if (!destinationUrl.trim()) return "Add a destination URL before checkout.";
    return null;
  }, [colorError, destinationUrl, evaluation, selection, urlError]);

  if (!selection || !evaluation) {
    return (
      <aside className="inspector" aria-label="Selection inspector">
        <div className="empty-inspector">
          <div>
            <MousePointer2 size={24} aria-hidden="true" />
            <h2>Select open pixels</h2>
            <p>
              Choose Select, then drag a rectangle. Every logical pixel is $0.25; the minimum is{" "}
              {MIN_SELECTION_PIXELS}.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  function updateCoordinate(key: keyof PixelRect, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isInteger(value)) return;
    const next = { ...selection!, [key]: value };
    onSelectionChange(next);
  }

  function validateUrl() {
    try {
      const normalized = normalizeDestinationUrl(destinationUrl);
      setUrlError(null);
      onDestinationUrlChange(normalized);
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : "Enter a valid URL.");
    }
  }

  function validateColor(value: string) {
    onColorChange(value);
    try {
      const normalized = normalizeColor(value);
      setColorError(null);
      if (normalized !== value) onColorChange(normalized);
    } catch (error) {
      setColorError(error instanceof Error ? error.message : "Enter a valid color.");
    }
  }

  async function submitCheckout() {
    let normalizedUrl: string;
    let normalizedColor: string;
    try {
      normalizedUrl = normalizeDestinationUrl(destinationUrl);
      normalizedColor = normalizeColor(color);
      setUrlError(null);
      setColorError(null);
      onDestinationUrlChange(normalizedUrl);
      onColorChange(normalizedColor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check the purchase details.";
      if (message.toLowerCase().includes("color") || message.toLowerCase().includes("hex")) {
        setColorError(message);
      } else {
        setUrlError(message);
      }
      return;
    }
    if (!evaluation.valid || (turnstileRequired && !turnstileToken)) return;
    try {
      await onCheckout(turnstileToken);
    } finally {
      setTurnstileResetKey((value) => value + 1);
    }
  }

  return (
    <aside className="inspector" aria-label="Selection inspector">
      <header className="inspector-header">
        <div>
          <span className="eyebrow">Region inspector</span>
          <h2>Configure selection</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Clear selection"
          onClick={() => onSelectionChange(null)}
        >
          <X size={16} />
        </button>
      </header>

      <div className="inspector-content">
        <div className="selection-summary" aria-label="Selection summary">
          <div className="summary-cell">
            <span>Dimensions</span>
            <strong>
              {selection.width} × {selection.height}
            </strong>
          </div>
          <div className="summary-cell">
            <span>Pixels</span>
            <strong>{evaluation.pixelCount.toLocaleString()}</strong>
          </div>
        </div>

        <section className="form-section" aria-labelledby="coordinates-title">
          <div className="form-section-title" id="coordinates-title">
            Coordinates
            <span className="eyebrow">Non-drag input</span>
          </div>
          <div className="coordinates">
            <label className="coordinate-field">
              X
              <input
                className="coordinate-input"
                type="number"
                min={0}
                max={BOARD_WIDTH - 1}
                value={selection.x}
                onChange={(event) => updateCoordinate("x", event.target.value)}
              />
            </label>
            <label className="coordinate-field">
              Y
              <input
                className="coordinate-input"
                type="number"
                min={0}
                max={BOARD_HEIGHT - 1}
                value={selection.y}
                onChange={(event) => updateCoordinate("y", event.target.value)}
              />
            </label>
            <label className="coordinate-field">
              W
              <input
                className="coordinate-input"
                type="number"
                min={1}
                max={BOARD_WIDTH}
                value={selection.width}
                onChange={(event) => updateCoordinate("width", event.target.value)}
              />
            </label>
            <label className="coordinate-field">
              H
              <input
                className="coordinate-input"
                type="number"
                min={1}
                max={BOARD_HEIGHT}
                value={selection.height}
                onChange={(event) => updateCoordinate("height", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="form-section" aria-labelledby="appearance-title">
          <div className="form-section-title" id="appearance-title">
            Appearance
            <span className="eyebrow">Live preview</span>
          </div>
          <div className="color-row">
            <input
              className="color-picker"
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#6857f5"}
              aria-label="Region color"
              onChange={(event) => validateColor(event.target.value)}
            />
            <label className="field">
              <span className="sr-only">Hex color</span>
              <input
                className="text-input"
                value={color}
                maxLength={7}
                spellCheck={false}
                aria-invalid={Boolean(colorError)}
                onChange={(event) => validateColor(event.target.value)}
                onBlur={() => validateColor(color)}
              />
            </label>
          </div>
        </section>

        <label className="field">
          <span>Destination URL</span>
          <input
            className="text-input"
            type="url"
            inputMode="url"
            placeholder="your-site.com"
            value={destinationUrl}
            aria-invalid={Boolean(urlError)}
            onChange={(event) => {
              setUrlError(null);
              onDestinationUrlChange(event.target.value);
            }}
            onBlur={validateUrl}
          />
        </label>

        {validationText || checkoutError ? (
          <div className="validation-message" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{checkoutError ?? validationText}</span>
          </div>
        ) : null}

        <div className="checkout-area">
          <div className="total-row">
            <span>
              {evaluation.pixelCount.toLocaleString()} px × $0.25
              <br />
              One-time purchase
            </span>
            <strong>{formatUsd(evaluation.priceCents)}</strong>
          </div>

          <TurnstileWidget onToken={handleToken} resetKey={turnstileResetKey} />

          <button
            type="button"
            className="primary-button"
            disabled={!formValid || checkoutPending}
            onClick={submitCheckout}
          >
            {checkoutPending ? <span className="spinner" /> : <LockKeyhole size={15} />}
            {checkoutPending ? "Reserving…" : "Continue to secure checkout"}
          </button>
          <div className="checkout-note">
            Availability and price are rechecked on the server. Ownership is granted only after a
            verified Stripe webhook confirms payment.
          </div>
        </div>
      </div>
    </aside>
  );
}
