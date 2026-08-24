"use client";

import { TriangleAlert } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="success-page">
      <article className="standalone-card">
        <div className="status-icon">
          <TriangleAlert size={22} />
        </div>
        <h1>Something went wrong</h1>
        <p>The canvas could not finish loading. Your payment state has not been changed.</p>
        <button className="primary-button" type="button" onClick={reset}>
          Try again
        </button>
      </article>
    </main>
  );
}
