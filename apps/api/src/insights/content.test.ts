import { randomUUID } from "node:crypto";
import {
  insightDetailSchema,
  insightFeedSchema,
  voteSchema,
  type InsightDetail,
} from "@atlas/shared";
import { and, count, eq, sql } from "drizzle-orm";
import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";
import { afterAll, afterEach, beforeEach, expect, test } from "vitest";
import { createApp } from "../app.js";
import type { Config } from "../config.js";
import {
  categories,
  cities,
  insightCategories,
  insightCities,
  insightPlaces,
  insights,
  insightVotes,
  places,
} from "../db/schema.js";
import { seedReferenceData } from "../db/seed.js";
import {
  createTestDb,
  testDatabaseUrl,
  truncateAll,
} from "../test/database.js";

const { db, pool } = createTestDb();
const config: Config = {
  NODE_ENV: "test",
  PORT: 3000,
  DATABASE_URL: testDatabaseUrl,
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:5173",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
};
let app: FastifyInstance;
let ownerCookie: string;
let otherCookie: string;
let ownerId: string;
const base = {
  body: "A café recommendation",
  categorySlugs: ["food"],
  citySlugs: ["tokyo"],
};

function cookies(response: LightMyRequestResponse) {
  const value = response.headers["set-cookie"];
  return (Array.isArray(value) ? value : [value!])
    .map((entry) => entry.split(";")[0])
    .join("; ");
}
function request(
  method: InjectOptions["method"],
  url: string,
  payload?: object,
  cookie = ownerCookie,
) {
  return app.inject({
    method,
    url,
    headers: { cookie, origin: config.WEB_ORIGIN },
    ...(payload === undefined ? {} : { payload }),
  });
}
function status(response: LightMyRequestResponse, expected = 200) {
  expect(response.statusCode, response.body).toBe(expected);
  expect(response.headers["cache-control"]).toBe("no-store");
  if (expected >= 400)
    expect(response.json()).toMatchObject({
      error: {
        code: expect.any(String) as unknown,
        message: expect.any(String) as unknown,
      },
    });
}
async function create(input: object = {}, cookie = ownerCookie) {
  const response = await request(
    "POST",
    "/api/insights",
    { ...base, ...input },
    cookie,
  );
  status(response, 201);
  return insightDetailSchema.parse(response.json());
}
async function get(id: string, cookie = ownerCookie) {
  const response = await request(
    "GET",
    `/api/insights/${id}`,
    undefined,
    cookie,
  );
  status(response);
  return insightDetailSchema.parse(response.json());
}
async function feed(query: string, cookie = ownerCookie) {
  const response = await request(
    "GET",
    `/api/insights?${query}`,
    undefined,
    cookie,
  );
  status(response);
  return insightFeedSchema.parse(response.json());
}
async function vote(id: string, add: boolean, cookie = ownerCookie) {
  const response = await request(
    add ? "PUT" : "DELETE",
    `/api/insights/${id}/vote`,
    undefined,
    cookie,
  );
  status(response);
  return voteSchema.parse(response.json());
}
beforeEach(async () => {
  await truncateAll(db);
  await seedReferenceData(db);
  app = createApp({ db, config });
  const signup = async (name: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        name,
        email: `${name}@minerva.edu`,
        password: "local-test-password",
      },
    });
    status(response);
    return cookies(response);
  };
  ownerCookie = await signup("author");
  otherCookie = await signup("reader");
  const me = await request("GET", "/api/me");
  ownerId = me.json<{ id: string }>().id;
});
afterEach(async () => {
  await app.close();
});
afterAll(() => pool.end());

