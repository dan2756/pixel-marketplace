import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const schemaName = `pixel_test_${crypto.randomUUID().replaceAll("-", "")}`;
let pool: Pool;

describeWithDatabase("PostgreSQL inventory guarantees", () => {
  beforeAll(async () => {
    const admin = new Pool({ connectionString: testDatabaseUrl! });
    const client = await admin.connect();
    try {
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}", public`);
      const migration = await readFile(resolve("drizzle/0000_pixel_marketplace.sql"), "utf8");
      await client.query(migration);
    } finally {
      client.release();
      await admin.end();
    }

    const scopedUrl = new URL(testDatabaseUrl!);
    scopedUrl.searchParams.set("options", `-csearch_path=${schemaName},public`);
    pool = new Pool({ connectionString: scopedUrl.toString() });
  }, 30_000);

  beforeEach(async () => {
    await pool.query("TRUNCATE claims, processed_stripe_events, rate_limits");
    await pool.query("UPDATE board_state SET revision = 0, updated_at = now()");
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (!testDatabaseUrl) return;
    const admin = new Pool({ connectionString: testDatabaseUrl });
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await admin.end();
    }
  });

  it("serializes concurrent overlapping claims with a GiST exclusion constraint", async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query("BEGIN");
      await second.query("BEGIN");
      await insertClaim(first, 200, 200, 20, 20);

      const competing = insertClaim(second, 210, 210, 20, 20).then(
        () => ({ code: "committed" }),
        (error: { code?: string }) => ({ code: error.code }),
      );
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
      await first.query("COMMIT");

      expect((await competing).code).toBe("23P01");
      await second.query("ROLLBACK");
    } finally {
      first.release();
      second.release();
    }
  }, 15_000);

  it("allows adjacent half-open rectangles and overlap after release", async () => {
    const firstId = await insertClaim(pool, 0, 0, 10, 10);
    await expect(insertClaim(pool, 10, 0, 10, 10)).resolves.toBeTypeOf("string");
    await pool.query("UPDATE claims SET status = 'expired' WHERE id = $1", [firstId]);
    await expect(insertClaim(pool, 0, 0, 10, 10)).resolves.toBeTypeOf("string");
  });

  it("accepts two pixels and rejects a one-pixel claim", async () => {
    await expect(insertClaim(pool, 0, 0, 2, 1)).resolves.toBeTypeOf("string");
    await expect(insertClaim(pool, 100, 100, 1, 1)).rejects.toMatchObject({ code: "23514" });
  });

  it("durably deduplicates Stripe event identifiers", async () => {
    await pool.query(
      `INSERT INTO processed_stripe_events
        (event_id, event_type, event_created_at, payload_digest)
       VALUES ('evt_duplicate', 'checkout.session.completed', now(), $1)`,
      ["a".repeat(64)],
    );

    await expect(
      pool.query(
        `INSERT INTO processed_stripe_events
          (event_id, event_type, event_created_at, payload_digest)
         VALUES ('evt_duplicate', 'checkout.session.completed', now(), $1)`,
        ["a".repeat(64)],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

type QueryClient = {
  query: (query: string, values?: unknown[]) => Promise<unknown>;
};

async function insertClaim(
  client: QueryClient,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO claims (
      id, status, x, y, width, height, color, destination_url,
      unit_price_cents, total_cents, idempotency_key, expires_at
    ) VALUES ($1, 'reserved', $2, $3, $4, $5, '#6857F5', 'https://example.com/',
      25, $6, $7, now() + interval '31 minutes')`,
    [id, x, y, width, height, width * height * 25, crypto.randomUUID()],
  );
  return id;
}
