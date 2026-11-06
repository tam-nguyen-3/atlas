import pg from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";
import { SERVICE_NAME } from "./index.js";
import { testDatabaseUrl } from "./test/database.js";

const client = new pg.Client({ connectionString: testDatabaseUrl });

beforeAll(async () => {
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

test("connects to the test database, not the dev database", async () => {
  const result = await client.query<{ database: string }>(
    "SELECT current_database() AS database",
  );

  expect(result.rows[0]?.database).toBe("atlas_test");
});

test("resolves the shared workspace package", () => {
  expect(SERVICE_NAME).toBe("Minerva Atlas API");
});
