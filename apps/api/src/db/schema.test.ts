import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, expect, test } from "vitest";
import {
  createInsight,
  createTestDb,
  createUser,
  truncateAll,
} from "../test/database.js";
import {
  categories,
  cities,
  insightCategories,
  insightCities,
  insightPlaces,
  insights,
  insightVotes,
  places,
  users,
} from "./schema.js";

const { db, pool } = createTestDb();

beforeEach(() => truncateAll(db));
afterAll(() => pool.end());

test("emails that differ only by case conflict", async () => {
  await createUser(db, "ada@minerva.edu");

  await expect(createUser(db, "ADA@Minerva.edu")).rejects.toThrow();
});

test("an insight's title is optional and its upvotes start at zero", async () => {
  const user = await createUser(db);
  const insight = await createInsight(db, user.id, { body: "Body" });

  expect(insight.upvoteCount).toBe(0);
  expect(insight.title).toBeNull();
});

test("deleting an insight removes its join rows but keeps its place", async () => {
  const user = await createUser(db);
  const insight = await createInsight(db, user.id, { body: "Body" });
  const [category] = await db
    .insert(categories)
    .values({ slug: "food", name: "Food", icon: "utensils", sortOrder: 1 })
    .returning();
  const [city] = await db
    .insert(cities)
    .values({
      slug: "tokyo",
      name: "Tokyo",
      country: "Japan",
      timezone: "Asia/Tokyo",
      sortOrder: 1,
    })
    .returning();
  const [place] = await db
    .insert(places)
    .values({ googlePlaceId: "place-1", createdBy: user.id })
    .returning();
  await db
    .insert(insightCategories)
    .values({ insightId: insight.id, categoryId: category!.id });
  await db
    .insert(insightCities)
    .values({ insightId: insight.id, cityId: city!.id });
  await db
    .insert(insightPlaces)
    .values({ insightId: insight.id, placeId: place!.id, position: 0 });
  await db
    .insert(insightVotes)
    .values({ insightId: insight.id, userId: user.id });

  await expect(
    db.insert(insightVotes).values({ insightId: insight.id, userId: user.id }),
  ).rejects.toThrow();
  await expect(
    db.insert(places).values({ googlePlaceId: "place-1", createdBy: user.id }),
  ).rejects.toThrow();

  await db.delete(insights).where(eq(insights.id, insight.id));

  expect(await db.select().from(insightCategories)).toHaveLength(0);
  expect(await db.select().from(insightCities)).toHaveLength(0);
  expect(await db.select().from(insightPlaces)).toHaveLength(0);
  expect(await db.select().from(insightVotes)).toHaveLength(0);
  expect(await db.select().from(places)).toHaveLength(1);
});

test("a user who has insights can't be deleted", async () => {
  const user = await createUser(db);
  await createInsight(db, user.id, { body: "Body" });

  await expect(db.delete(users).where(eq(users.id, user.id))).rejects.toThrow();
});

test("a user who has voted can't be deleted", async () => {
  const author = await createUser(db, "author@minerva.edu");
  const voter = await createUser(db, "voter@minerva.edu");
  const insight = await createInsight(db, author.id, { body: "Body" });
  await db
    .insert(insightVotes)
    .values({ insightId: insight.id, userId: voter.id });

  await expect(
    db.delete(users).where(eq(users.id, voter.id)),
  ).rejects.toThrow();
});

test("a category in use can't be deleted", async () => {
  const user = await createUser(db);
  const insight = await createInsight(db, user.id, { body: "Body" });
  const [category] = await db
    .insert(categories)
    .values({ slug: "food", name: "Food", icon: "utensils", sortOrder: 1 })
    .returning();
  await db
    .insert(insightCategories)
    .values({ insightId: insight.id, categoryId: category!.id });

  await expect(
    db.delete(categories).where(eq(categories.id, category!.id)),
  ).rejects.toThrow();
});

test("places store only the Google place ID", async () => {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'places'
  `);

  expect(result.rows.map((row) => row.column_name).sort()).toEqual([
    "created_at",
    "created_by",
    "google_place_id",
    "id",
  ]);
});
