import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

type Database = NeonDatabase<typeof schema>;

const globalDatabase = globalThis as typeof globalThis & {
  pixelPool?: Pool;
  pixelDb?: Database;
};

export function getDatabase(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalDatabase.pixelPool) {
    globalDatabase.pixelPool = new Pool({ connectionString });
    globalDatabase.pixelDb = drizzle(globalDatabase.pixelPool, { schema });
  }

  return globalDatabase.pixelDb!;
}
