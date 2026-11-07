import { displayNameSchema } from "@atlas/shared";
import { z } from "zod";

const email = z.string().trim().pipe(z.email("Enter a valid email address."));
export const signInSchema = z.object({
  email,
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(128, "Use no more than 128 characters."),
});
export const signUpSchema = signInSchema
  .extend({
    name: displayNameSchema,
    email: email.refine(
      (value) =>
        ["minerva.edu", "uni.minerva.edu"].includes(
          value.split("@")[1]?.toLowerCase() ?? "",
        ),
      "Use your minerva.edu or uni.minerva.edu email address.",
    ),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128, "Use no more than 128 characters."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Passwords must match.",
  });

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    [...value].some(
      (character) => character === "\\" || character.charCodeAt(0) <= 32,
    )
  )
    return "/browse";
  try {
    const url = new URL(value, "https://atlas.invalid");
    if (
      url.origin !== "https://atlas.invalid" ||
      !["/browse", "/discover", "/agent", "/profile"].includes(url.pathname)
    )
      return "/browse";
    // returnTo belongs to auth screens, never to the protected destination.
    // Strip old/nested values rather than wrapping them on the next redirect.
    if (url.searchParams.has("returnTo")) url.searchParams.delete("returnTo");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/browse";
  }
}
