import { z } from "zod";

export const displayNameSchema = z.string().trim().min(1).max(100);
export const cohortSchema = z
  .string()
  .regex(/^M[0-9]{2}$/)
  .nullable();
export const healthSchema = z.object({ status: z.literal("ok") });
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export const profileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: displayNameSchema,
  cohort: cohortSchema,
  avatarUrl: z.null(),
});
export const updateProfileSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    cohort: cohortSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide a profile field");

export type Health = z.infer<typeof healthSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
