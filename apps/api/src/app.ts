import { healthSchema } from "@atlas/shared";
import cors from "@fastify/cors";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createAuth } from "./auth.js";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import { HttpError } from "./errors.js";
import { createProfileRepository } from "./profile/repository.js";
import { registerProfileRoutes } from "./profile/routes.js";
import { createProfileService } from "./profile/service.js";
import { createReferenceRepository } from "./reference/repository.js";
import { createReferenceService } from "./reference/service.js";
import { registerReferenceRoutes } from "./reference/routes.js";
import { createInsightRepository } from "./insights/repository.js";
import { createInsightService } from "./insights/service.js";
import { registerInsightRoutes } from "./insights/routes.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}

function forwardCookies(headers: Headers, reply: FastifyReply) {
  const cookies = headers.getSetCookie();
  if (cookies.length) reply.header("set-cookie", cookies);
}

function authHeaders(request: FastifyRequest) {
  const headers = fromNodeHeaders(request.headers);
  // Never accept a client-provided rate-limit identity or forwarded address.
  headers.set("x-atlas-client-ip", request.ip);
  return headers;
}

const authRoutes = new Set([
  "POST /api/auth/sign-up/email",
  "POST /api/auth/sign-in/email",
  "POST /api/auth/sign-out",
  "GET /api/auth/get-session",
]);

export function createApp({
  db,
  config,
  logger = false,
  registerContentRoutes,
}: {
  db: Db;
  config: Config;
  logger?: boolean;
  registerContentRoutes?: (app: FastifyInstance) => void | Promise<void>;
}) {
  const app = Fastify({
    logger: logger
      ? {
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            'res.headers["set-cookie"]',
          ],
        }
      : false,
    trustProxy: false,
  });
  const auth = createAuth(db, config);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest("userId", null);

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  // Enforce again after downstream auth response headers are copied.
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.addHook("onRequest", (request, _reply, done) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin !== config.WEB_ORIGIN
    ) {
      done(
        new HttpError(
          403,
          "FORBIDDEN_ORIGIN",
          "Request origin is not allowed.",
        ),
      );
      return;
    }
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred.";
    let details: { path: string; message: string }[] | undefined;
    if (error instanceof HttpError) {
      status = error.statusCode;
      code = error.code;
      message = error.message;
    } else if (hasZodFastifySchemaValidationErrors(error)) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = "Request validation failed.";
      details = error.validation.map((issue) => ({
        path: issue.instancePath,
        message: issue.message ?? "Invalid value",
      }));
    } else if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      status = error.statusCode;
      code = "INVALID_REQUEST";
      message = "Invalid request.";
    } else {
      request.log.error({ err: error }, "Request failed");
    }
    const body = { code, message, ...(details ? { details } : {}) };
    // The auth namespace keeps the native top-level error convention.
    reply
      .code(status)
      .send(
        request.url.split("?")[0]?.startsWith("/api/auth/")
          ? body
          : { error: body },
      );
  });
  app.setNotFoundHandler(() => {
    throw new HttpError(404, "NOT_FOUND", "Route not found.");
  });

  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      "/api/health",
      { schema: { response: { 200: healthSchema } } },
      () => ({ status: "ok" as const }),
    );
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const path = request.url.split("?")[0];
      if (!authRoutes.has(`${request.method} ${path}`)) {
        return reply
          .code(404)
          .send({ code: "NOT_FOUND", message: "Route not found." });
      }
      const response = await auth.handler(
        new Request(new URL(request.url, config.BETTER_AUTH_URL), {
          method: request.method,
          headers: authHeaders(request),
          ...(request.body === undefined
            ? {}
            : { body: JSON.stringify(request.body) }),
        }),
      );
      reply.code(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      forwardCookies(response.headers, reply);
      return reply.send(await response.text());
    },
  });

  app.register(
    async (content) => {
      content.addHook("onRequest", async (request, reply) => {
        const { response: session, headers } = await auth.api.getSession({
          headers: authHeaders(request),
          returnHeaders: true,
        });
        forwardCookies(headers, reply);
        if (!session)
          throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
        request.userId = session.user.id;
      });
      registerProfileRoutes(
        content,
        createProfileService(createProfileRepository(db)),
      );
      registerReferenceRoutes(
        content,
        createReferenceService(createReferenceRepository(db)),
      );
      registerInsightRoutes(
        content,
        createInsightService(createInsightRepository(db)),
      );
      await registerContentRoutes?.(content);
    },
    { prefix: "/api" },
  );
  return app;
}
