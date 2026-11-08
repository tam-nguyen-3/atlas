import { Link, useRouterState } from "@tanstack/react-router";
import type { InsightFeedItem } from "@atlas/shared";
import { InsightActions, InsightMetadata } from "./insight";
import { InsightMenu } from "./insight-menu";
import { Button } from "./ui/button";
import { pageNumbers } from "@/lib/browse-state";

export function InsightRows({
  items,
  open,
}: {
  items: InsightFeedItem[];
  open: (element: HTMLElement) => void;
}) {
  const location = useRouterState({ select: (state) => state.location });
  const to = location.pathname === "/profile" ? "/profile" : "/browse";
  return (
    <div className="insight-feed">
      {items.map((insight) => (
        <article
          className="insight"
          key={insight.id}
          aria-label={
            insight.title ?? `Insight by ${insight.author.displayName}`
          }
        >
          <span className="avatar" aria-hidden="true">
            {Array.from(insight.author.displayName)[0]}
          </span>
          <div className="insight-content">
            <div className="insight-header">
              <InsightMetadata insight={insight} />
              <InsightMenu insight={insight} />
            </div>
            <Link
              className="insight-link"
              to={to}
              search={{ ...location.search, insight: insight.id }}
              state={{ atlasInsightOrigin: location.href }}
              resetScroll={false}
              preload={false}
              onClick={(event) => {
                if (
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                )
                  open(event.currentTarget);
              }}
            >
              {insight.title && <h2>{insight.title}</h2>}
              <p className="insight-prose">{insight.bodyPreview}</p>
              <span className="read-insight">
                Read insight
                <span className="sr-only">
                  {" "}
                  by {insight.author.displayName}
                </span>
              </span>
            </Link>
            <InsightActions insight={insight} />
          </div>
        </article>
      ))}
    </div>
  );
}
export function InsightPagination({
  page,
  total,
  change,
}: {
  page: number;
  total: number;
  change: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <>
      <nav className="pagination" aria-label="Insight pages">
        <Button
          variant="ghost"
          disabled={page === 1}
          onClick={() => change(page - 1)}
        >
          Previous
        </Button>
        {pageNumbers(page, pages).map((value, index) =>
          value === "gap" ? (
            <span key={`gap-${index}`} aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={value}
              variant={value === page ? "default" : "ghost"}
              aria-label={`Page ${value}`}
              aria-current={value === page ? "page" : undefined}
              onClick={() => change(value)}
            >
              {value}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          disabled={page === pages}
          onClick={() => change(page + 1)}
        >
          Next
        </Button>
      </nav>
      <p className="page-range muted">
        {((page - 1) * 20 + 1).toLocaleString("en")}–
        {Math.min(page * 20, total).toLocaleString("en")} of{" "}
        {total.toLocaleString("en")} {total === 1 ? "insight" : "insights"}
      </p>
    </>
  );
}
