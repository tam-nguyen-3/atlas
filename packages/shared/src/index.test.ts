import { expect, test } from "vitest";
import { APP_NAME } from "./index.js";

test("exports the app name", () => {
  expect(APP_NAME).toBe("Minerva Atlas");
});
