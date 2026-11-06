import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { createDb, requireEnv, type Db } from "./client.js";
import { accounts } from "./schema.js";

// Must pass before anything destructive or test-only touches a database.
export async function assertTestDatabase(db: Db): Promise<void> {
  const result = await db.execute<{ name: string }>(
    sql`SELECT current_database() AS name`,
  );
  const name = result.rows[0]?.name ?? "";
  if (name !== "atlas_test") {
    throw new Error(`Refusing to run against "${name}": expected atlas_test`);
  }
}

export async function seedTestUser(
  db: Db,
  credentials: { email: string; password: string },
): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test user seed requires NODE_ENV=test");
  }
  await assertTestDatabase(db);

  const password = await hashPassword(credentials.password);

  await db.transaction(async (tx) => {
    const email = credentials.email.toLowerCase();
    const result = await tx.execute<{ id: string }>(sql`
      INSERT INTO users (email, email_verified, display_name)
      VALUES (${email}, true, 'Test User')
      ON CONFLICT (lower(email)) DO UPDATE SET
        email = excluded.email, email_verified = excluded.email_verified,
        display_name = excluded.display_name, updated_at = now()
      RETURNING id
    `);
    const user = result.rows[0];
    if (!user) {
      throw new Error("Failed to create the test user");
    }

    // Better Auth uses the user's ID as the account ID for credential accounts.
    await tx
      .insert(accounts)
      .values({
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password,
      })
      .onConflictDoUpdate({
        target: [accounts.providerId, accounts.accountId],
        set: { password, updatedAt: sql`now()` },
      });
  });
}

if (import.meta.main) {
  // Reads only the test URL, so it can't pick up DATABASE_URL by accident.
  const { db, pool } = createDb(requireEnv("TEST_DATABASE_URL"));
  try {
    await seedTestUser(db, {
      email: requireEnv("TEST_USER_EMAIL"),
      password: requireEnv("TEST_USER_PASSWORD"),
    });
    console.log("Seeded the test user.");
  } finally {
    await pool.end();
  }
}
