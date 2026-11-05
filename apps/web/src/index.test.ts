import { expect, test } from "vitest";
import { PAGE_TITLE } from "./index.js";

test("resolves the shared workspace package", () => {
  expect(PAGE_TITLE).toBe("Minerva Atlas");
});
