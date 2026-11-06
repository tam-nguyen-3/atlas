import { z } from "zod";

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Expected an http(s) origin without a trailing slash or path");

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:/.test(value)),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) =>
        !/replace[-_ ]?me|change[-_ ]?me|placeholder|your[-_ ]?secret/i.test(
          value,
        ),
      "Generate a real auth secret",
    ),
  BETTER_AUTH_URL: origin,
  WEB_ORIGIN: origin,
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // Do not include environment values (especially secrets) in errors.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  if (
    result.data.NODE_ENV === "production" &&
    (!result.data.BETTER_AUTH_URL.startsWith("https://") ||
      !result.data.WEB_ORIGIN.startsWith("https://"))
  ) {
    throw new Error("Production auth and web origins must use HTTPS");
  }
  return result.data;
}

export type Config = ReturnType<typeof readConfig>;
