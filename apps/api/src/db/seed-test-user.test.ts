import { verifyPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  createTestDb,
  testDatabaseUrl,
  truncateAll,
} from "../test/database.js";
import { createDb } from "./client.js";
import { accounts, users } from "./schema.js";
import { seedTestUser } from "./seed-test-user.js";

const credentials = {
  email: "test-user@minerva.edu",
  password: "a-test-password",
};

const { db, pool } = createTestDb();

beforeEach(() => truncateAll(db));
afterEach(() => vi.unstubAllEnvs());
afterAll(() => pool.end());

test("creates a user with a credential account", async () => {
  await seedTestUser(db, credentials);

  const [user] = await db.select().from(users);
  const [account] = await db.select().from(accounts);

  expect(user?.email).toBe(credentials.email);
  expect(account?.providerId).toBe("credential");
  expect(account?.accountId).toBe(user?.id);
  expect(account?.password).not.toBe(credentials.password);
  expect(
    await verifyPassword({
      hash: account!.password!,
      password: credentials.password,
    }),
  ).toBe(true);
});

test("re-running keeps one user and one account, with the latest password", async () => {
  await seedTestUser(db, credentials);
  await seedTestUser(db, { ...credentials, password: "another-password" });

  const [account] = await db.select().from(accounts);

  expect(await db.select().from(users)).toHaveLength(1);
  expect(await db.select().from(accounts)).toHaveLength(1);
  expect(
    await verifyPassword({
      hash: account!.password!,
      password: "another-password",
    }),
  ).toBe(true);
});

test.each(["development", "production"])("refuses NODE_ENV=%s", async (env) => {
  vi.stubEnv("NODE_ENV", env);

  await expect(seedTestUser(db, credentials)).rejects.toThrow("NODE_ENV=test");
  expect(await db.select().from(users)).toHaveLength(0);
});

test("refuses a database that isn't a test database", async () => {
  // The maintenance database exists locally and in CI, and is safe to connect to.
  const url = new URL(testDatabaseUrl);
  url.pathname = "/postgres";
  const other = createDb(url.href);

  try {
    await expect(seedTestUser(other.db, credentials)).rejects.toThrow(
      "expected atlas_test",
    );
  } finally {
    await other.pool.end();
  }
});
