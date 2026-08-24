import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { BrandMark } from "@/components/BrandMark";
import { SuccessStatus } from "@/components/SuccessStatus";

export const metadata: Metadata = {
  title: "Purchase status",
  robots: { index: false, follow: false },
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const reservationId = typeof query.reservation_id === "string" ? query.reservation_id : "";

  return (
    <main className="success-page">
      <nav className="standalone-nav" aria-label="Purchase status navigation">
        <BrandMark href="/" />
      </nav>
      {z.uuid().safeParse(reservationId).success ? (
        <SuccessStatus reservationId={reservationId} />
      ) : (
        <article className="standalone-card">
          <h1>Purchase status unavailable</h1>
          <p>This link does not include a valid reservation identifier.</p>
          <Link className="primary-button" href="/">
            Return to canvas
          </Link>
        </article>
      )}
    </main>
  );
}
