import { eq, sql } from "drizzle-orm";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, afterEach, beforeEach, expect, test } from "vitest";
import { createApp } from "./app.js";
import type { Config } from "./config.js";
import { accounts, rateLimits, sessions, users } from "./db/schema.js";
import { seedTestUser } from "./db/seed-test-user.js";
import { createTestDb, testDatabaseUrl, truncateAll } from "./test/database.js";

const { db, pool } = createTestDb();
const config: Config = {
  NODE_ENV: "test",
  PORT: 3000,
  DATABASE_URL: testDatabaseUrl,
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
  WEB_ORIGIN: "http://localhost:5173",
};
const credentials = { email: "ada@minerva.edu", password: "a-test-password" };
const origin = { origin: config.WEB_ORIGIN };
const apps: FastifyInstance[] = [];
let app: FastifyInstance;

function makeApp(overrides: Partial<Config> = {}) {
  const instance = createApp({
    db,
    config: { ...config, ...overrides },
    registerContentRoutes: (routes) => {
      routes.get("/protected-probe", () => ({ ok: true }));
      routes.get("/failure", () => {
        throw new Error("private database details");
      });
    },
  });
  apps.push(instance);
  return instance;
}
function cookie(response: LightMyRequestResponse) {
  const headers = response.headers["set-cookie"];
  expect(headers).toBeDefined();
  return (Array.isArray(headers) ? headers : [headers!])
    .map((value) => value.split(";")[0])
    .join("; ");
}
function signUp(body: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: origin,
    payload: { name: " Ada ", ...credentials, ...body },
  });
}
async function sessionCookie() {
  const result = await signUp();
  expect(result.statusCode, result.body).toBe(200);
  return cookie(result);
}
beforeEach(async () => {
  await truncateAll(db);
  app = makeApp();
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});
afterAll(() => pool.end());

test("health is public and responses use Atlas errors and no-store", async () => {
  const health = await app.inject("/api/health");
  expect(health.json()).toEqual({ status: "ok" });
  for (const url of ["/api/health", "/api/me", "/api/missing"]) {
    const result = await app.inject(url);
    expect(result.headers["cache-control"]).toBe("no-store");
    if (url !== "/api/health")
      expect(result.json()).toMatchObject({
        error: {
          code: expect.any(String) as unknown,
          message: expect.any(String) as unknown,
        },
      });
  }
  expect((await app.inject("/api/missing")).statusCode).toBe(404);
});

test.each(["Ada@Minerva.edu", "Ada@UNI.MINERVA.EDU"])(
  "signs up %s with mapped fields and a persisted session",
  async (email) => {
    const result = await signUp({ email });
    expect(result.statusCode, result.body).toBe(200);
    const current = await app.inject({
      url: "/api/me",
      headers: { cookie: cookie(result) },
    });
    expect(current.json()).toEqual({
      id: expect.any(String) as unknown,
      email: email.toLowerCase(),
      displayName: "Ada",
      cohort: null,
      avatarUrl: null,
    });
    expect(await db.select().from(accounts)).toHaveLength(1);
    expect(await db.select().from(sessions)).toHaveLength(1);
    expect((await db.select().from(users))[0]?.emailVerified).toBe(false);
  },
);

test.each([
  "ada@gmail.com",
  "ada@minerva.edu.evil.com",
  "ada@sub.minerva.edu",
  "ada@notminerva.edu",
  "ada@uni.minerva.edu.evil.com",
])("rejects %s without creating any auth rows", async (email) => {
  const result = await signUp({ email });
  expect(result.statusCode, result.body).toBe(403);
  expect(result.json()).toMatchObject({ code: "EMAIL_DOMAIN_NOT_ALLOWED" });
  expect(await db.select().from(users)).toHaveLength(0);
  expect(await db.select().from(accounts)).toHaveLength(0);
  expect(await db.select().from(sessions)).toHaveLength(0);
});

