import { categoriesSchema, citiesSchema } from "@atlas/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { createReferenceService } from "./service.js";

export function registerReferenceRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createReferenceService>,
) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get("/cities", { schema: { response: { 200: citiesSchema } } }, () =>
    service.cities(),
  );
  routes.get(
    "/categories",
    { schema: { response: { 200: categoriesSchema } } },
    () => service.categories(),
  );
}