test("reference arrays and insight associations use sort order then slug, excluding General", async () => {
  await db.insert(cities).values({
    slug: "aaa",
    name: "First",
    country: "Country",
    timezone: "UTC",
    sortOrder: 1,
  });
  await db
    .insert(categories)
    .values({ slug: "aaa", name: "First", icon: "book", sortOrder: 1 });
  const cityResponse = await request("GET", "/api/cities");
  const categoryResponse = await request("GET", "/api/categories");
  status(cityResponse);
  status(categoryResponse);
  const cityRows = cityResponse.json<{ slug: string }[]>();
  const categoryRows = categoryResponse.json<{ slug: string }[]>();
  expect(cityRows.map((row) => row.slug)).toEqual([
    "aaa",
    "san-francisco",
    "tokyo",
    "buenos-aires",
  ]);
  expect(categoryRows.slice(0, 2).map((row) => row.slug)).toEqual([
    "aaa",
    "food",
  ]);
  const created = await create({
    citySlugs: ["tokyo", "aaa", "san-francisco"],
    categorySlugs: ["food", "aaa"],
  });
  expect(created.cities).toEqual(cityRows.slice(0, 3));
  expect(created.categories).toEqual(categoryRows.slice(0, 2));
  expect(Object.keys(created.cities[0]!).sort()).toEqual([
    "country",
    "id",
    "name",
    "slug",
    "sortOrder",
    "timezone",
  ]);
  expect(Object.keys(created.categories[0]!).sort()).toEqual([
    "icon",
    "id",
    "name",
    "slug",
    "sortOrder",
  ]);
});

test("creates trimmed details, preserves internal body formatting and exposes exact fields", async () => {
  const row = await create({
    body: "  Hello\n\nworld  ",
    title: " Note ",
    sourceUrl: " https://example.com ",
    places: [{ googlePlaceId: " opaque-id " }],
  });
  expect(row).toMatchObject({
    body: "Hello\n\nworld",
    title: "Note",
    sourceUrl: "https://example.com",
    upvoteCount: 0,
    viewerHasUpvoted: false,
    isAuthor: true,
    places: [{ googlePlaceId: "opaque-id" }],
    author: {
      id: ownerId,
      displayName: "author",
      cohort: null,
      avatarUrl: null,
    },
  });
  const response = await request(
    "GET",
    `/api/insights/${row.id}`,
    undefined,
    otherCookie,
  );
  status(response);
  const raw = response.json<InsightDetail>();
  expect(Object.keys(raw).sort()).toEqual([
    "author",
    "body",
    "categories",
    "cities",
    "createdAt",
    "id",
    "isAuthor",
    "places",
    "sourceUrl",
    "title",
    "updatedAt",
    "upvoteCount",
    "viewerHasUpvoted",
  ]);
  expect(Object.keys(raw.author).sort()).toEqual([
    "avatarUrl",
    "cohort",
    "displayName",
    "id",
  ]);
  expect(raw.isAuthor).toBe(false);
  const defaults = await create({ citySlugs: [] });
  expect(defaults).toMatchObject({
    title: null,
    sourceUrl: null,
    places: [],
    cities: [],
  });
});

test("PATCH preserves omissions, clears optional fields, replaces associations and changes only edit timestamps", async () => {
  const row = await create({
    title: "Original",
    sourceUrl: "http://example.com",
    places: [{ googlePlaceId: "p1" }, { googlePlaceId: "p2" }],
  });
  const past = new Date("2020-01-01T00:00:00Z");
  await db
    .update(insights)
    .set({ updatedAt: past })
    .where(eq(insights.id, row.id));
  const changed = await request("PATCH", `/api/insights/${row.id}`, {
    body: "New body",
  });
  status(changed);
  const updated = insightDetailSchema.parse(changed.json());
  expect(updated).toMatchObject({
    title: row.title,
    sourceUrl: row.sourceUrl,
    places: row.places,
    cities: row.cities,
    categories: row.categories,
    createdAt: row.createdAt,
    body: "New body",
  });
  expect(Date.parse(updated.updatedAt)).toBeGreaterThan(past.getTime());
  status(
    await request("PATCH", `/api/insights/${row.id}`, {
      categorySlugs: ["travel", "living"],
      citySlugs: ["buenos-aires", "san-francisco"],
      places: [{ googlePlaceId: "p2" }, { googlePlaceId: "p1" }],
    }),
  );
  const replaced = await get(row.id);
  expect(replaced.categories.map((value) => value.slug)).toEqual([
    "living",
    "travel",
  ]);
  expect(replaced.cities.map((value) => value.slug)).toEqual([
    "san-francisco",
    "buenos-aires",
  ]);
  expect(replaced.places).toEqual([
    { googlePlaceId: "p2" },
    { googlePlaceId: "p1" },
  ]);
  status(
    await request("PATCH", `/api/insights/${row.id}`, {
      title: null,
      sourceUrl: null,
      citySlugs: [],
      places: [],
    }),
  );
  expect(await get(row.id)).toMatchObject({
    title: null,
    sourceUrl: null,
    cities: [],
    places: [],
    body: "New body",
  });
  expect(await db.select().from(places)).toHaveLength(2);
});

