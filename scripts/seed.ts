import "dotenv/config";

import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (process.env.VERCEL_ENV === "production") {
  throw new Error("Refusing to seed a production Vercel database");
}

const pool = new Pool({ connectionString });
const samples = [
  { x: 112, y: 96, width: 80, height: 48, color: "#E85D44", url: "https://example.com/" },
  { x: 446, y: 248, width: 120, height: 64, color: "#246BFD", url: "https://vercel.com/" },
  { x: 848, y: 456, width: 64, height: 80, color: "#1D9E75", url: "https://neon.tech/" },
];

try {
  await pool.query("BEGIN");
  for (const sample of samples) {
    await pool.query(
      `INSERT INTO claims (
        id, status, x, y, width, height, color, destination_url,
        unit_price_cents, total_cents, idempotency_key, expires_at, purchased_at
      ) VALUES ($1, 'owned', $2, $3, $4, $5, $6, $7, 25, $8, $9, 'infinity', now())
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        randomUUID(),
        sample.x,
        sample.y,
        sample.width,
        sample.height,
        sample.color,
        sample.url,
        sample.width * sample.height * 25,
        randomUUID(),
      ],
    );
  }
  await pool.query(
    "UPDATE board_state SET revision = revision + 1, updated_at = now() WHERE singleton = true",
  );
  await pool.query("COMMIT");
  console.info(`Seeded ${samples.length} sample regions`);
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
