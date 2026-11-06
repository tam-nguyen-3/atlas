import { profileSchema, updateProfileSchema } from "@atlas/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { createProfileService } from "./service.js";

export function registerProfileRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createProfileService>,
) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get(
    "/me",
    { schema: { response: { 200: profileSchema } } },
    (request) => service.get(request.userId!),
  );
  routes.patch(
    "/me",
    {
      schema: { body: updateProfileSchema, response: { 200: profileSchema } },
    },
    (request) => service.update(request.userId!, request.body),
  );
}