test.each([
  { name: "   " },
  { name: "a".repeat(101) },
  { password: "short" },
  { password: "a".repeat(129) },
  { email: "bad-address" },
  { image: "https://example.com/avatar.png" },
  { avatarUrl: "https://example.com/avatar.png" },
  { cohort: "M27" },
])("rejects invalid sign-up input %j atomically", async (body) => {
  const result = await signUp(body);
  expect(result.statusCode).toBeGreaterThanOrEqual(400);
  expect(result.statusCode).toBeLessThan(500);
  expect(await db.select().from(users)).toHaveLength(0);
  expect(await db.select().from(accounts)).toHaveLength(0);
  expect(await db.select().from(sessions)).toHaveLength(0);
});

test("duplicate emails remain case-insensitive", async () => {
  await sessionCookie();
  expect((await signUp({ email: "ADA@MINERVA.EDU" })).statusCode).toBe(422);
  expect(await db.select().from(users)).toHaveLength(1);
});

test("the auth bridge preserves multiple independent Set-Cookie headers", async () => {
  const result = await signUp({ rememberMe: false });
  expect(result.statusCode, result.body).toBe(200);
  const cookies = result.headers["set-cookie"];
  expect(Array.isArray(cookies)).toBe(true);
  expect(cookies!.length).toBeGreaterThanOrEqual(2);
  expect(
    (await app.inject({ url: "/api/me", headers: { cookie: cookie(result) } }))
      .statusCode,
  ).toBe(200);
});

test("seeded credentials work through HTTP and native auth errors are preserved", async () => {
  await seedTestUser(db, credentials);
  const invalid = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: origin,
    payload: { ...credentials, password: "wrong-password" },
  });
  expect(invalid.statusCode).toBe(401);
  expect(invalid.json()).toMatchObject({
    code: "INVALID_EMAIL_OR_PASSWORD",
    message: expect.any(String) as unknown,
  });
  const valid = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: origin,
    payload: { ...credentials, email: "ADA@MINERVA.EDU" },
  });
  expect(valid.statusCode, valid.body).toBe(200);
  expect(
    (await app.inject({ url: "/api/me", headers: { cookie: cookie(valid) } }))
      .statusCode,
  ).toBe(200);
});

test("sessions survive application recreation and sign-out revokes them", async () => {
  const token = await sessionCookie();
  await app.close();
  const next = makeApp();
  const headers = { ...origin, cookie: token };
  expect((await next.inject({ url: "/api/me", headers })).statusCode).toBe(200);
  expect(
    (await next.inject({ url: "/api/auth/get-session", headers })).json(),
  ).toMatchObject({ user: { email: credentials.email } });
  const out = await next.inject({
    method: "POST",
    url: "/api/auth/sign-out",
    headers,
  });
  expect(out.statusCode).toBe(200);
  expect(out.headers["set-cookie"]).toBeDefined();
  expect(await db.select().from(sessions)).toHaveLength(0);
  expect((await next.inject({ url: "/api/me", headers })).statusCode).toBe(401);
});

test("all content routes reject missing, tampered, and expired sessions", async () => {
  expect((await app.inject("/api/protected-probe")).statusCode).toBe(401);
  const token = await sessionCookie();
  expect(
    (
      await app.inject({
        url: "/api/me",
        headers: { cookie: token.replace("=", "=tampered") },
      })
    ).statusCode,
  ).toBe(401);
  await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
  expect(
    (await app.inject({ url: "/api/me", headers: { cookie: token } }))
      .statusCode,
  ).toBe(401);
});

test("session renewal updates Postgres and forwards renewed cookies", async () => {
  const token = await sessionCookie();
  const expiresAt = new Date(Date.now() + 5 * 86400_000);
  await db
    .update(sessions)
    .set({ expiresAt, updatedAt: new Date(Date.now() - 2 * 86400_000) });
  const result = await app.inject({
    url: "/api/me",
    headers: { cookie: token },
  });
  expect(result.statusCode).toBe(200);
  expect(result.headers["set-cookie"]).toBeDefined();
  expect(
    (await db.select().from(sessions))[0]!.expiresAt.getTime(),
  ).toBeGreaterThan(expiresAt.getTime());
});

