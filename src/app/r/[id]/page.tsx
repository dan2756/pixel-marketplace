import { ArrowUpRight, Grid2X2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PRODUCT_NAME } from "@/lib/constants";
import { getPublicRegion } from "@/server/claims";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Region ${id.slice(0, 8)}`,
    description: `A permanent owned region on ${PRODUCT_NAME}.`,
    alternates: { canonical: `/r/${id}` },
  };
}

export default async function RegionPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const region = await getPublicRegion(id);
  if (!region) notFound();
  const hostname = new URL(region.destinationUrl).hostname;

  return (
    <main className="region-page">
      <nav className="standalone-nav" aria-label="Region navigation">
        <a className="brand" href="/">
          <Grid2X2 size={18} />
          {PRODUCT_NAME}
        </a>
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
          <a className="secondary-button" href={`/?region=${region.id}`}>
            View on canvas
          </a>
        </div>
      </article>
    </main>
  );
}
