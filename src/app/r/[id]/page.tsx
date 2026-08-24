import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BrandMark } from "@/components/BrandMark";
import { PRODUCT_TAGLINE } from "@/lib/constants";
import { getPublicRegion } from "@/server/claims";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Region ${id.slice(0, 8)}`,
    description: `A permanent owned region on a 720p public mosaic. ${PRODUCT_TAGLINE}`,
    alternates: { canonical: `/r/${id}` },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const region = await getPublicRegion(id);
  if (!region) notFound();
  const hostname = new URL(region.destinationUrl).hostname;

  return (
    <main className="region-page">
      <nav className="standalone-nav" aria-label="Region navigation">
        <BrandMark href="/" />
      </nav>
      <article className="standalone-card">
        <span className="eyebrow">Permanent region</span>
        <h1>
          {region.width} × {region.height} pixels
        </h1>
        <p>
          Canvas position ({region.x}, {region.y}) ·{" "}
          {(region.width * region.height).toLocaleString()} logical pixels
        </p>
        <div className="region-preview" style={{ backgroundColor: region.color }}>
          {region.color}
        </div>
        <div className="status-panel">
          <div className="status-panel-row">
            <span>Destination</span>
            <strong>{hostname}</strong>
          </div>
          <div className="status-panel-row">
            <span>Purchased</span>
            <strong>{region.purchasedAt?.toLocaleDateString() ?? "Confirmed"}</strong>
          </div>
          <div className="status-panel-row">
            <span>Region ID</span>
            <strong>{region.id.slice(0, 8)}…</strong>
          </div>
        </div>
        <div className="standalone-actions">
          <a
            className="primary-button"
            href={region.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit destination <ArrowUpRight size={15} />
          </a>
          <Link className="secondary-button" href={`/?region=${region.id}`}>
            View on canvas
          </Link>
        </div>
      </article>
    </main>
  );
}