test("profile changes persist immediately and update only the signed-in user", async () => {
  const token = await sessionCookie();
  await db
    .insert(users)
    .values({ email: "other@minerva.edu", displayName: "Other" });
  await db
    .update(users)
    .set({ updatedAt: new Date(0) })
    .where(eq(users.email, credentials.email));
  const updated = await app.inject({
    method: "PATCH",
    url: "/api/me",
    headers: { ...origin, cookie: token },
    payload: { displayName: " Grace ", cohort: "M27" },
  });
  expect(updated.statusCode, updated.body).toBe(200);
  expect(updated.json()).toMatchObject({ displayName: "Grace", cohort: "M27" });
  expect(
    (await app.inject({ url: "/api/me", headers: { cookie: token } })).json(),
  ).toEqual(updated.json());
  expect(
    (
      await app.inject({
        url: "/api/auth/get-session",
        headers: { cookie: token },
      })
    ).json(),
  ).toMatchObject({ user: { name: "Grace", cohort: "M27" } });
  const cleared = await app.inject({
    method: "PATCH",
    url: "/api/me",
    headers: { ...origin, cookie: token },
    payload: { cohort: null },
  });
  expect(cleared.json()).toMatchObject({ displayName: "Grace", cohort: null });
  const rows = await db.select().from(users);
  expect(
    rows.find((user) => user.email === credentials.email)!.updatedAt.getTime(),
  ).toBeGreaterThan(0);
  expect(
    rows.find((user) => user.email === "other@minerva.edu")!.displayName,
  ).toBe("Other");
});

test("profile validation rejects empty, unknown, and invalid fields", async () => {
  const token = await sessionCookie();
  for (const payload of [
    {},
    { displayName: " " },
    { displayName: "a".repeat(101) },
    { displayName: null },
    { cohort: "m27" },
    { cohort: "M2027" },
    { cohort: "" },
    { email: "new@minerva.edu" },
    { avatarUrl: null },
    { displayName: "Valid", extra: true },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: { ...origin, cookie: token },
      payload,
    });
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  }
  expect((await db.select().from(users))[0]?.displayName).toBe("Ada");
});

