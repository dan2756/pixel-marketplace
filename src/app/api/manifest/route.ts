import { getOwnershipManifest } from "@/server/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const manifest = await getOwnershipManifest();
    const etag = `"pixels-${manifest.revision}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: manifestHeaders(etag),
      });
    }

    return Response.json(manifest, {
      headers: manifestHeaders(etag),
    });
  } catch (error) {
    console.error("Manifest query failed", error);
    return Response.json(
      { error: "Ownership data is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function manifestHeaders(etag: string): HeadersInit {
  return {
    ETag: etag,
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    "Content-Type": "application/json; charset=utf-8",
  };
}
