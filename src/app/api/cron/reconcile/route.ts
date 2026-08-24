import { reconcileCheckouts } from "@/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && (!secret || authorization !== `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await reconcileCheckouts();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Checkout reconciliation failed", error);
    return Response.json({ error: "Reconciliation failed." }, { status: 500 });
  }
}
