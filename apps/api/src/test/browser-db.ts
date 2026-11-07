import { createTestDb } from "./database.js";
import { assertTestDatabase } from "../db/seed-test-user.js";
import { rateLimits, sessions } from "../db/schema.js";

// Test-process CLI only; there is no HTTP endpoint for these operations.
if (process.env.NODE_ENV !== "test")
  throw new Error("Browser database helper requires NODE_ENV=test");
const { db, pool } = createTestDb();
try {
  await assertTestDatabase(db);
  switch (process.argv[2]) {
    case "reset-limits":
      await db.delete(rateLimits);
      break;
    case "revoke-sessions":
      await db.delete(sessions);
      break;
    default:
      throw new Error("Unknown browser database operation");
  }
} finally {
  await pool.end();
}
