import { afterEach, expect, test } from "vitest";
import {
  feedQuery,
  normalizeBrowseSearch,
  pageNumbers,
  isCanonicalBrowseSearch,
  parseRouteSearch,
  stringifyRouteSearch,
} from "./browse-state";
const cities = [
  { slug: "san-francisco", name: "San Francisco" },
  { slug: "tokyo", name: "Tokyo" },
  { slug: "general", name: "General" },
];
const categories = [{ slug: "food" }];
afterEach(() => localStorage.clear());

test.each(["123", "true", "null", '"quiet café"', "東京 & tea"])(
  "round-trips literal query %s through shared URLs",
  (q) => {
    const serialized = stringifyRouteSearch({
      city: "tokyo",
      q,
      page: 2,
      category: undefined,
    });
    const parsed = parseRouteSearch(serialized);
    expect(parsed).toEqual({ city: "tokyo", q, page: 2 });
    expect(normalizeBrowseSearch(parsed, cities, categories).q).toBe(q);
  },
);

test("duplicate URL filters are invalid rather than silently choosing a value", () => {
  expect(
    normalizeBrowseSearch(
      parseRouteSearch("?q=one&q=two&page=2&page=3"),
      cities,
      categories,
    ),
  ).toMatchObject({ q: undefined, page: 1 });
});

test("normalizes malformed URL values without sending unknown API parameters", () => {
  localStorage.setItem("atlas:last-city", "general");
  const state = normalizeBrowseSearch(
    {
      city: "unknown",
      q: "  ",
      category: "bad",
      page: "1e3",
      sort: "relevance",
      insight: "bad",
      extra: true,
    },
    cities,
    categories,
  );
  expect(state).toMatchObject({
    city: "general",
    q: undefined,
    category: undefined,
    page: 1,
    sort: "newest",
    insight: undefined,
  });
  expect(feedQuery(state)).toEqual({
    city: "general",
    q: undefined,
    category: undefined,
    page: 1,
    sort: "newest",
    limit: 20,
  });
  expect(isCanonicalBrowseSearch({ ...state, extra: true }, state)).toBe(false);
});

test("preserves valid filters and explicit sorting; defaults search to relevance", () => {
  const state = normalizeBrowseSearch(
    { city: "tokyo", q: " café ", category: "food", page: "3" },
    cities,
    categories,
  );
  expect(state).toMatchObject({
    city: "tokyo",
    q: "café",
    category: "food",
    page: 3,
    sort: "relevance",
  });
  expect(
    normalizeBrowseSearch({ ...state, sort: "top" }, cities, categories).sort,
  ).toBe("top");
  expect(
    isCanonicalBrowseSearch(
      {
        city: "tokyo",
        q: "café",
        category: "food",
        page: 3,
        sort: "relevance",
      },
      state,
    ),
  ).toBe(true);
  expect(localStorage.getItem("atlas:last-city")).toBeNull();
});

test.each([0, -1, 1.5, Infinity, true, [], {}, "no", "9007199254740999"])(
  "rejects invalid page %j",
  (page) => {
    expect(normalizeBrowseSearch({ page }, cities, categories).page).toBe(1);
  },
);

test("pagination includes boundaries and nearby pages without an unbounded list", () => {
  expect(pageNumbers(1, 1)).toEqual([1]);
  expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
  expect(pageNumbers(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100]);
});
