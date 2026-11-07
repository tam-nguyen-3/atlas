import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import {
  categoriesSchema,
  citiesSchema,
  insightDetailSchema,
  insightFeedSchema,
  profileSchema,
  voteSchema,
} from "@atlas/shared";
import { inArray } from "drizzle-orm";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrate.js";
import { insights, insightVotes, places, users } from "../db/schema.js";
import { seedReferenceData } from "../db/seed.js";
import { assertTestDatabase } from "../db/seed-test-user.js";
import { createTestDb, testDatabaseUrl } from "./database.js";

// Real HTTP against an isolated local listener; never use DATABASE_URL.
const { db, pool } = createTestDb();
const origin = "http://localhost:5173";
const app = createApp({
  db,
  config: {
    NODE_ENV: "test",
    PORT: 3000,
    DATABASE_URL: testDatabaseUrl,
    WEB_ORIGIN: origin,
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  },
});
const runId = randomUUID();
const emails = [
  `smoke-author-${runId}@minerva.edu`,
  `smoke-reader-${runId}@uni.minerva.edu`,
];
let safeToClean = false;
try {
  await assertTestDatabase(db);
  safeToClean = true;
  await runMigrations(db);
  await seedReferenceData(db);
  const baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
  async function call(
    method: string,
    path: string,
    cookie = "",
    body?: object,
    expected = 200,
    retries = 0,
  ) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        origin,
        cookie,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    // Other local test runs may have used the shared auth rate-limit window.
    if (
      response.status === 429 &&
      path === "/auth/sign-up/email" &&
      retries < 2
    ) {
      const wait = Number(response.headers.get("x-retry-after") ?? "10");
      await response.body?.cancel();
      await setTimeout(Math.min(Math.max(wait, 1), 10) * 1000 + 100);
      return call(method, path, cookie, body, expected, retries + 1);
    }
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${await response.clone().text()}`,
    );
    return response;
  }
  async function signup(email: string, name: string) {
    const response = await call("POST", "/auth/sign-up/email", "", {
      email,
      name,
      password: randomBytes(20).toString("hex"),
    });
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  await call("GET", "/health");
  const author = await signup(emails[0]!, "Smoke Author");
  const reader = await signup(emails[1]!, "Smoke Reader");
  profileSchema.parse(await (await call("GET", "/me", author)).json());
  assert.equal(
    citiesSchema
      .parse(await (await call("GET", "/cities", author)).json())
      .some((city) => city.slug === "tokyo"),
    true,
  );
  assert.equal(
    categoriesSchema
      .parse(await (await call("GET", "/categories", reader)).json())
      .some((category) => category.slug === "food"),
    true,
  );
  const created = insightDetailSchema.parse(
    await (
      await call(
        "POST",
        "/insights",
        author,
        {
          title: `Smoke ${runId}`,
          body: `A café recommendation ${runId}`,
          categorySlugs: ["food"],
          citySlugs: ["tokyo"],
          places: [{ googlePlaceId: `smoke-${runId}` }],
        },
        201,
      )
    ).json(),
  );
  const browse = insightFeedSchema.parse(
    await (await call("GET", "/insights?author=me&city=tokyo", author)).json(),
  );
  assert.equal(browse.total, 1);
  assert.equal(browse.items[0]?.id, created.id);
  const search = insightFeedSchema.parse(
    await (
      await call("GET", "/insights?author=me&city=tokyo&q=cafe", author)
    ).json(),
  );
  assert.equal(search.items[0]?.id, created.id);
  const path = `/insights/${created.id}`;
  assert.equal(
    insightDetailSchema.parse(await (await call("GET", path, reader)).json())
      .isAuthor,
    false,
  );
  const edited = insightDetailSchema.parse(
    await (
      await call("PATCH", path, author, { title: null, citySlugs: [] })
    ).json(),
  );
  assert.equal(edited.title, null);
  assert.deepEqual(edited.cities, []);
  assert.equal(
    insightFeedSchema.parse(
      await (
        await call("GET", "/insights?author=me&city=general", author)
      ).json(),
    ).total,
    1,
  );
  for (let i = 0; i < 2; i++)
    assert.deepEqual(
      voteSchema.parse(
        await (await call("PUT", `${path}/vote`, reader)).json(),
      ),
      { upvoteCount: 1, viewerHasUpvoted: true },
    );
  assert.deepEqual(
    voteSchema.parse(
      await (await call("DELETE", `${path}/vote`, reader)).json(),
    ),
    { upvoteCount: 0, viewerHasUpvoted: false },
  );
  await call("PATCH", path, reader, { body: "Forbidden edit" }, 403);
  await call("DELETE", path, reader, undefined, 403);
  await call("DELETE", path, author, undefined, 204);
  await call("GET", path, author, undefined, 404);
  console.log(
    "HTTP smoke passed: reference data, create, browse/search, details, edit, voting, ownership rejection, delete.",
  );
} finally {
  await app.close();
  try {
    if (safeToClean) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.email, emails));
      const ids = rows.map((row) => row.id);
      if (ids.length)
        await db.transaction(async (tx) => {
          await tx.delete(insights).where(inArray(insights.authorId, ids));
          await tx
            .delete(insightVotes)
            .where(inArray(insightVotes.userId, ids));
          await tx.delete(places).where(inArray(places.createdBy, ids));
          await tx.delete(users).where(inArray(users.id, ids));
        });
    }
  } finally {
    await pool.end();
  }
}
