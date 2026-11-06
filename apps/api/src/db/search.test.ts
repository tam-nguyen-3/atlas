import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  createInsight,
  createTestDb,
  createUser,
  truncateAll,
} from "../test/database.js";
import { insights } from "./schema.js";

const { db, pool } = createTestDb();

beforeEach(() => truncateAll(db));
afterAll(() => pool.end());

// The same query Phase 4 runs for GET /api/insights.
async function search(q: string) {
  const query = sql`websearch_to_tsquery('public.atlas_search', ${q})`;
  const result = await db.execute<{ body: string }>(sql`
    SELECT body FROM insights
    WHERE search_vector @@ ${query}
    ORDER BY ts_rank(search_vector, ${query}) DESC
  `);
  return result.rows.map((row) => row.body);
}

async function insertBodies(...bodies: string[]) {
  const user = await createUser(db);
  for (const body of bodies) {
    await createInsight(db, user.id, { body });
  }
}

describe("accents", () => {
  test.each([
    ["accented text, plain query", "Best café in town", "cafe"],
    ["plain text, accented query", "Best cafe in town", "café"],
    ["accented text, same query", "Best café in town", "café"],
    ["uppercase accent", "CAFÉ OPEN LATE", "cafe"],
    ["Spanish place, plain query", "Near Constitución station", "constitucion"],
    [
      "Spanish place, accented query",
      "Near Constitucion station",
      "Constitución",
    ],
    ["ñ", "Pastries from Peñalolén", "penalolen"],
    ["hyphenated, plain query", "The Saint-Rémy bakery", "saint-remy"],
    ["hyphen part, plain query", "The Saint-Rémy bakery", "remy"],
  ])("%s", async (_name, body, q) => {
    await insertBodies(body);

    expect(await search(q)).toEqual([body]);
  });
});

describe("simple text search", () => {
  test("keeps word endings distinct", async () => {
    await insertBodies("Good restaurant nearby");

    expect(await search("restaurants")).toHaveLength(0);
  });

  test("folds accents on plural words", async () => {
    await insertBodies("Two great cafés");

    expect(await search("cafes")).toHaveLength(1);
  });

  test("supports websearch syntax", async () => {
    await insertBodies("cheap ramen in Shibuya", "cheap tacos in Palermo");

    expect(await search("cheap -tacos")).toEqual(["cheap ramen in Shibuya"]);
    expect(await search('"ramen in Shibuya"')).toHaveLength(1);
  });

  test("keeps common words searchable", async () => {
    await insertBodies("the best");

    expect(await search("the")).toEqual(["the best"]);
  });
});

describe("known limits", () => {
  test("Japanese matches a whole run of text, but not part of one", async () => {
    await insertBodies("渋谷駅の近く");

    expect(await search("渋谷駅の近く")).toHaveLength(1);
    expect(await search("渋谷")).toEqual([]);
  });

  test("romanised Japanese matches", async () => {
    await insertBodies("Near Shibuya station");

    expect(await search("shibuya")).toHaveLength(1);
  });
});

describe("search_vector", () => {
  test("ranks a title match above a body match", async () => {
    const user = await createUser(db);
    await createInsight(db, user.id, { body: "A note about ramen" });
    await createInsight(db, user.id, { title: "Ramen", body: "A note" });

    expect(await search("ramen")).toEqual(["A note", "A note about ramen"]);
  });

  test("works without a title", async () => {
    const user = await createUser(db);
    const insight = await createInsight(db, user.id, { body: "ramen" });

    expect(insight.searchVector).toContain("ramen");
  });

  test("follows edits to the body", async () => {
    const user = await createUser(db);
    const insight = await createInsight(db, user.id, { body: "ramen" });

    await db
      .update(insights)
      .set({ body: "tacos" })
      .where(eq(insights.id, insight.id));

    expect(await search("ramen")).toEqual([]);
    expect(await search("tacos")).toEqual(["tacos"]);
  });

  test("has a GIN index", async () => {
    const result = await db.execute<{ indexdef: string }>(sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'insights' AND indexname = 'insights_search_vector_idx'
    `);

    expect(result.rows[0]?.indexdef).toContain("USING gin (search_vector)");
  });
});
