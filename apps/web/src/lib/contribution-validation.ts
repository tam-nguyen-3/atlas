import { createInsightSchema, updateProfileSchema } from "@atlas/shared";
import { z } from "zod";
const optional = (value: string) => value.trim() || null;
export const insightFormSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    sourceUrl: z.string(),
    categorySlugs: z.array(z.string()),
    citySlugs: z.array(z.string()),
  })
  .transform((values): z.input<typeof createInsightSchema> => ({
    ...values,
    title: optional(values.title),
    sourceUrl: optional(values.sourceUrl),
    places: [],
  }))
  .pipe(createInsightSchema);
export const profileFormSchema = z
  .object({ displayName: z.string(), cohort: z.string() })
  .transform((values): z.input<typeof updateProfileSchema> => ({
    displayName: values.displayName,
    cohort: optional(values.cohort),
  }))
  .pipe(updateProfileSchema);
