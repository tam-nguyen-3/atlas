import { sql } from "drizzle-orm";
import { createDb, type Db } from "../db/client.js";
import { insights, users } from "../db/schema.js";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://atlas:atlas@127.0.0.1:5432/atlas_test";

export function createTestDb() {
  return createDb(testDatabaseUrl);
}

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(sql`
    TRUNCATE users, sessions, accounts, verifications, cities, categories,
      places, insights, insight_categories, insight_cities, insight_places,
      insight_votes, rate_limits
  `);
}

export async function createUser(db: Db, email = "ada@minerva.edu") {
  const [user] = await db
    .insert(users)
    .values({ email, displayName: "Ada" })
    .returning();
  if (!user) {
    throw new Error("Failed to create user");
  }
  return user;
}

export async function createInsight(
  db: Db,
  authorId: string,
  content: { title?: string; body: string },
) {
  const [insight] = await db
    .insert(insights)
    .values({ authorId, ...content })
    .returning();
  if (!insight) {
    throw new Error("Failed to create insight");
  }
  return insight;
}
