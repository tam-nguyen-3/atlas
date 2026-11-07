import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { createDb } from "../db/client.js";
import { assertTestDatabase } from "../db/seed-test-user.js";

if (process.env.NODE_ENV !== "test")
  throw new Error("Browser API requires NODE_ENV=test");
const config = readConfig();
const { db, pool } = createDb(config.DATABASE_URL);
await assertTestDatabase(db);
const app = createApp({ db, config });
app.addHook("onClose", () => pool.end());
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
try {
  await app.listen({ port: config.PORT, host: "localhost" });
} catch (error) {
  await app.close();
  throw error;
}
