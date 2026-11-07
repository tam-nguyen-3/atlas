import type { InsightDetail, InsightFeedItem } from "@atlas/shared";
import { ArrowUp, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useVote } from "@/lib/insights";
import { errorMessage, isCancellation } from "@/lib/errors";

type Insight = InsightDetail | InsightFeedItem;
export function InsightMetadata({ insight }: { insight: Insight }) {
  return (
    <div className="insight-meta">
      <span className="author">{insight.author.displayName}</span>
      {insight.author.cohort && <span>{insight.author.cohort}</span>}
      <time dateTime={insight.createdAt}>
        {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
          new Date(insight.createdAt),
        )}
      </time>
      {insight.updatedAt !== insight.createdAt && <span>Edited</span>}
      {insight.categories.map((category) => (
        <Badge key={category.id}>{category.name}</Badge>
      ))}
      <span>
        {insight.cities.length
          ? insight.cities.map((city) => city.name).join(" · ")
          : "General"}
      </span>
    </div>
  );
}

export function InsightActions({ insight }: { insight: Insight }) {
  const mutation = useVote(insight.id);
  const count =
    "placeCount" in insight ? insight.placeCount : insight.places.length;
  const failed = mutation.isError && !isCancellation(mutation.error);
  return (
    <>
      <div className="insight-actions">
        <Button
          variant="ghost"
          busy={mutation.pending}
          aria-label={
            insight.viewerHasUpvoted ? "Remove upvote" : "Upvote insight"
          }
          aria-pressed={insight.viewerHasUpvoted}
          onClick={() => mutation.vote(!insight.viewerHasUpvoted)}
        >
          <ArrowUp size={18} aria-hidden="true" />
          <span>{insight.upvoteCount.toLocaleString("en")}</span>
        </Button>
        {count > 0 && (
          <span className="place-count">
            <MapPin size={16} aria-hidden="true" />
            {count} {count === 1 ? "place" : "places"}
          </span>
        )}
      </div>
      {failed && (
        <div className="vote-feedback">
          <p role="alert" className="error-text">
            {errorMessage(mutation.error)}
          </p>
          <Button
            variant="ghost"
            disabled={mutation.pending}
            onClick={() =>
              mutation.vote(mutation.variables ?? !insight.viewerHasUpvoted)
            }
          >
            Retry vote
          </Button>
        </div>
      )}
      <span className="sr-only" role="status">
        {mutation.isSuccess
          ? `Vote saved. ${insight.upvoteCount} upvotes.`
          : ""}
      </span>
    </>
  );
}
