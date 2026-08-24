"use client";

import { Check, Clock3, Copy, ExternalLink, RotateCw, Share2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { ReservationStatus } from "@/lib/types";

type SuccessStatusProps = {
  reservationId: string;
};

export function SuccessStatus({ reservationId }: SuccessStatusProps) {
  const [status, setStatus] = useState<ReservationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/status/${encodeURIComponent(reservationId)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as ReservationStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Status could not be loaded.");
      setStatus(body);
      setError(null);
      return body.status;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Status could not be loaded.");
      return null;
    }
  }, [reservationId]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    async function poll() {
      if (cancelled) return;
      const currentStatus = await loadStatus();
      attempts += 1;
      if (
        !cancelled &&
        currentStatus !== "owned" &&
        currentStatus !== "failed" &&
        currentStatus !== "expired" &&
        currentStatus !== "cancelled"
      ) {
        timer = window.setTimeout(poll, Math.min(8_000, 1_500 + attempts * 350));
      }
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loadStatus]);

  const state = status?.status;
  const owned = state === "owned";
  const failed = state === "failed" || state === "expired" || state === "cancelled";
  const title = owned
    ? "Your pixels are live"
    : failed
      ? "Payment was not completed"
      : "Confirming your purchase";
  const message = owned
    ? "Stripe confirmed payment by webhook. Your region is now part of the permanent ownership snapshot."
    : failed
      ? "The reservation has been released. No ownership was granted; you can return to the canvas and try again."
      : "Checkout returned successfully. We are waiting for the signed server-to-server payment confirmation before granting ownership.";

  async function copyRegionLink() {
    if (!status?.regionUrl) return;
    await navigator.clipboard.writeText(status.regionUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  async function shareRegion() {
    if (!status?.regionUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: "My region on One Million Pixels",
        url: status.regionUrl,
      });
    } else {
      await copyRegionLink();
    }
  }

  return (
    <article className="standalone-card" aria-live="polite">
      <div className="status-icon" data-state={owned ? "owned" : "pending"}>
        {owned ? (
          <Check size={23} />
        ) : failed ? (
          <TriangleAlert size={22} />
        ) : (
          <Clock3 size={22} />
        )}
      </div>
      <span className="eyebrow">
        {owned ? "Webhook confirmed" : failed ? "Reservation released" : "Payment status"}
      </span>
      <h1>{title}</h1>
      <p>{message}</p>

      <div className="status-panel">
        <div className="status-panel-row">
          <span>Status</span>
          <strong>{state?.replaceAll("_", " ") ?? "checking"}</strong>
        </div>
        <div className="status-panel-row">
          <span>Receipt email</span>
          <strong>{status?.customerEmail ?? "Provided by Stripe"}</strong>
        </div>
        <div className="status-panel-row">
          <span>Reservation</span>
          <strong>{reservationId.slice(0, 8)}…</strong>
        </div>
      </div>

      {error ? (
        <div className="validation-message" role="alert">
          <TriangleAlert size={14} />
          {error}
        </div>
      ) : null}

      <div className="standalone-actions">
        {owned && status?.regionUrl ? (
          <>
            <a className="primary-button" href={status.regionUrl}>
              View permanent region <ExternalLink size={14} />
            </a>
            <button className="secondary-button" type="button" onClick={() => void shareRegion()}>
              <Share2 size={14} /> Share
            </button>
            <button className="secondary-button" type="button" onClick={() => void copyRegionLink()}>
              <Copy size={14} /> {copied ? "Copied" : "Copy link"}
            </button>
          </>
        ) : failed ? (
          <a className="primary-button" href="/">
            Return to canvas
          </a>
        ) : (
          <button className="secondary-button" type="button" onClick={() => void loadStatus()}>
            <RotateCw size={14} /> Check again
          </button>
        )}
      </div>
    </article>
  );
}
