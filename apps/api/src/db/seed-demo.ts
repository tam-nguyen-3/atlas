import { eq, sql } from "drizzle-orm";
import { createDb, requireEnv, type Db } from "./client.js";
import { DEMO_AUTHORS, DEMO_INSIGHTS } from "./demo-content.js";
import {
  categories,
  cities,
  insightCategories,
  insightCities,
  insights,
  insightVotes,
  users,
} from "./schema.js";
import { CATEGORIES, CITIES } from "./seed.js";

export function assertDemoUrl(connectionString: string): void {
  const url = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/atlas_dev" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Demo seed requires a loopback atlas_dev URL without query overrides",
    );
  }
}

// Kept separate so tests can exercise the same transaction against atlas_test.
export async function seedDemoContent(
  db: Db,
  ownerEmail: string,
  now = new Date(),
) {
  if (!ownerEmail.trim())
    throw new Error("An existing demo owner email is required");
  return db.transaction(async (tx) => {
    // Serializes concurrent seeds; ordinary app writes still use their normal locks.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(731905428)`);
    const [owner] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${ownerEmail.trim().toLowerCase()}`);
    if (!owner)
      throw new Error("Demo owner does not exist; sign up normally first");

    // Insert missing reference rows without changing existing reference data.
    await tx.insert(cities).values(CITIES).onConflictDoNothing();
    await tx.insert(categories).values(CATEGORIES).onConflictDoNothing();
    await tx
      .insert(users)
      .values(DEMO_AUTHORS)
      .onConflictDoNothing({ target: users.id });
    const cityRows = await tx.select().from(cities);
    const categoryRows = await tx.select().from(categories);
    let inserted = 0;
    for (const item of DEMO_INSIGHTS) {
      const createdAt = new Date(now.getTime() - item.ageHours * 3600000);
      const [row] = await tx
        .insert(insights)
        .values({
          id: item.id,
          authorId: item.owned ? owner.id : DEMO_AUTHORS[item.authorIndex]!.id,
          title: item.input.title,
          body: item.input.body,
          sourceUrl: item.input.sourceUrl,
          createdAt,
          updatedAt: createdAt,
        })
        .onConflictDoNothing({ target: insights.id })
        .returning({ id: insights.id });
      if (!row) continue;
      inserted++;
      await tx.insert(insightCategories).values(
        item.input.categorySlugs.map((slug) => ({
          insightId: item.id,
          categoryId: categoryRows.find((row) => row.slug === slug)!.id,
        })),
      );
      if (item.input.citySlugs.length) {
        await tx.insert(insightCities).values(
          item.input.citySlugs.map((slug) => ({
            insightId: item.id,
            cityId: cityRows.find((row) => row.slug === slug)!.id,
          })),
        );
      }
      if (item.voteCount) {
        await tx.insert(insightVotes).values(
          DEMO_AUTHORS.slice(0, item.voteCount).map((author) => ({
            insightId: item.id,
            userId: author.id,
            createdAt: new Date(createdAt.getTime() + 3600000),
          })),
        );
        await tx
          .update(insights)
          .set({ upvoteCount: item.voteCount })
          .where(eq(insights.id, item.id));
      }
    }
    return {
      inserted,
      skipped: DEMO_INSIGHTS.length - inserted,
      ownerId: owner.id,
    };
  });
}

export async function seedLocalDemo(
  connectionString: string,
  ownerEmail: string,
) {
  assertDemoUrl(connectionString);
  const { db, pool } = createDb(connectionString);
  try {
    const result = await db.execute<{ name: string }>(
      sql`SELECT current_database() AS name`,
    );
    if (result.rows[0]?.name !== "atlas_dev")
      throw new Error("Expected atlas_dev database");
    return await seedDemoContent(db, ownerEmail);
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  const result = await seedLocalDemo(
    requireEnv("DATABASE_URL"),
    requireEnv("DEMO_OWNER_EMAIL"),
  );
  console.log(
    `Demo seed: ${result.inserted} inserted, ${result.skipped} preserved. Owner: ${result.ownerId}`,
  );
}
