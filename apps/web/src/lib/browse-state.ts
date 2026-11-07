import { z } from "zod";
import type { Category, FeedQuery } from "@atlas/shared";
import { resolveCity, type CityOption } from "./city";

// URL values are text. In particular, searches such as 123, true, and quoted
// phrases must not be interpreted as JSON by the router's default serializer.
export function parseRouteSearch(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => {
      const values = params.getAll(key);
      const value = values[0]!;
      return [
        key,
        values.length > 1
          ? values
          : key === "page" && /^\d+$/.test(value)
            ? Number(value)
            : value,
      ];
    }),
  );
}
export function stringifyRouteSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const values: unknown[] = Array.isArray(value) ? value : [value];
    for (const item of values)
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      )
        params.append(key, String(item));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .catch(undefined)
  .optional();
export const browseSearchSchema = z.object({
  city: optionalText,
  q: optionalText,
  category: optionalText,
  sort: z.enum(["newest", "top", "relevance"]).optional().catch(undefined),
  page: z
    .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .optional()
    .catch(undefined),
  insight: z.uuid().optional().catch(undefined),
});
export type BrowseSearch = z.infer<typeof browseSearchSchema>;
export type BrowseState = BrowseSearch & {
  city: string;
  sort: FeedQuery["sort"];
  page: number;
};

export function normalizeBrowseSearch(
  input: unknown,
  cities: readonly CityOption[],
  categories: readonly Pick<Category, "slug">[],
): BrowseState {
  const value = browseSearchSchema.parse(input);
  return {
    ...value,
    page: value.page ?? 1,
    city: resolveCity(value.city, cities),
    category: categories.some((category) => category.slug === value.category)
      ? value.category
      : undefined,
    sort:
      value.sort === "relevance" && !value.q
        ? "newest"
        : (value.sort ?? (value.q ? "relevance" : "newest")),
  };
}

export function isCanonicalBrowseSearch(
  raw: Record<string, unknown>,
  state: BrowseState,
) {
  const entries = Object.entries(state).filter(
    ([, value]) => value !== undefined,
  );
  return (
    Object.keys(raw).length === entries.length &&
    entries.every(
      ([key, value]) =>
        (typeof raw[key] === "string" || typeof raw[key] === "number") &&
        String(raw[key]) === String(value),
    )
  );
}

export function feedQuery(state: BrowseState): FeedQuery {
  return {
    city: state.city,
    q: state.q,
    category: state.category,
    sort: state.sort,
    page: state.page,
    limit: 20,
  };
}

// Keep the pagination bounded even for a large result set.
export function pageNumbers(page: number, pages: number): (number | "gap")[] {
  const visible = new Set([1, pages, page - 1, page, page + 1]);
  const numbers = [...visible]
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);
  return numbers.flatMap((value, index): (number | "gap")[] =>
    index > 0 && value - numbers[index - 1]! > 1 ? ["gap", value] : [value],
  );
}
