import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, test } from "vitest";
import { createTestDb, truncateAll } from "../test/database.js";
import * as schema from "./schema.js";
import { seedTestUser } from "./seed-test-user.js";

// Proves the schema fits Better Auth. Phase 3 moves this mapping into the real
// auth config, which also adds the allowed-domain check.
const { db, pool } = createTestDb();

const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: "test-secret-with-at-least-32-characters",
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  emailAndPassword: { enabled: true },
  user: {
    fields: { name: "displayName", image: "avatarUrl" },
    additionalFields: {
      cohort: { type: "string", required: false, input: false },
    },
  },
  advanced: { database: { generateId: "uuid" } },
});

const credentials = {
  email: "test-user@minerva.edu",
  password: "a-test-password",
};

beforeEach(() => truncateAll(db));
afterAll(() => pool.end());

test("signs in the seeded test user", async () => {
  await seedTestUser(db, credentials);

  const result = await auth.api.signInEmail({ body: credentials });

  expect(result.user.email).toBe(credentials.email);
  expect(result.user.name).toBe("Test User");
  expect(result.token).toBeTruthy();
});

test("finds the seeded user whatever the email's case", async () => {
  await seedTestUser(db, credentials);

  const result = await auth.api.signInEmail({
    body: { ...credentials, email: "Test-User@Minerva.edu" },
  });

  expect(result.user.email).toBe(credentials.email);
});

test("rejects a wrong password", async () => {
  await seedTestUser(db, credentials);

  await expect(
    auth.api.signInEmail({
      body: { ...credentials, password: "wrong-password" },
    }),
  ).rejects.toThrow();
});

test("signs up a new user into the mapped columns, with a session", async () => {
  const result = await auth.api.signUpEmail({
    body: {
      name: "Ada",
      email: "Ada@Minerva.edu",
      password: "a-test-password",
    },
  });

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "ada@minerva.edu"));
  const sessions = await db.select().from(schema.sessions);
  const [account] = await db.select().from(schema.accounts);

  expect(result.user.id).toBe(user?.id);
  expect(user?.displayName).toBe("Ada");
  expect(user?.emailVerified).toBe(false);
  expect(user?.cohort).toBeNull();
  expect(user?.avatarUrl).toBeNull();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.userId).toBe(user?.id);
  expect(account?.providerId).toBe("credential");
});

test("rejects a second sign-up with the same email in another case", async () => {
  const body = { name: "Ada", password: "a-test-password" };
  await auth.api.signUpEmail({ body: { ...body, email: "ada@minerva.edu" } });

  await expect(
    auth.api.signUpEmail({ body: { ...body, email: "ADA@minerva.edu" } }),
  ).rejects.toThrow();
  expect(await db.select().from(schema.users)).toHaveLength(1);
});

test("deleting a user removes their sessions and accounts", async () => {
  const { user } = await auth.api.signUpEmail({
    body: {
      name: "Ada",
      email: "ada@minerva.edu",
      password: "a-test-password",
    },
  });

  await db.delete(schema.users).where(eq(schema.users.id, user.id));

  expect(await db.select().from(schema.sessions)).toHaveLength(0);
  expect(await db.select().from(schema.accounts)).toHaveLength(0);
});
