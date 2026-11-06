import { defineConfig } from "drizzle-kit";

// Only used to generate migrations, so it needs no database URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