test("writes require an exact Origin, even before sign-in", async () => {
  const token = await sessionCookie();
  for (const supplied of [
    undefined,
    "null",
    "https://evil.com",
    "http://localhost:5173.evil.com",
    "http://localhost:5173/",
  ]) {
    for (const url of [
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/sign-out",
      "/api/me",
    ]) {
      const response = await app.inject({
        method: url === "/api/me" ? "PATCH" : "POST",
        url,
        headers: {
          cookie: token,
          ...(supplied === undefined ? {} : { origin: supplied }),
        },
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  }
  expect(await db.select().from(sessions)).toHaveLength(1);
});

test("credentialed CORS supports unauthenticated preflights for the configured origin", async () => {
  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/me",
    headers: {
      ...origin,
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "content-type",
    },
  });
  expect(response.statusCode).toBe(204);
  expect(response.headers["access-control-allow-origin"]).toBe(
    config.WEB_ORIGIN,
  );
  expect(response.headers["access-control-allow-credentials"]).toBe("true");
  expect(response.headers["cache-control"]).toBe("no-store");
  const denied = await app.inject({
    url: "/api/health",
    headers: { origin: "https://evil.com" },
  });
  expect(denied.headers["access-control-allow-origin"]).not.toBe(
    "https://evil.com",
  );
});

test("other Better Auth routes cannot bypass profile policy", async () => {
  const token = await sessionCookie();
  for (const path of [
    "update-user",
    "change-email",
    "change-password",
    "delete-user",
    "request-password-reset",
    "send-verification-email",
    "sign-in/social",
  ]) {
    const result = await app.inject({
      method: "POST",
      url: `/api/auth/${path}`,
      headers: { ...origin, cookie: token },
      payload: {
        name: "Bypass",
        image: "https://example.com/image.png",
        newEmail: "new@gmail.com",
      },
    });
    expect(result.statusCode).toBe(404);
  }
  expect((await db.select().from(users))[0]?.displayName).toBe("Ada");
});

test.each(["sign-up/email", "sign-in/email"])(
  "rate limits %s per client and path, persists across apps, and recovers",
  async (path) => {
    const next = makeApp();
    const request = (
      server: FastifyInstance,
      remoteAddress = "192.0.2.1",
      spoof = "192.0.2.99",
    ) =>
      server.inject({
        method: "POST",
        url: `/api/auth/${path}`,
        remoteAddress,
        headers: {
          ...origin,
          "x-atlas-client-ip": spoof,
          "x-forwarded-for": spoof,
        },
        payload: {},
      });
    for (let i = 0; i < 3; i++)
      expect((await request(app)).statusCode).not.toBe(429);
    const limited = await request(next, "192.0.2.1", "192.0.2.100");
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["x-retry-after"]).toBeDefined();
    expect(limited.headers["cache-control"]).toBe("no-store");
    expect((await request(next, "192.0.2.2")).statusCode).not.toBe(429);
    const otherPath =
      path === "sign-up/email" ? "sign-in/email" : "sign-up/email";
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/auth/${otherPath}`,
          remoteAddress: "192.0.2.1",
          headers: origin,
          payload: {},
        })
      ).statusCode,
    ).not.toBe(429);
    await db.update(rateLimits).set({ lastRequest: Date.now() - 11_000 });
    expect((await request(app)).statusCode).not.toBe(429);
  },
);

test("concurrent auth attempts cannot exceed the shared database limit", async () => {
  const next = makeApp();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? app : next).inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: origin,
        payload: {},
      }),
    ),
  );
  expect(
    results.filter((response) => response.statusCode === 429),
  ).toHaveLength(5);
  expect(
    results.filter((response) => response.statusCode === 400),
  ).toHaveLength(3);
});

test("unexpected errors are hidden and malformed JSON uses the shared shape", async () => {
  const token = await sessionCookie();
  const failure = await app.inject({
    url: "/api/failure",
    headers: { cookie: token },
  });
  expect(failure.statusCode).toBe(500);
  expect(failure.json()).toEqual({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
  const malformed = await app.inject({
    method: "PATCH",
    url: "/api/me",
    headers: { ...origin, cookie: token, "content-type": "application/json" },
    payload: "{",
  });
  expect(malformed.statusCode).toBe(400);
  expect(malformed.json()).toMatchObject({
    error: { code: "INVALID_REQUEST" },
  });
});

test("production cookies are secure and host headers do not change auth URLs", async () => {
  const production = makeApp({
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://atlas.example",
    WEB_ORIGIN: "https://atlas.example",
  });
  const result = await production.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { origin: "https://atlas.example", host: "evil.example" },
    payload: { name: "Ada", ...credentials },
  });
  expect(result.statusCode, result.body).toBe(200);
  const cookies = result.headers["set-cookie"];
  expect(cookies).toBeDefined();
  for (const value of Array.isArray(cookies) ? cookies : [cookies!]) {
    expect(value).toContain("Secure");
    expect(value).toContain("HttpOnly");
    expect(value).toContain("SameSite=Lax");
    expect(value).not.toContain("evil.example");
  }
  // A real bigint timestamp must survive storage without truncation.
  const stored = await db.execute<{ last_request: string }>(
    sql`SELECT last_request FROM rate_limits`,
  );
  expect(Number(stored.rows[0]?.last_request)).toBeGreaterThan(
    1_000_000_000_000,
  );
});
