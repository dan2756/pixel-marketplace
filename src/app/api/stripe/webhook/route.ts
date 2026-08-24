import { constructStripeEvent, processStripeEvent } from "@/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;

  try {
    event = constructStripeEvent(rawBody, signature);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event, rawBody);
    return Response.json(
      { received: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error,
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
