import { ZodError } from "zod";

import { checkoutRequestSchema } from "@/lib/validation";
import {
  CheckoutConflictError,
  createCheckout,
  InventoryConflictError,
} from "@/server/claims";
import {
  assertTrustedOrigin,
  enforceRateLimit,
  requestIp,
  SecurityError,
  verifyTurnstile,
} from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }

    const input = checkoutRequestSchema.parse(await request.json());
    const ip = requestIp(request);

    await enforceRateLimit(ip);
    await verifyTurnstile(input.turnstileToken, ip, input.idempotencyKey);

    const checkout = await createCheckout(input);
    return Response.json(checkout, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? "Invalid checkout request." },
        { status: 400 },
      );
    }
    if (error instanceof SecurityError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof InventoryConflictError || error instanceof CheckoutConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    console.error("Checkout creation failed", error);
    return Response.json(
      { error: "Checkout could not be started. Your card was not charged." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