test("author-only hard deletion cascades joins and votes, retaining places", async () => {
  const row = await create({ places: [{ googlePlaceId: "retained" }] });
  await vote(row.id, true, otherCookie);
  status(
    await request(
      "PATCH",
      `/api/insights/${row.id}`,
      { body: "Not mine" },
      otherCookie,
    ),
    403,
  );
  status(
    await request("DELETE", `/api/insights/${row.id}`, undefined, otherCookie),
    403,
  );
  expect((await get(row.id)).body).toBe(base.body);
  const response = await request("DELETE", `/api/insights/${row.id}`);
  status(response, 204);
  expect(response.body).toBe("");
  for (const table of [
    insights,
    insightCategories,
    insightCities,
    insightPlaces,
    insightVotes,
  ])
    expect(await db.select().from(table)).toEqual([]);
  expect(await db.select().from(places)).toHaveLength(1);
  status(await request("DELETE", `/api/insights/${row.id}`), 404);
  status(await request("GET", `/api/insights/${row.id}`), 404);
});

test("rejects invalid writes and unknown slugs without changes", async () => {
  const row = await create();
  for (const invalid of [
    { body: " " },
    { body: null },
    { categorySlugs: [] },
    { categorySlugs: ["food", " food "] },
    { citySlugs: ["tokyo", " tokyo "] },
    { citySlugs: ["general"] },
    { citySlugs: ["unknown"] },
    { categorySlugs: ["unknown"] },
    { places: [{ googlePlaceId: "id", name: "Forbidden" }] },
    { places: [{ googlePlaceId: "id" }, { googlePlaceId: " id " }] },
    { authorId: ownerId },
    { sourceUrl: "ftp://example.com" },
  ]) {
    status(
      await request("POST", "/api/insights", { ...base, ...invalid }),
      400,
    );
    status(await request("PATCH", `/api/insights/${row.id}`, invalid), 400);
  }
  status(await request("POST", "/api/insights", {}), 400);
  status(await request("PATCH", `/api/insights/${row.id}`, {}), 400);
  expect(await get(row.id)).toEqual(row);
  expect(await db.select().from(insights)).toHaveLength(1);
  expect(await db.select().from(places)).toHaveLength(0);
});

test("all detail and vote methods validate UUIDs and missing resources", async () => {
  for (const [method, suffix, payload] of [
    ["GET", "", undefined],
    ["PATCH", "", { body: "edit" }],
    ["DELETE", "", undefined],
    ["PUT", "/vote", undefined],
    ["DELETE", "/vote", undefined],
  ] as const) {
    status(await request(method, `/api/insights/bad${suffix}`, payload), 400);
    status(
      await request(method, `/api/insights/${randomUUID()}${suffix}`, payload),
      404,
    );
  }
});

test("late database failures roll back creations and edits including new reusable places", async () => {
  const row = await create({ places: [{ googlePlaceId: "existing" }] });
  const beforePlaces = await db.select().from(places);
  await db.execute(
    sql`CREATE FUNCTION fail_insight_place() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private rollback probe'; END $$`,
  );
  await db.execute(
    sql`CREATE TRIGGER fail_insight_place BEFORE INSERT ON insight_places FOR EACH ROW EXECUTE FUNCTION fail_insight_place()`,
  );
  try {
    for (const [method, url] of [
      ["POST", "/api/insights"],
      ["PATCH", `/api/insights/${row.id}`],
    ] as const) {
      const response = await request(method, url, {
        ...base,
        body: "Changed",
        categorySlugs: ["travel"],
        citySlugs: [],
        places: [{ googlePlaceId: "new-rolled-back" }],
      });
      status(response, 500);
      expect(response.body).not.toContain("private rollback probe");
      expect(await get(row.id)).toEqual(row);
      expect(await db.select().from(insights)).toHaveLength(1);
      expect(await db.select().from(places)).toEqual(beforePlaces);
    }
  } finally {
    await db.execute(sql`DROP TRIGGER fail_insight_place ON insight_places`);
    await db.execute(sql`DROP FUNCTION fail_insight_place()`);
  }
});

