import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("apps/web/src", import.meta.url)),
      // Resolve to source so tests don't need a build first.
      "@atlas/shared": fileURLToPath(
        new URL("packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "shared",
          root: "packages/shared",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          root: "apps/api",
          include: ["src/**/*.test.ts"],
          globalSetup: ["src/test/global-setup.ts"],
          // Test files share one database.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          root: "apps/web",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
