import { expect, test } from "vitest";
import {
  insightFormSchema,
  profileFormSchema,
} from "./contribution-validation";
const values = {
  title: "",
  body: " Advice\n\nSecond line ",
  sourceUrl: "",
  categorySlugs: ["food"],
  citySlugs: [],
};
test("contribution trims text, clears optionals, and treats no city as General", () => {
  expect(insightFormSchema.parse(values)).toEqual({
    ...values,
    body: "Advice\n\nSecond line",
    title: null,
    sourceUrl: null,
    places: [],
  });
});
test("contribution requires body and categories and rejects unsafe sources", () => {
  for (const patch of [
    { body: " " },
    { categorySlugs: [] },
    { categorySlugs: ["food", "food"] },
    { sourceUrl: "javascript:alert(1)" },
    { title: "x".repeat(121) },
    { body: "x".repeat(5001) },
  ])
    expect(insightFormSchema.safeParse({ ...values, ...patch }).success).toBe(
      false,
    );
});
test("contribution accepts multiple categories and cities and HTTP(S) sources", () => {
  expect(
    insightFormSchema.parse({
      ...values,
      categorySlugs: ["food", "travel"],
      citySlugs: ["tokyo", "san-francisco"],
      sourceUrl: " https://example.com ",
    }).sourceUrl,
  ).toBe("https://example.com");
});
test("profile trims display name and clears cohort without weakening server rules", () => {
  expect(
    profileFormSchema.parse({ displayName: " Ada ", cohort: " " }),
  ).toEqual({ displayName: "Ada", cohort: null });
  expect(
    profileFormSchema.parse({ displayName: "Ada", cohort: " M27 " }).cohort,
  ).toBe("M27");
  for (const patch of [
    { displayName: " " },
    { displayName: "x".repeat(101) },
    { cohort: "m27" },
    { cohort: "2027" },
  ])
    expect(
      profileFormSchema.safeParse({
        displayName: "Ada",
        cohort: "M27",
        ...patch,
      }).success,
    ).toBe(false);
});