test("simultaneous saves reuse place IDs in different requested orders", async () => {
  const [a, b] = await Promise.all([
    create({
      places: [{ googlePlaceId: "first" }, { googlePlaceId: "second" }],
    }),
    create(
      { places: [{ googlePlaceId: "second" }, { googlePlaceId: "first" }] },
      otherCookie,
    ),
  ]);
  expect(a.places).toEqual([...b.places].reverse());
  expect(await db.select().from(places)).toHaveLength(2);
  expect(await db.select().from(insightPlaces)).toHaveLength(4);
});

async function scopeFixtures() {
  const tokyo = await create({
    categorySlugs: ["food", "travel"],
    citySlugs: ["tokyo", "san-francisco"],
  });
  const general = await create({ citySlugs: [] });
  const sf = await create({ citySlugs: ["san-francisco"] });
  const travel = await create({ categorySlugs: ["travel"] });
  const other = await create({}, otherCookie);
  return { tokyo, general, sf, travel, other };
}

test("combines city, General, category, author and normalized search without duplicate results", async () => {
  const { tokyo, general, sf, travel, other } = await scopeFixtures();
  const check = async (query: string, expected: InsightDetail[]) => {
    const result = await feed(query);
    expect(result.total).toBe(expected.length);
    expect(result.items.map((item) => item.id).sort()).toEqual(
      expected.map((item) => item.id).sort(),
    );
  };
  await check("city=tokyo", [tokyo, travel, other]);
  await check("city=tokyo&q=%20%20", [tokyo, travel, other]);
  await check("city=tokyo&q=%20cafe%20", [tokyo, general, travel, other]);
  await check("city=general", [general]);
  await check("city=general&q=cafe", [general]);
  await check("author=me", [tokyo, general, sf, travel]);
  await check("author=me&city=tokyo&q=cafe&category=food", [tokyo, general]);
  await check("author=me&city=tokyo&category=food", [tokyo]);
  await check("city=san-francisco&category=travel", [tokyo]);
  await check("city=general&q=absent", []);
});

test("search folds accents, keeps endings distinct, supports websearch and does not search place IDs", async () => {
  const cafe = await create({
    body: "A café restaurant",
    places: [{ googlePlaceId: "secret-place" }],
  });
  const plural = await create({ body: "Cafés restaurants" });
  const ramen = await create({ body: "cheap ramen in Shibuya" });
  await create({ body: "cheap tacos in Palermo" });
  expect((await feed("city=tokyo&q=cafe")).items.map((row) => row.id)).toEqual([
    cafe.id,
  ]);
  expect((await feed("city=tokyo&q=cafés")).items.map((row) => row.id)).toEqual(
    [plural.id],
  );
  expect(
    (await feed("city=tokyo&q=restaurants")).items.map((row) => row.id),
  ).toEqual([plural.id]);
  expect(
    (
      await feed(`city=tokyo&q=${encodeURIComponent('"ramen in Shibuya"')}`)
    ).items.map((row) => row.id),
  ).toEqual([ramen.id]);
  expect(
    (
      await feed(`city=tokyo&q=${encodeURIComponent("cheap -tacos")}`)
    ).items.map((row) => row.id),
  ).toEqual([ramen.id]);
  expect((await feed("city=tokyo&q=secret-place")).total).toBe(0);
  status(
    await request("PATCH", `/api/insights/${cafe.id}`, {
      body: "Changed searchable content",
    }),
  );
  expect((await feed("city=tokyo&q=cafe")).total).toBe(0);
  expect((await feed("city=tokyo&q=searchable")).items[0]?.id).toBe(cafe.id);
});

