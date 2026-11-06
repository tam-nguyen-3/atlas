import { sql } from "drizzle-orm";
import { runMigrations } from "../db/migrate.js";
import { assertTestDatabase } from "../db/seed-test-user.js";
import { createTestDb } from "./database.js";

// Rebuilds the test database from empty, so every run proves the migrations.
export default async function setup(): Promise<void> {
  const { db, pool } = createTestDb();
  try {
    await assertTestDatabase(db);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await runMigrations(db);
    // CI and local runs also verify the migration journal on a second pass.
    await runMigrations(db);
  } finally {
    await pool.end();
  }
}
