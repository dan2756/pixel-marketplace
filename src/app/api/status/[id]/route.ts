import { z } from "zod";

import { getReservationStatus } from "@/server/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid reservation ID." }, { status: 400 });
  }

  try {
    const status = await getReservationStatus(id);
    if (!status) {
      return Response.json({ error: "Reservation not found." }, { status: 404 });
    }
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Status query failed", error);
    return Response.json({ error: "Status is temporarily unavailable." }, { status: 503 });
  }
}