test("default and explicit sorts use rank or votes with stable creation-time and UUID ties", async () => {
  const title = await create({ title: "Ramen", body: "Note" });
  const body = await create({ body: "Ramen" });
  const newest = await create({ body: "Ramen" });
  await db
    .update(insights)
    .set({ createdAt: new Date("2020-01-01") })
    .where(eq(insights.id, title.id));
  await db
    .update(insights)
    .set({ createdAt: new Date("2021-01-01") })
    .where(eq(insights.id, body.id));
  await db
    .update(insights)
    .set({ createdAt: new Date("2022-01-01") })
    .where(eq(insights.id, newest.id));
  expect((await feed("city=tokyo&q=ramen")).items.map((row) => row.id)).toEqual(
    [title.id, newest.id, body.id],
  );
  expect((await feed("city=tokyo&q=ramen&sort=relevance")).items[0]?.id).toBe(
    title.id,
  );
  expect((await feed("city=tokyo")).items.map((row) => row.id)).toEqual([
    newest.id,
    body.id,
    title.id,
  ]);
  expect((await feed("city=tokyo&q=ramen&sort=newest")).items[0]?.id).toBe(
    newest.id,
  );
  await vote(body.id, true);
  expect(
    (await feed("city=tokyo&sort=top")).items.map((row) => row.id),
  ).toEqual([body.id, newest.id, title.id]);
  await db
    .update(insights)
    .set({ title: null, body: "Ramen", createdAt: new Date("2020-01-01") });
  await vote(body.id, false);
  const tied = [title.id, body.id, newest.id].sort().reverse();
  for (const sort of ["newest", "top", "relevance"])
    expect(
      (await feed(`city=tokyo&q=ramen&sort=${sort}`)).items.map(
        (row) => row.id,
      ),
    ).toEqual(tied);
});

test("pagination preserves distinct totals, supports empty pages, and exposes only feed fields", async () => {
  const body = "😀".repeat(279) + "界" + "tail";
  const row = await create({
    body,
    categorySlugs: ["food", "travel"],
    citySlugs: ["tokyo", "san-francisco"],
    places: [{ googlePlaceId: "p1" }, { googlePlaceId: "p2" }],
  });
  await create();
  await create();
  await vote(row.id, true);
  const all = await feed("city=tokyo");
  expect(all).toMatchObject({ total: 3, page: 1, limit: 20 });
  const ids: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const result = await feed(`city=tokyo&limit=1&page=${page}`);
    expect(result.total).toBe(3);
    ids.push(result.items[0]!.id);
  }
  expect(ids).toEqual(all.items.map((item) => item.id));
  expect(new Set(ids).size).toBe(3);
  expect(await feed("city=tokyo&limit=1&page=4")).toEqual({
    items: [],
    page: 4,
    limit: 1,
    total: 3,
  });
  expect(
    (await feed("city=tokyo&page=9007199254740991&limit=50")).items,
  ).toEqual([]);
  const item = all.items.find((item) => item.id === row.id)!;
  expect(item.bodyPreview).toBe("😀".repeat(279) + "界");
  expect(item).toMatchObject({
    placeCount: 2,
    upvoteCount: 1,
    viewerHasUpvoted: true,
  });
  const response = await request("GET", "/api/insights?city=tokyo");
  expect(
    Object.keys(response.json<{ items: object[] }>().items[0]!).sort(),
  ).toEqual([
    "author",
    "bodyPreview",
    "categories",
    "cities",
    "createdAt",
    "id",
    "placeCount",
    "title",
    "updatedAt",
    "upvoteCount",
    "viewerHasUpvoted",
  ]);
  expect(
    (await feed("city=tokyo", otherCookie)).items.find(
      (item) => item.id === row.id,
    )?.viewerHasUpvoted,
  ).toBe(false);
  expect((await get(row.id, otherCookie)).viewerHasUpvoted).toBe(false);
  expect((await feed("city=general")).total).toBe(0);
});

test("feed rejects unknown scopes, invalid enums, pagination, duplicate params and missing scope", async () => {
  for (const query of [
    "",
    "city=unknown",
    "city=tokyo&category=unknown",
    "city=tokyo&sort=relevance",
    "city=tokyo&sort=relevance&q=%20",
    "city=tokyo&sort=bad",
    "city=tokyo&author=other",
    "city=tokyo&extra=1",
    "city=tokyo&page=0",
    "city=tokyo&page=1.5",
    "city=tokyo&limit=51",
    "city=tokyo&limit=0",
    "city=tokyo&city=general",
    "city=tokyo&page=1&page=2",
  ])
    status(await request("GET", `/api/insights?${query}`), 400);
});

