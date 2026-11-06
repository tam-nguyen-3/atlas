import { expect, test } from "vitest";
import { readConfig } from "./config.js";

const valid = {
  DATABASE_URL: "postgres://atlas:atlas@localhost/atlas_dev",
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:5173",
  BETTER_AUTH_SECRET: "a-long-random-secret-for-test-only-123",
};

test("configuration defaults the environment and port", () => {
  expect(readConfig(valid)).toMatchObject({
    NODE_ENV: "development",
    PORT: 3000,
  });
});
test.each([
  { BETTER_AUTH_SECRET: undefined },
  { BETTER_AUTH_SECRET: "short" },
  { BETTER_AUTH_SECRET: "replace-me-with-a-very-long-secret-123" },
  { PORT: "0" },
  { PORT: "65536" },
  { PORT: "abc" },
  { DATABASE_URL: "https://example.com" },
  { WEB_ORIGIN: "https://example.com/path" },
  { BETTER_AUTH_URL: "https://user:password@example.com" },
  { NODE_ENV: "production" },
])(
  "rejects invalid runtime configuration without leaking its values",
  (overrides) => {
    expect(() => readConfig({ ...valid, ...overrides })).toThrow();
    try {
      readConfig({ ...valid, ...overrides });
    } catch (error) {
      expect(String(error)).not.toContain(valid.BETTER_AUTH_SECRET);
      expect(String(error)).not.toContain(valid.DATABASE_URL);
    }
  },
);
