import {
  categoriesSchema,
  citiesSchema,
  profileSchema,
  insightFeedSchema,
  insightDetailSchema,
  voteSchema,
  type FeedQuery,
} from "@atlas/shared";
import type { z } from "zod";
import { atlasError, ClientError, networkError } from "./errors";
import { RequestScope } from "./request-scope";

export function createApiClient(
  scope: RequestScope,
  fetcher: typeof fetch = fetch,
) {
  function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    protectedRequest = true,
    method = "GET",
  ) {
    return scope.run(
      async (requestSignal) => {
        try {
          const response = await fetcher(`/api${path}`, {
            method,
            credentials: "include",
            cache: "no-store",
            signal: requestSignal,
            headers: { Accept: "application/json" },
          });
          const body: unknown = await response.json().catch(() => undefined);
          if (!response.ok) throw atlasError(body, response.status);
          const result = schema.safeParse(body);
          if (!result.success)
            throw new ClientError(
              "Atlas returned an unexpected response. Try again.",
              "response",
              response.status,
            );
          return result.data;
        } catch (error) {
          throw networkError(error);
        }
      },
      signal,
      protectedRequest,
    );
  }
  return {
    // The session query handles its own 401 so it can commit null atomically.
    getMe: (signal?: AbortSignal) =>
      request("/me", profileSchema, signal, false),
    getCities: (signal?: AbortSignal) =>
      request("/cities", citiesSchema, signal),
    getCategories: (signal?: AbortSignal) =>
      request("/categories", categoriesSchema, signal),
    getInsights: (query: FeedQuery, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query))
        if (value !== undefined) params.set(key, String(value));
      return request(`/insights?${params}`, insightFeedSchema, signal);
    },
    getInsight: (id: string, signal?: AbortSignal) =>
      request(
        `/insights/${encodeURIComponent(id)}`,
        insightDetailSchema,
        signal,
      ),
    setVote: (id: string, voted: boolean, signal?: AbortSignal) =>
      request(
        `/insights/${encodeURIComponent(id)}/vote`,
        voteSchema,
        signal,
        true,
        voted ? "PUT" : "DELETE",
      ),
  };
}