test("votes are idempotent, permit self-votes, and leave updatedAt unchanged", async () => {
  const row = await create();
  expect(await vote(row.id, false)).toEqual({
    upvoteCount: 0,
    viewerHasUpvoted: false,
  });
  for (let i = 0; i < 3; i++)
    expect(await vote(row.id, true)).toEqual({
      upvoteCount: 1,
      viewerHasUpvoted: true,
    });
  expect(await vote(row.id, true, otherCookie)).toEqual({
    upvoteCount: 2,
    viewerHasUpvoted: true,
  });
  for (let i = 0; i < 3; i++)
    expect(await vote(row.id, false)).toEqual({
      upvoteCount: 1,
      viewerHasUpvoted: false,
    });
  expect((await get(row.id)).updatedAt).toBe(row.updatedAt);
  expect((await get(row.id, otherCookie)).viewerHasUpvoted).toBe(true);
});

test("concurrent same-user, different-user and mixed votes preserve counts", async () => {
  const row = await create();
  const additions = await Promise.all(
    Array.from({ length: 12 }, () => vote(row.id, true)),
  );
  expect(
    additions.every(
      (value) => value.upvoteCount === 1 && value.viewerHasUpvoted,
    ),
  ).toBe(true);
  await vote(row.id, false);
  await Promise.all([vote(row.id, true), vote(row.id, true, otherCookie)]);
  expect((await get(row.id)).upvoteCount).toBe(2);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      vote(row.id, i % 3 === 0, i % 2 === 0 ? ownerCookie : otherCookie),
    ),
  );
  const [stored] = await db
    .select({ value: count() })
    .from(insightVotes)
    .where(eq(insightVotes.insightId, row.id));
  const final = await get(row.id);
  expect(final.upvoteCount).toBe(stored!.value);
  expect(final.upvoteCount).toBeGreaterThanOrEqual(0);
  const own = await db
    .select()
    .from(insightVotes)
    .where(
      and(eq(insightVotes.insightId, row.id), eq(insightVotes.userId, ownerId)),
    );
  expect(final.viewerHasUpvoted).toBe(own.length === 1);
  expect(final.updatedAt).toBe(row.updatedAt);
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      vote(row.id, false, i % 2 === 0 ? ownerCookie : otherCookie),
    ),
  );
  expect((await get(row.id)).upvoteCount).toBe(0);
});

test("a failed vote counter write rolls back the vote row", async () => {
  const row = await create();
  await db.execute(
    sql`CREATE FUNCTION fail_vote_count() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private vote probe'; END $$`,
  );
  await db.execute(
    sql`CREATE TRIGGER fail_vote_count BEFORE UPDATE OF upvote_count ON insights FOR EACH ROW EXECUTE FUNCTION fail_vote_count()`,
  );
  try {
    status(await request("PUT", `/api/insights/${row.id}/vote`), 500);
    expect(await db.select().from(insightVotes)).toEqual([]);
    expect(await get(row.id)).toEqual(row);
  } finally {
    await db.execute(sql`DROP TRIGGER fail_vote_count ON insights`);
    await db.execute(sql`DROP FUNCTION fail_vote_count()`);
  }
});

test("every endpoint requires a session and mutations enforce Origin before authentication", async () => {
  const row = await create();
  const endpoints: [InjectOptions["method"], string, object?][] = [
    ["GET", "/api/cities"],
    ["GET", "/api/categories"],
    ["GET", "/api/insights?city=tokyo"],
    ["POST", "/api/insights", base],
    ["GET", `/api/insights/${row.id}`],
    ["PATCH", `/api/insights/${row.id}`, { body: "edit" }],
    ["DELETE", `/api/insights/${row.id}`],
    ["PUT", `/api/insights/${row.id}/vote`],
    ["DELETE", `/api/insights/${row.id}/vote`],
  ];
  for (const [method, url, payload] of endpoints) {
    for (const cookie of ["", "better-auth.session_token=invalid"])
      status(await request(method, url, payload, cookie), 401);
    if (method !== "GET") {
      for (const origin of [
        undefined,
        "null",
        "http://evil.example",
        `${config.WEB_ORIGIN}/`,
      ]) {
        for (const cookie of [ownerCookie, ""]) {
          const response = await app.inject({
            method,
            url,
            headers: { cookie, ...(origin === undefined ? {} : { origin }) },
            ...(payload === undefined ? {} : { payload }),
          });
          status(response, 403);
        }
      }
    }
  }
  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/api/insights",
    headers: {
      origin: config.WEB_ORIGIN,
      "access-control-request-method": "POST",
    },
  });
  status(preflight, 204);
});
