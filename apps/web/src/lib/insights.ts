import {
  queryOptions,
  useIsMutating,
  useMutation,
} from "@tanstack/react-query";
import type { FeedQuery, InsightDetail, InsightFeed } from "@atlas/shared";
import type { Session } from "./session";
import { useServices } from "./app-context";

export function feedOptions(
  session: Session,
  userId: string,
  query: FeedQuery,
) {
  return queryOptions({
    queryKey: ["insights", userId, query] as const,
    queryFn: ({ signal }) => session.api.getInsights(query, signal),
  });
}
export function detailOptions(session: Session, userId: string, id: string) {
  return queryOptions({
    queryKey: ["insight", userId, id] as const,
    queryFn: ({ signal }) => session.api.getInsight(id, signal),
  });
}

export function useVote(id: string) {
  const session = useServices();
  const { queryClient, meOptions } = session;
  const userId = queryClient.getQueryData(meOptions.queryKey)?.id;
  const mutationKey = ["vote", userId, id];
  const feeds = { queryKey: ["insights", userId] };
  const detail = { queryKey: ["insight", userId, id] };
  const currentUser = () =>
    userId === queryClient.getQueryData(meOptions.queryKey)?.id;
  const mutation = useMutation({
    mutationKey,
    retry: false,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries(feeds),
        queryClient.cancelQueries(detail),
      ]);
    },
    mutationFn: (voted: boolean) => {
      if (!currentUser())
        throw new DOMException("Request cancelled", "AbortError");
      return session.api.setVote(id, voted);
    },
    onSuccess: async (vote) => {
      if (!currentUser()) return;
      await Promise.all([
        queryClient.cancelQueries(feeds),
        queryClient.cancelQueries(detail),
      ]);
      if (!currentUser()) return;
      queryClient.setQueriesData<InsightFeed>(
        feeds,
        (feed) =>
          feed && {
            ...feed,
            items: feed.items.map((item) =>
              item.id === id ? { ...item, ...vote } : item,
            ),
          },
      );
      queryClient.setQueriesData<InsightDetail>(
        detail,
        (insight) => insight && { ...insight, ...vote },
      );
    },
    onSettled: () => {
      if (currentUser()) {
        void queryClient.invalidateQueries(feeds);
        void queryClient.invalidateQueries(detail);
      }
    },
  });
  const pending = useIsMutating({ mutationKey, exact: true }) > 0;
  return {
    ...mutation,
    pending,
    vote: (voted: boolean) => {
      // MutationCache is updated synchronously, guarding both mounted controls.
      if (!queryClient.isMutating({ mutationKey, exact: true }))
        mutation.mutate(voted);
    },
  };
}
