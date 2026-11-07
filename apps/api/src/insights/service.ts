import type {
  CreateInsight,
  FeedQuery,
  InsightDetail,
  InsightFeed,
  InsightFeedItem,
  UpdateInsight,
} from "@atlas/shared";
import { HttpError } from "../errors.js";
import type { createInsightRepository, WriteGuard } from "./repository.js";

type Repository = ReturnType<typeof createInsightRepository>;
type Row = NonNullable<Awaited<ReturnType<Repository["detail"]>>>;
const exists: WriteGuard = (row) => {
  if (!row) throw new HttpError(404, "NOT_FOUND", "Insight not found.");
};
function owner(viewerId: string): WriteGuard {
  return (row) => {
    exists(row);
    if (row!.authorId !== viewerId)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only the author can change this insight.",
      );
  };
}
function validateReferences(valid: boolean) {
  if (!valid)
    throw new HttpError(400, "VALIDATION_ERROR", "Unknown city or category.");
}
function common(row: Row) {
  return {
    id: row.id,
    title: row.title,
    categories: row.categories,
    cities: row.cities,
    author: row.author,
    upvoteCount: row.upvoteCount,
    viewerHasUpvoted: row.viewerHasUpvoted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function detail(row: Row, viewerId: string): InsightDetail {
  return {
    ...common(row),
    body: row.body,
    sourceUrl: row.sourceUrl,
    places: row.places,
    isAuthor: row.authorId === viewerId,
  };
}
function feedItem(row: Row): InsightFeedItem {
  return {
    ...common(row),
    bodyPreview: Array.from(row.body).slice(0, 280).join(""),
    placeCount: row.places.length,
  };
}
export function createInsightService(repository: Repository) {
  return {
    async create(viewerId: string, input: CreateInsight) {
      return detail(
        await repository.create(viewerId, input, validateReferences),
        viewerId,
      );
    },
    async get(id: string, viewerId: string) {
      const row = await repository.detail(id, viewerId);
      exists(row);
      return detail(row!, viewerId);
    },
    async update(id: string, viewerId: string, input: UpdateInsight) {
      return detail(
        await repository.update(
          id,
          viewerId,
          input,
          owner(viewerId),
          validateReferences,
        ),
        viewerId,
      );
    },
    delete: (id: string, viewerId: string) =>
      repository.delete(id, owner(viewerId)),
    vote: (id: string, viewerId: string, add: boolean) =>
      repository.vote(id, viewerId, add, exists),
    async list(viewerId: string, query: FeedQuery): Promise<InsightFeed> {
      const { rows, total } = await repository.list(
        viewerId,
        query,
        validateReferences,
      );
      return {
        items: rows.map(feedItem),
        page: query.page,
        limit: query.limit,
        total,
      };
    },
  };
}
