import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const migration = await readFile(resolve("drizzle/0000_pixel_marketplace.sql"), "utf8");
const pool = new Pool({ connectionString });

try {
  await pool.query(migration);
  console.info("Applied drizzle/0000_pixel_marketplace.sql");
} finally {
  await pool.end();
}
