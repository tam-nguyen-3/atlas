import { z } from "zod";
import { cohortSchema } from "./api.js";

const text = z.string().trim().min(1);
const distinct = (values: string[]) => new Set(values).size === values.length;
const slugs = z.array(text).refine(distinct, "Duplicate selections");
export const placeSchema = z.strictObject({ googlePlaceId: text });
const placeList = z
  .array(placeSchema)
  .max(5)
  .refine(
    (values) => distinct(values.map((place) => place.googlePlaceId)),
    "Duplicate place IDs",
  );
const sourceUrl = text
  .regex(/^https?:\/\//i)
  .pipe(z.url({ protocol: /^https?$/ }))
  .nullable();
const writeFields = {
  body: text.max(5000),
  categorySlugs: slugs.min(1),
  citySlugs: slugs.max(10),
  title: text.max(120).nullable(),
  sourceUrl,
  places: placeList,
};
export const createInsightSchema = z.strictObject({
  ...writeFields,
  title: writeFields.title.default(null),
  sourceUrl: sourceUrl.default(null),
  places: placeList.default([]),
});
export const updateInsightSchema = z
  .strictObject(writeFields)
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "Provide an insight field",
  );
export const insightParamsSchema = z.strictObject({ id: z.uuid() });
const integerParam = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1));
export const feedQuerySchema = z
  .strictObject({
    city: text.optional(),
    category: text.optional(),
    q: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .optional(),
    sort: z.enum(["newest", "top", "relevance"]).optional(),
    author: z.literal("me").optional(),
    page: integerParam.default(1),
    limit: integerParam.pipe(z.number().max(50)).default(20),
  })
  .refine(
    (value) => value.city !== undefined || value.author === "me",
    "Provide a city or author=me",
  )
  .refine(
    (value) => value.sort !== "relevance" || !!value.q,
    "Relevance requires search text",
  )
  .transform((value) => ({
    ...value,
    sort: value.sort ?? (value.q ? "relevance" : "newest"),
  }));

export const citySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  country: z.string(),
  timezone: z.string(),
  sortOrder: z.number().int(),
});
export const categorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  icon: z.string(),
  sortOrder: z.number().int(),
});
export const citiesSchema = z.array(citySchema);
export const categoriesSchema = z.array(categorySchema);
export const authorSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  cohort: cohortSchema,
  avatarUrl: z.null(),
});
export const voteSchema = z.object({
  upvoteCount: z.number().int().nonnegative(),
  viewerHasUpvoted: z.boolean(),
});
const insightFields = {
  id: z.uuid(),
  title: z.string().nullable(),
  categories: categoriesSchema.min(1),
  cities: citiesSchema,
  author: authorSchema,
  ...voteSchema.shape,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};
export const insightDetailSchema = z.object({
  ...insightFields,
  body: z.string(),
  sourceUrl,
  places: z.array(placeSchema),
  isAuthor: z.boolean(),
});
export const insightFeedItemSchema = z.object({
  ...insightFields,
  bodyPreview: z.string(),
  placeCount: z.number().int().nonnegative(),
});
export const insightFeedSchema = z.object({
  items: z.array(insightFeedItemSchema),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(50),
  total: z.number().int().nonnegative(),
});
export type City = z.infer<typeof citySchema>;
export type Category = z.infer<typeof categorySchema>;
export type CreateInsight = z.infer<typeof createInsightSchema>;
export type UpdateInsight = z.infer<typeof updateInsightSchema>;
export type InsightParams = z.infer<typeof insightParamsSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type InsightDetail = z.infer<typeof insightDetailSchema>;
export type InsightFeedItem = z.infer<typeof insightFeedItemSchema>;
export type InsightFeed = z.infer<typeof insightFeedSchema>;
export type Vote = z.infer<typeof voteSchema>;
