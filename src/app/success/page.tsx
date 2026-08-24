import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";

import { SuccessStatus } from "@/components/SuccessStatus";

export const metadata: Metadata = {
  title: "Purchase status",
  robots: { index: false, follow: false },
};

export default async function SuccessPage({
  searchParams,
}: PageProps<"/success">) {
  const query = await searchParams;
  const reservationId =
    typeof query.reservation_id === "string" ? query.reservation_id : "";

  return (
    <main className="success-page">
      <nav className="standalone-nav" aria-label="Purchase status navigation">
        <a className="brand" href="/">
          <CheckCircle2 size={18} />
          One Million Pixels
        </a>
      </nav>
      {z.uuid().safeParse(reservationId).success ? (
        <SuccessStatus reservationId={reservationId} />
      ) : (
        <article className="standalone-card">
          <h1>Purchase status unavailable</h1>
          <p>This link does not include a valid reservation identifier.</p>
          <a className="primary-button" href="/">
            Return to canvas
          </a>
        </article>
      )}
    </main>
  );
}
