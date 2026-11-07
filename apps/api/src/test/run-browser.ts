import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import setup from "./global-setup.js";
import { createTestDb, testDatabaseUrl } from "./database.js";
import { seedReferenceData } from "../db/seed.js";
import { seedTestUser } from "../db/seed-test-user.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
// Generated per run, never written to .env or bundled by Vite.
const credentials = {
  email: `browser-${randomUUID()}@minerva.edu`,
  password: randomBytes(24).toString("hex"),
};
process.env.NODE_ENV = "test";
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  TEST_USER_EMAIL: credentials.email,
  TEST_USER_PASSWORD: credentials.password,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: "http://localhost:5174",
  WEB_ORIGIN: "http://localhost:5174",
  PORT: "3100",
  ATLAS_API_PROXY_TARGET: "http://localhost:3100",
};
let child: ReturnType<typeof spawn> | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    child?.kill(signal);
    process.exitCode = 1;
  });
for (const mode of ["development", "production"]) {
  if (process.exitCode) break;
  // Never overlaps the API suite. setup checks the actual DB name before DROP.
  await setup();
  const { db, pool } = createTestDb();
  try {
    await seedReferenceData(db);
    await seedTestUser(db, credentials);
  } finally {
    await pool.end();
  }
  console.log(`Running ${mode} browser checks against isolated atlas_test.`);
  const code = await new Promise<number>((resolve, reject) => {
    child = spawn("pnpm", ["--filter", "@atlas/web", "test:browser"], {
      cwd: root,
      env: { ...env, ATLAS_BROWSER_MODE: mode },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  child = undefined;
  if (code) {
    process.exitCode = code;
    break;
  }
}
