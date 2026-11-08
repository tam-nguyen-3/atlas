import { createInsightSchema, insightFeedSchema } from "@atlas/shared";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, expect, test } from "vitest";
import { createApp } from "../app.js";
import { createInsightRepository } from "../insights/repository.js";
import { createInsightService } from "../insights/service.js";
import {
  createInsight,
  createTestDb,
  createUser,
  testDatabaseUrl,
  truncateAll,
} from "../test/database.js";
import { DEMO_AUTHORS, DEMO_INSIGHTS } from "./demo-content.js";
import {
  accounts,
  categories,
  cities,
  insights,
  insightVotes,
  users,
} from "./schema.js";
import { assertDemoUrl, seedDemoContent, seedLocalDemo } from "./seed-demo.js";

const { db, pool } = createTestDb();
const now = new Date("2026-11-08T18:00:00Z");
beforeEach(() => truncateAll(db));
afterAll(() => pool.end());

test("curated data covers the walkthrough with valid varied content", () => {
  expect(DEMO_INSIGHTS).toHaveLength(60);
  expect(new Set(DEMO_INSIGHTS.map((item) => item.id)).size).toBe(60);
  const distribution = new Map<string, number>();
  for (const item of DEMO_INSIGHTS) {
    expect(createInsightSchema.safeParse(item.input).success).toBe(true);
    const city = item.input.citySlugs[0] ?? "general";
    distribution.set(city, (distribution.get(city) ?? 0) + 1);
  }
  expect(Object.fromEntries(distribution)).toEqual({
    "san-francisco": 24,
    tokyo: 16,
    "buenos-aires": 12,
    general: 8,
  });
  expect(
    new Set(DEMO_INSIGHTS.flatMap((item) => item.input.categorySlugs)).size,
  ).toBe(8);
  expect(DEMO_INSIGHTS.filter((item) => item.owned)).toHaveLength(8);
  expect(
    new Set(
      DEMO_INSIGHTS.filter((item) => item.owned).map(
        (item) => item.input.citySlugs[0] ?? "general",
      ),
    ).size,
  ).toBe(4);
  expect(DEMO_INSIGHTS.some((item) => item.input.title === null)).toBe(true);
  expect(DEMO_INSIGHTS.some((item) => item.input.sourceUrl !== null)).toBe(
    true,
  );
  expect(
    DEMO_INSIGHTS.every(
      (item) =>
        item.ageHours > 0 &&
        item.ageHours < 56 * 24 &&
        !item.input.places.length,
    ),
  ).toBe(true);
  expect(
    Math.max(...DEMO_INSIGHTS.map((item) => item.ageHours)),
  ).toBeGreaterThan(53 * 24);
});

test("production, remote, test, and override URLs are refused before connecting", async () => {
  for (const url of [
    "postgres://user:password@db.example.com/atlas_dev",
    "postgres://localhost/atlas_test",
    "postgres://localhost/atlas_prod",
    "postgres://localhost/atlas_dev?host=remote.example.com",
    "postgres://localhost/atlas_dev?dbname=atlas_prod",
    "https://localhost/atlas_dev",
  ]) {
    expect(() => assertDemoUrl(url)).toThrow("Demo seed requires");
    await expect(seedLocalDemo(url, "owner@minerva.edu")).rejects.toThrow(
      "Demo seed requires",
    );
  }
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    expect(() =>
      assertDemoUrl(`postgresql://user:password@${host}:5432/atlas_dev`),
    ).not.toThrow();
  }
});

test("missing owners leave every table untouched", async () => {
  await expect(seedDemoContent(db, "")).rejects.toThrow("owner email");
  await expect(seedDemoContent(db, "absent@minerva.edu")).rejects.toThrow(
    "does not exist",
  );
  expect(await db.select().from(users)).toHaveLength(0);
  expect(await db.select().from(cities)).toHaveLength(0);
  expect(await db.select().from(categories)).toHaveLength(0);
  expect(await db.select().from(insights)).toHaveLength(0);
});

