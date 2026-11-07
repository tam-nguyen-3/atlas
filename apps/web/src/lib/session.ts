import type { Profile } from "@atlas/shared";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import { createApiClient } from "./api";
import { createAuthAdapter } from "./auth";
import { ClientError } from "./errors";
import { RequestScope } from "./request-scope";

export const ME_KEY = ["me"] as const;

export function createSession(fetcher: typeof fetch = fetch) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const scope = new RequestScope();
  const api = createApiClient(scope, fetcher);
  const auth = createAuthAdapter(scope, fetcher);
  let userId: string | null = null;
  let invalidateRoutes = () => {};
  let signOutRequest: Promise<void> | undefined;

  function clear(preserveMe = false) {
    scope.reset();
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        !preserveMe || query.queryKey[0] !== "me",
    };
    void queryClient.cancelQueries(filters);
    // Keep /me's query object alive: removing an observed query leaves its
    // observers holding the old profile even if a new null query is created.
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "me",
    });
    queryClient.getMutationCache().clear();
    userId = null;
    if (!preserveMe) queryClient.setQueryData(ME_KEY, null);
    invalidateRoutes();
  }

  scope.onUnauthorized = () => {
    clear();
    queryClient.setQueryData(ME_KEY, null);
  };

  const meOptions = queryOptions({
    queryKey: ME_KEY,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async ({ signal }): Promise<Profile | null> => {
      try {
        const profile = await api.getMe(signal);
        if (userId !== null && userId !== profile.id) clear(true);
        userId = profile.id;
        return profile;
      } catch (error) {
        if (error instanceof ClientError && error.status === 401) {
          clear(true);
          return null;
        }
        throw error;
      }
    },
  });

  return {
    queryClient,
    api,
    auth,
    meOptions,
    setRouteInvalidator: (invalidate: () => void) => {
      invalidateRoutes = invalidate;
    },
    verify: () => queryClient.fetchQuery(meOptions),
    beginAuthentication: () => {
      clear();
    },
    signOut: () => {
      signOutRequest ??= (async () => {
        await auth.signOut();
        clear();
        queryClient.setQueryData(ME_KEY, null);
      })().finally(() => {
        signOutRequest = undefined;
      });
      return signOutRequest;
    },
  };
}

export type Session = ReturnType<typeof createSession>;
