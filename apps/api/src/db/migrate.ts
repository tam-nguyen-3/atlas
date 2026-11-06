import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, requireEnv, type Db } from "./client.js";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await runMigrations(db);
    console.log("Migrations are up to date.");
  } finally {
    await pool.end();
  }
}
