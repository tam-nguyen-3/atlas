import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, test } from "vitest";
import { createTestDb, truncateAll } from "../test/database.js";
import { categories, cities } from "./schema.js";
import { seedReferenceData } from "./seed.js";

const { db, pool } = createTestDb();

beforeEach(() => truncateAll(db));
afterAll(() => pool.end());

test("seeds the launch cities in order", async () => {
  await seedReferenceData(db);

  const rows = await db.select().from(cities).orderBy(asc(cities.sortOrder));

  expect(
    rows.map(({ slug, name, country, timezone, sortOrder }) => ({
      slug,
      name,
      country,
      timezone,
      sortOrder,
    })),
  ).toEqual([
    {
      slug: "san-francisco",
      name: "San Francisco",
      country: "United States",
      timezone: "America/Los_Angeles",
      sortOrder: 1,
    },
    {
      slug: "tokyo",
      name: "Tokyo",
      country: "Japan",
      timezone: "Asia/Tokyo",
      sortOrder: 2,
    },
    {
      slug: "buenos-aires",
      name: "Buenos Aires",
      country: "Argentina",
      timezone: "America/Argentina/Buenos_Aires",
      sortOrder: 3,
    },
  ]);
});

test("seeds the launch categories in order, each with an icon", async () => {
  await seedReferenceData(db);

  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  expect(rows.map((row) => [row.slug, row.name, row.icon])).toEqual([
    ["food", "Food", "utensils"],
    ["transportation", "Transportation", "bus"],
    ["living", "Living", "house"],
    ["health-fitness", "Health & Fitness", "heart-pulse"],
    ["shopping", "Shopping", "shopping-bag"],
    ["travel", "Travel", "plane"],
    ["study-work", "Study & Work", "book-open"],
    ["activities", "Activities", "ticket"],
  ]);
});

test("running twice keeps the same rows and IDs", async () => {
  await seedReferenceData(db);
  const before = await db.select().from(cities).orderBy(asc(cities.slug));

  await seedReferenceData(db);

  expect(await db.select().from(cities).orderBy(asc(cities.slug))).toEqual(
    before,
  );
  expect(await db.select().from(categories)).toHaveLength(8);
});

test("re-running restores a changed value", async () => {
  await seedReferenceData(db);
  await db
    .update(categories)
    .set({ name: "Renamed" })
    .where(eq(categories.slug, "food"));

  await seedReferenceData(db);

  const [food] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "food"));
  expect(food?.name).toBe("Food");
});

test("re-running keeps rows that left the seed list", async () => {
  await db
    .insert(categories)
    .values({ slug: "retired", name: "Retired", icon: "x", sortOrder: 99 });

  await seedReferenceData(db);

  expect(await db.select().from(categories)).toHaveLength(9);
});
