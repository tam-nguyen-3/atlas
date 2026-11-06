import { displayNameSchema } from "@atlas/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import * as schema from "./db/schema.js";

export function createAuth(
  db: Db,
  config: Pick<
    Config,
    "BETTER_AUTH_URL" | "BETTER_AUTH_SECRET" | "WEB_ORIGIN" | "NODE_ENV"
  >,
) {
  return betterAuth({
    baseURL: config.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    user: {
      fields: { name: "displayName", image: "avatarUrl" },
      additionalFields: {
        cohort: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: config.NODE_ENV === "production",
      ipAddress: { ipAddressHeaders: ["x-atlas-client-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 10,
      max: 100,
      customRules: {
        "/sign-up/email": { window: 10, max: 3 },
        "/sign-in/email": { window: 10, max: 3 },
      },
    },
    hooks: {
      before: createAuthMiddleware((ctx) => {
        if (
          ctx.path === "/sign-up/email" &&
          ctx.body &&
          ["image", "avatarUrl", "cohort"].some((key) =>
            Object.hasOwn(ctx.body as object, key),
          )
        ) {
          throw new APIError("BAD_REQUEST", {
            code: "FIELD_NOT_ALLOWED",
            message:
              "Set your name at sign-up; cohort can be updated in your profile. Avatars are not supported.",
          });
        }
        return Promise.resolve();
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: (user) => {
            const domain = user.email.split("@")[1]?.toLowerCase();
            if (domain !== "minerva.edu" && domain !== "uni.minerva.edu") {
              throw new APIError("FORBIDDEN", {
                code: "EMAIL_DOMAIN_NOT_ALLOWED",
                message: "Use a minerva.edu or uni.minerva.edu email address.",
              });
            }
            const name = displayNameSchema.safeParse(user.name);
            if (!name.success) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: "Name must contain 1–100 characters.",
              });
            }
            return Promise.resolve({
              data: { ...user, name: name.data, image: null, cohort: null },
            });
          },
        },
      },
    },
  });
}
