import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState, useRouter } from "@tanstack/react-router";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "./components/ui/button";
import { AccessibleSelect } from "./components/ui/select";
import { RequestState } from "./components/ui/request-state";
import { BrowseSearch } from "./components/browse-search";
import { InsightRows, InsightPagination } from "./components/insight-list";
import { useContribution } from "./components/contribution";
import { InsightDialog } from "./components/insight-dialog";
import { useServices } from "./lib/app-context";
import { rememberCity } from "./lib/city";
import {
  feedQuery,
  isCanonicalBrowseSearch,
  normalizeBrowseSearch,
  type BrowseState,
} from "./lib/browse-state";
import { feedOptions } from "./lib/insights";

declare module "@tanstack/react-router" {
  interface HistoryState {
    atlasInsightOrigin?: string;
  }
}

export function Browse() {
  const session = useServices();
  const contribution = useContribution();
  const { api, queryClient, meOptions } = session;
  const userId = queryClient.getQueryData(meOptions.queryKey)!.id;
  const cities = useQuery({
    queryKey: ["cities", userId],
    queryFn: ({ signal }) => api.getCities(signal),
  });
  const categories = useQuery({
    queryKey: ["categories", userId],
    queryFn: ({ signal }) => api.getCategories(signal),
  });
  const location = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const options = cities.data
    ? [...cities.data, { slug: "general", name: "General" }]
    : [];
  const state = normalizeBrowseSearch(
    location.search,
    options,
    categories.data ?? [],
  );
  const ready = !!cities.data && !!categories.data;
  const feed = useQuery({
    ...feedOptions(session, userId, feedQuery(state)),
    enabled: ready,
  });
  const pages = Math.max(1, Math.ceil((feed.data?.total ?? 0) / 20));
  const correction = ready && feed.isSuccess && state.page > pages;

  useEffect(() => {
    if (
      ready &&
      location.pathname === "/browse" &&
      (!isCanonicalBrowseSearch(location.search, state) || correction)
    )
      void navigate({
        to: "/browse",
        search: { ...state, page: correction ? pages : state.page },
        state: (previous) => previous,
        replace: true,
        resetScroll: false,
      });
  }, [
    ready,
    location.pathname,
    location.search,
    state,
    correction,
    pages,
    navigate,
  ]);

  function change(patch: Partial<BrowseState>, resetPage = true) {
    void navigate({
      to: "/browse",
      search: {
        ...state,
        ...patch,
        page: resetPage ? 1 : (patch.page ?? state.page),
        insight: undefined,
      },
      resetScroll: false,
    });
  }
  function closeInsight() {
    if (location.state.atlasInsightOrigin) router.history.back();
    else
      void navigate({
        to: "/browse",
        search: { ...state, insight: undefined },
        replace: true,
        resetScroll: false,
      });
  }
  function restoreFocus() {
    if (opener.current?.isConnected)
      opener.current.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
  }
  if (cities.isError || categories.isError)
    return (
      <RequestState
        error={cities.error ?? categories.error}
        retry={() => {
          if (cities.isError) void cities.refetch();
          if (categories.isError) void categories.refetch();
        }}
      />
    );
  if (!ready)
    return <RequestState pendingLabel="Loading your cities and categories…" />;

  return (
    <section aria-labelledby="browse-heading">
      <div className="browse-heading">
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1
            id="browse-heading"
            className="sr-only"
            tabIndex={-1}
            ref={heading}
          >
            Browse insights
          </h1>
          <AccessibleSelect
            label="Choose a city"
            value={state.city}
            options={options}
            onValueChange={(city) => {
              rememberCity(city);
              change({ city });
            }}
          />
          <p className="city-description">
            {state.city === "general"
              ? "Good advice, wherever your rotation takes you."
              : "Local knowledge. Shared by Minervans."}
          </p>
        </div>
        <Button
          className="desktop-create"
          onClick={() => contribution.create(state.city)}
        >
          <Plus size={18} aria-hidden="true" />
          Create insight
        </Button>
      </div>
      <BrowseSearch
        committed={state.q ?? ""}
        navigationKey={location.href}
        commit={(q) =>
          change({
            q: q || undefined,
            sort:
              state.sort === "top" || (state.sort === "newest" && !!state.q)
                ? state.sort
                : q
                  ? "relevance"
                  : "newest",
          })
        }
      >
        <Button
          type="button"
          variant="ghost"
          aria-label="Filter and sort insights"
          aria-expanded={filtersOpen}
          aria-controls="browse-filters"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
        </Button>
      </BrowseSearch>
      {filtersOpen && (
        <div className="browse-filters" id="browse-filters">
          <AccessibleSelect
            label="Sort insights"
            value={state.sort}
            options={[
              { slug: "newest", name: "Newest" },
              { slug: "top", name: "Top upvoted" },
              ...(state.q
                ? [{ slug: "relevance", name: "Most relevant" }]
                : []),
            ]}
            onValueChange={(sort) => {
              if (sort === "newest" || sort === "top" || sort === "relevance")
                change({ sort });
            }}
          />
        </div>
      )}
      <div className="category-row" role="group" aria-label="Categories">
        <Button
          variant="ghost"
          aria-pressed={!state.category}
          className={`category ${!state.category ? "selected" : ""}`}
          onClick={() => change({ category: undefined })}
        >
          All insights
        </Button>
        {categories.data.map((category) => (
          <Button
            key={category.id}
            variant="ghost"
            aria-pressed={state.category === category.slug}
            className={`category ${state.category === category.slug ? "selected" : ""}`}
            onClick={() => change({ category: category.slug })}
          >
            {category.name}
          </Button>
        ))}
      </div>
      <div className="feed-caption">
        <span>FROM THE COMMUNITY</span>
        <span role="status">
          {feed.data
            ? `${feed.data.total.toLocaleString("en")} ${feed.data.total === 1 ? "insight" : "insights"}`
            : ""}
        </span>
      </div>
      {state.q && state.city !== "general" && (
        <p className="search-scope muted">
          Searching this city and General insights.
        </p>
      )}
      {feed.isError ? (
        <RequestState
          error={feed.error}
          retry={() => {
            void feed.refetch();
          }}
        />
      ) : feed.isPending || correction ? (
        <RequestState pendingLabel="Loading insights…" />
      ) : feed.data.total === 0 ? (
        <div className="empty-state">
          <h2>
            {state.q || state.category
              ? "No matching insights"
              : "No insights here yet"}
          </h2>
          <p className="muted">
            {state.q || state.category
              ? "Try another search or category."
              : "Check another city or General for community advice."}
          </p>
          {(state.q || state.category) && (
            <Button
              variant="outline"
              onClick={() =>
                change({
                  q: undefined,
                  category: undefined,
                  sort: state.sort === "relevance" ? "newest" : state.sort,
                })
              }
            >
              Clear search and category
            </Button>
          )}
        </div>
      ) : (
        <>
          {feed.isFetching && (
            <p className="refresh-status muted" role="status">
              Refreshing insights…
            </p>
          )}
          <InsightRows
            items={feed.data.items}
            open={(element) => {
              opener.current = element;
            }}
          />
          <InsightPagination
            page={state.page}
            total={feed.data.total}
            change={(page) => change({ page }, false)}
          />
        </>
      )}
      <Button
        className="floating-create"
        aria-label="Create insight"
        onClick={() => contribution.create(state.city)}
      >
        <Plus size={24} aria-hidden="true" />
      </Button>
      {state.insight && (
        <InsightDialog
          key={state.insight}
          id={state.insight}
          close={closeInsight}
          restoreFocus={restoreFocus}
        />
      )}
    </section>
  );
}
