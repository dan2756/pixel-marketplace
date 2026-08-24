import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { getDatabase } from "./db/client";
import { appUrl, isProduction } from "./env";

type TurnstileResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function requestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowed = new URL(process.env.ALLOWED_ORIGIN ?? appUrl()).origin;
  if (origin !== allowed) {
    throw new SecurityError("Request origin is not allowed.", 403);
  }
}

export async function verifyTurnstile(
  token: string,
  ip: string,
  idempotencyKey: string,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (isProduction()) {
      throw new SecurityError("Purchase protection is not configured.", 503);
    }
    return;
  }
  if (!token) throw new SecurityError("Complete the security check.", 403);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: ip,
      idempotency_key: idempotencyKey,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new SecurityError("Security check is temporarily unavailable.", 503);
  }

  const result = (await response.json()) as TurnstileResponse;
  if (!result.success || (result.action && result.action !== "checkout")) {
    throw new SecurityError("Security check failed. Please try again.", 403);
  }
}

export async function enforceRateLimit(ip: string, maxRequests = 8): Promise<void> {
  const identifierHash = createHash("sha256").update(ip).digest("hex");
  const db = getDatabase();
  const result = await db.execute<{ request_count: number }>(sql`
    INSERT INTO rate_limits (identifier_hash, window_start, request_count, updated_at)
    VALUES (
      ${identifierHash},
      date_trunc('minute', transaction_timestamp()),
      1,
      transaction_timestamp()
    )
    ON CONFLICT (identifier_hash, window_start)
    DO UPDATE SET
      request_count = rate_limits.request_count + 1,
      updated_at = transaction_timestamp()
    RETURNING request_count
  `);

  if ((result.rows[0]?.request_count ?? maxRequests + 1) > maxRequests) {
    throw new SecurityError("Too many checkout attempts. Wait a minute and try again.", 429);
  }
}

export class SecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}
