import { expect, test } from "vitest";
import {
  createInsightSchema,
  feedQuerySchema,
  insightParamsSchema,
  updateInsightSchema,
} from "./content.js";

const valid = { body: "A note", categorySlugs: ["food"], citySlugs: [] };
test("creation trims every string, keeps internal formatting, and applies only POST defaults", () => {
  expect(
    createInsightSchema.parse({
      ...valid,
      body: "  Line one\n\nLine two  ",
      categorySlugs: [" food "],
      citySlugs: [" tokyo "],
    }),
  ).toEqual({
    body: "Line one\n\nLine two",
    categorySlugs: ["food"],
    citySlugs: ["tokyo"],
    title: null,
    sourceUrl: null,
    places: [],
  });
  expect(
    createInsightSchema.parse({
      ...valid,
      title: " Title ",
      sourceUrl: " https://example.com/a ",
      places: [{ googlePlaceId: " id " }],
    }),
  ).toMatchObject({
    title: "Title",
    sourceUrl: "https://example.com/a",
    places: [{ googlePlaceId: "id" }],
  });
  expect(updateInsightSchema.parse({ body: " new " })).toEqual({ body: "new" });
  expect(
    updateInsightSchema.parse({
      title: null,
      sourceUrl: null,
      places: [],
      citySlugs: [],
    }),
  ).toEqual({ title: null, sourceUrl: null, places: [], citySlugs: [] });
});
test.each([
  { body: undefined },
  { categorySlugs: undefined },
  { citySlugs: undefined },
  { body: " " },
  { body: null },
  { body: "x".repeat(5001) },
  { title: " " },
  { title: "x".repeat(121) },
  { categorySlugs: [] },
  { categorySlugs: null },
  { categorySlugs: ["food", " food "] },
  { categorySlugs: [" "] },
  { citySlugs: null },
  { citySlugs: ["tokyo", " tokyo "] },
  { citySlugs: [" "] },
  { citySlugs: Array.from({ length: 11 }, (_, i) => `city-${i}`) },
  { sourceUrl: "" },
  { sourceUrl: "/relative" },
  { sourceUrl: "ftp://example.com" },
  { sourceUrl: "javascript:alert(1)" },
  { sourceUrl: "http:example.com" },
  { places: null },
  { places: [{ googlePlaceId: " " }] },
  { places: [{ googlePlaceId: "id", name: "Forbidden" }] },
  { places: [{ googlePlaceId: "id" }, { googlePlaceId: " id " }] },
  { places: Array.from({ length: 6 }, (_, i) => ({ googlePlaceId: `${i}` })) },
  { authorId: "forbidden" },
])("rejects invalid create field %j", (input) => {
  expect(createInsightSchema.safeParse({ ...valid, ...input }).success).toBe(
    false,
  );
  // Missing fields are permitted only on PATCH.
  if (!Object.values(input).includes(undefined))
    expect(updateInsightSchema.safeParse(input).success).toBe(false);
});
test("accepts exact write limits", () => {
  expect(
    createInsightSchema.safeParse({
      ...valid,
      body: "x".repeat(5000),
      title: "x".repeat(120),
      citySlugs: Array.from({ length: 10 }, (_, i) => `${i}`),
      places: Array.from({ length: 5 }, (_, i) => ({ googlePlaceId: `${i}` })),
    }).success,
  ).toBe(true);
});
test.each([{}, { body: undefined }, { unexpected: "x" }])(
  "rejects empty or unknown patches %j",
  (input) => {
    expect(updateInsightSchema.safeParse(input).success).toBe(false);
  },
);
test("validates UUID path parameters", () => {
  expect(
    insightParamsSchema.safeParse({
      id: "a1111111-1111-4111-8111-111111111111",
    }).success,
  ).toBe(true);
  for (const id of ["bad", "", "1", "a1111111-1111-4111-8111-111111111111 "])
    expect(insightParamsSchema.safeParse({ id }).success).toBe(false);
});
test("normalizes feed search, scope, sorting and pagination", () => {
  expect(feedQuerySchema.parse({ city: " tokyo " })).toEqual({
    city: "tokyo",
    page: 1,
    limit: 20,
    sort: "newest",
  });
  expect(
    feedQuerySchema.parse({
      city: "general",
      q: " cafe ",
      page: "2",
      limit: "50",
    }),
  ).toMatchObject({ q: "cafe", sort: "relevance", page: 2, limit: 50 });
  expect(feedQuerySchema.parse({ author: "me", q: " \n " })).toMatchObject({
    q: undefined,
    sort: "newest",
  });
  expect(
    feedQuerySchema.parse({ author: "me", q: "cafe", sort: "top" }).sort,
  ).toBe("top");
});
test.each([
  {},
  { city: " " },
  { city: "tokyo", unknown: "x" },
  { author: "someone" },
  { city: "tokyo", sort: "bad" },
  { city: "tokyo", sort: "relevance" },
  { city: "tokyo", sort: "relevance", q: " " },
  ...["0", "-1", "1.5", "1e2", "", " ", "Infinity", "9007199254740992"].map(
    (page) => ({ city: "tokyo", page }),
  ),
  ...["0", "51", "1.5", "x"].map((limit) => ({ city: "tokyo", limit })),
  { city: ["tokyo", "general"] },
  { city: "tokyo", page: ["1", "2"] },
])("rejects invalid feed query %j", (input) => {
  expect(feedQuerySchema.safeParse(input).success).toBe(false);
});
