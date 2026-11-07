import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

if (
  process.env.NODE_ENV !== "test" ||
  !process.env.TEST_USER_PASSWORD ||
  !process.env.ATLAS_BROWSER_MODE
)
  throw new Error(
    "Use pnpm test:web:browser to prepare the isolated test API and credentials.",
  );
const production = process.env.ATLAS_BROWSER_MODE === "production";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  outputDir: `test-results/${production ? "production" : "development"}`,
  use: {
    baseURL: "http://localhost:5174",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @atlas/api exec tsx src/test/browser-server.ts",
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      url: "http://localhost:3100/api/health",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
    {
      command: production
        ? "pnpm exec vite preview --host localhost --port 5174 --strictPort"
        : "pnpm exec vite --host localhost --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
  ],
});
