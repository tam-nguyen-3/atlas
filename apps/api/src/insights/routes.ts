import {
  createInsightSchema,
  feedQuerySchema,
  insightDetailSchema,
  insightFeedSchema,
  insightParamsSchema,
  updateInsightSchema,
  voteSchema,
} from "@atlas/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { createInsightService } from "./service.js";

export function registerInsightRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createInsightService>,
) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get(
    "/insights",
    {
      schema: {
        querystring: feedQuerySchema,
        response: { 200: insightFeedSchema },
      },
    },
    (request) => service.list(request.userId!, request.query),
  );
  routes.post(
    "/insights",
    {
      schema: {
        body: createInsightSchema,
        response: { 201: insightDetailSchema },
      },
    },
    async (request, reply) => {
      const result = await service.create(request.userId!, request.body);
      return reply.code(201).send(result);
    },
  );
  routes.get(
    "/insights/:id",
    {
      schema: {
        params: insightParamsSchema,
        response: { 200: insightDetailSchema },
      },
    },
    (request) => service.get(request.params.id, request.userId!),
  );
  routes.patch(
    "/insights/:id",
    {
      schema: {
        params: insightParamsSchema,
        body: updateInsightSchema,
        response: { 200: insightDetailSchema },
      },
    },
    (request) =>
      service.update(request.params.id, request.userId!, request.body),
  );
  routes.delete(
    "/insights/:id",
    { schema: { params: insightParamsSchema } },
    async (request, reply) => {
      await service.delete(request.params.id, request.userId!);
      return reply.code(204).send();
    },
  );
  routes.put(
    "/insights/:id/vote",
    { schema: { params: insightParamsSchema, response: { 200: voteSchema } } },
    (request) => service.vote(request.params.id, request.userId!, true),
  );
  routes.delete(
    "/insights/:id/vote",
    { schema: { params: insightParamsSchema, response: { 200: voteSchema } } },
    (request) => service.vote(request.params.id, request.userId!, false),
  );
}