test("reruns preserve edits, associations, dates, profile changes, votes, and unrelated data", async () => {
  const owner = await createUser(db);
  const unrelated = await createInsight(db, owner.id, {
    body: "Existing content",
  });
  expect(await seedDemoContent(db, owner.email, now)).toMatchObject({
    inserted: 60,
    skipped: 0,
  });
  expect(await db.select().from(users)).toHaveLength(13);
  expect(await db.select().from(accounts)).toHaveLength(0);
  const item = DEMO_INSIGHTS[0]!;
  const service = createInsightService(createInsightRepository(db));
  await service.update(item.id, owner.id, {
    body: "Edited during filming",
    categorySlugs: ["travel"],
    citySlugs: ["tokyo"],
  });
  await service.vote(item.id, owner.id, true);
  // Even a removed demo vote must stay removed on rerun.
  await service.vote(item.id, DEMO_AUTHORS[0]!.id, false);
  await db
    .update(users)
    .set({ displayName: "Updated Demo Author" })
    .where(eq(users.id, DEMO_AUTHORS[0]!.id));
  const before = await service.get(item.id, owner.id);
  const ownerBefore = await db
    .select()
    .from(users)
    .where(eq(users.id, owner.id));
  expect(
    await seedDemoContent(
      db,
      owner.email.toUpperCase(),
      new Date(now.getTime() + 86400000),
    ),
  ).toMatchObject({ inserted: 0, skipped: 60 });
  expect(await service.get(item.id, owner.id)).toEqual(before);
  expect(await db.select().from(users).where(eq(users.id, owner.id))).toEqual(
    ownerBefore,
  );
  expect(
    await db.select().from(insights).where(eq(insights.id, unrelated.id)),
  ).toEqual([unrelated]);
  expect(
    (await db.select().from(users).where(eq(users.id, DEMO_AUTHORS[0]!.id)))[0]
      ?.displayName,
  ).toBe("Updated Demo Author");
  const mismatches = await db.execute(
    sql`SELECT i.id FROM insights i WHERE i.upvote_count <> (SELECT count(*) FROM insight_votes v WHERE v.insight_id = i.id)`,
  );
  expect(mismatches.rows).toHaveLength(0);
  expect(
    await db
      .select()
      .from(insightVotes)
      .where(eq(insightVotes.userId, owner.id)),
  ).toHaveLength(1);
});

test("a failed author insert rolls back reference rows and content", async () => {
  const owner = await createUser(db);
  await createUser(db, DEMO_AUTHORS[0]!.email);
  await expect(seedDemoContent(db, owner.email, now)).rejects.toThrow();
  expect(await db.select().from(cities)).toHaveLength(0);
  expect(await db.select().from(categories)).toHaveLength(0);
  expect(await db.select().from(users)).toHaveLength(2);
  expect(await db.select().from(insights)).toHaveLength(0);
});

test("authenticated API exposes pagination, General search, top sorting, details, and My insights", async () => {
  const app = createApp({
    db,
    config: {
      NODE_ENV: "test",
      PORT: 3000,
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:5173",
      BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
    },
  });
  try {
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: "http://localhost:5173" },
      payload: {
        name: "Demo Owner",
        email: "owner@minerva.edu",
        password: "local-test-password",
      },
    });
    expect(signup.statusCode, signup.body).toBe(200);
    const cookies = signup.headers["set-cookie"]!;
    const cookie = (Array.isArray(cookies) ? cookies : [cookies])
      .map((value) => value.split(";")[0])
      .join("; ");
    await seedDemoContent(db, "owner@minerva.edu", now);
    const feed = async (query: string) => {
      const response = await app.inject({
        method: "GET",
        url: `/api/insights?${query}`,
        headers: { cookie },
      });
      expect(response.statusCode, response.body).toBe(200);
      return insightFeedSchema.parse(response.json());
    };
    expect(await feed("city=san-francisco")).toMatchObject({
      total: 24,
      items: expect.any(Array) as unknown,
    });
    expect((await feed("city=san-francisco")).items).toHaveLength(20);
    expect((await feed("city=san-francisco&page=2")).items).toHaveLength(4);
    expect((await feed("city=tokyo")).total).toBe(16);
    expect((await feed("city=buenos-aires")).total).toBe(12);
    expect((await feed("city=general")).total).toBe(8);
    expect((await feed("author=me")).total).toBe(8);
    const search = await feed("city=san-francisco&q=groceries");
    expect(search.items.some((item) => !item.cities.length)).toBe(true);
    expect(
      search.items.some((item) =>
        item.cities.some((city) => city.slug === "san-francisco"),
      ),
    ).toBe(true);
    expect(
      (await feed("city=san-francisco&category=food")).items.every((item) =>
        item.categories.some((category) => category.slug === "food"),
      ),
    ).toBe(true);
    const top = await feed("city=san-francisco&sort=top");
    expect(top.items.map((item) => item.upvoteCount)).toEqual(
      top.items.map((item) => item.upvoteCount).sort((a, b) => b - a),
    );
    expect(top.items.every((item) => !item.viewerHasUpvoted)).toBe(true);
    const detail = await app.inject({
      method: "GET",
      url: `/api/insights/${DEMO_INSIGHTS[0]!.id}`,
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      isAuthor: true,
      places: [],
      viewerHasUpvoted: false,
    });
  } finally {
    await app.close();
  }
});
