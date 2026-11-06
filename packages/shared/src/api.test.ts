import { expect, test } from "vitest";
import { updateProfileSchema } from "./api.js";

test("profile parsing trims names and permits clearing the cohort", () => {
  expect(
    updateProfileSchema.parse({ displayName: " Ada ", cohort: null }),
  ).toEqual({ displayName: "Ada", cohort: null });
});
test.each([
  {},
  { cohort: "M2027" },
  { cohort: "m27" },
  { cohort: "M٢٧" },
  { displayName: " " },
  { email: "ada@minerva.edu" },
])("rejects invalid profile patch %j", (input) => {
  expect(updateProfileSchema.safeParse(input).success).toBe(false);
});
