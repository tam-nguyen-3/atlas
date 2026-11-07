import type { CreateInsight, FeedQuery, UpdateInsight } from "@atlas/shared";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  categories,
  cities,
  insightCategories,
  insightCities,
  insightPlaces,
  insights,
  insightVotes,
  places,
  users,
} from "../db/schema.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Connection = Db | Tx;
type Insight = typeof insights.$inferSelect;
export type WriteGuard = (insight: Insight | undefined) => void;
export type ReferenceGuard = (valid: boolean) => void;

async function resolveReferences(
  db: Connection,
  input: UpdateInsight,
  validate: ReferenceGuard,
) {
  const categoryRows =
    input.categorySlugs === undefined
      ? undefined
      : await db
          .select()
          .from(categories)
          .where(inArray(categories.slug, input.categorySlugs));
  const cityRows =
    input.citySlugs === undefined
      ? undefined
      : input.citySlugs.length
        ? await db
            .select()
            .from(cities)
            .where(inArray(cities.slug, input.citySlugs))
        : [];
  validate(
    (categoryRows === undefined ||
      categoryRows.length === input.categorySlugs?.length) &&
      (cityRows === undefined || cityRows.length === input.citySlugs?.length),
  );
  return { categoryRows, cityRows };
}

async function replaceAssociations(
  tx: Tx,
  id: string,
  authorId: string,
  input: UpdateInsight,
  refs: Awaited<ReturnType<typeof resolveReferences>>,
) {
  if (refs.categoryRows !== undefined) {
    await tx
      .delete(insightCategories)
      .where(eq(insightCategories.insightId, id));
    await tx
      .insert(insightCategories)
      .values(
        refs.categoryRows.map((row) => ({ insightId: id, categoryId: row.id })),
      );
  }
  if (refs.cityRows !== undefined) {
    await tx.delete(insightCities).where(eq(insightCities.insightId, id));
    if (refs.cityRows.length)
      await tx
        .insert(insightCities)
        .values(
          refs.cityRows.map((row) => ({ insightId: id, cityId: row.id })),
        );
  }
  if (input.places !== undefined) {
    await tx.delete(insightPlaces).where(eq(insightPlaces.insightId, id));
    const ids = input.places.map((place) => place.googlePlaceId);
    if (ids.length) {
      // All transactions acquire unique-index locks in the same order.
      for (const googlePlaceId of [...ids].sort()) {
        await tx
          .insert(places)
          .values({ googlePlaceId, createdBy: authorId })
          .onConflictDoNothing({ target: places.googlePlaceId });
      }
      const rows = await tx
        .select()
        .from(places)
        .where(inArray(places.googlePlaceId, ids));
      const byGoogleId = new Map(
        rows.map((row) => [row.googlePlaceId, row.id]),
      );
      await tx.insert(insightPlaces).values(
        ids.map((googlePlaceId, position) => ({
          insightId: id,
          placeId: byGoogleId.get(googlePlaceId)!,
          position,
        })),
      );
    }
  }
}

async function hydrate(db: Connection, rows: Insight[], viewerId: string) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const authorRows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      cohort: users.cohort,
    })
    .from(users)
    .where(
      inArray(
        users.id,
        rows.map((row) => row.authorId),
      ),
    );
  const categoryRows = await db
    .select({ insightId: insightCategories.insightId, value: categories })
    .from(insightCategories)
    .innerJoin(categories, eq(categories.id, insightCategories.categoryId))
    .where(inArray(insightCategories.insightId, ids))
    .orderBy(asc(categories.sortOrder), asc(categories.slug));
  const cityRows = await db
    .select({ insightId: insightCities.insightId, value: cities })
    .from(insightCities)
    .innerJoin(cities, eq(cities.id, insightCities.cityId))
    .where(inArray(insightCities.insightId, ids))
    .orderBy(asc(cities.sortOrder), asc(cities.slug));
  const placeRows = await db
    .select({
      insightId: insightPlaces.insightId,
      googlePlaceId: places.googlePlaceId,
    })
    .from(insightPlaces)
    .innerJoin(places, eq(places.id, insightPlaces.placeId))
    .where(inArray(insightPlaces.insightId, ids))
    .orderBy(asc(insightPlaces.position));
  const votes = await db
    .select({ insightId: insightVotes.insightId })
    .from(insightVotes)
    .where(
      and(
        eq(insightVotes.userId, viewerId),
        inArray(insightVotes.insightId, ids),
      ),
    );
  return rows.map((row) => ({
    ...row,
    author: {
      ...authorRows.find((author) => author.id === row.authorId)!,
      avatarUrl: null,
    },
    categories: categoryRows
      .filter((entry) => entry.insightId === row.id)
      .map((entry) => entry.value),
    cities: cityRows
      .filter((entry) => entry.insightId === row.id)
      .map((entry) => entry.value),
    places: placeRows
      .filter((entry) => entry.insightId === row.id)
      .map(({ googlePlaceId }) => ({ googlePlaceId })),
    viewerHasUpvoted: votes.some((vote) => vote.insightId === row.id),
  }));
}

export function createInsightRepository(db: Db) {
  return {
    async create(
      authorId: string,
      input: CreateInsight,
      validate: ReferenceGuard,
    ) {
      return db.transaction(async (tx) => {
        const refs = await resolveReferences(tx, input, validate);
        const [row] = await tx
          .insert(insights)
          .values({
            authorId,
            body: input.body,
            title: input.title,
            sourceUrl: input.sourceUrl,
          })
          .returning();
        await replaceAssociations(tx, row!.id, authorId, input, refs);
        return (await hydrate(tx, [row!], authorId))[0]!;
      });
    },
    async detail(id: string, viewerId: string) {
      return db.transaction(
        async (tx) => {
          const rows = await tx
            .select()
            .from(insights)
            .where(eq(insights.id, id));
          return (await hydrate(tx, rows, viewerId))[0];
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async update(
      id: string,
      viewerId: string,
      input: UpdateInsight,
      guard: WriteGuard,
      validate: ReferenceGuard,
    ) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(insights)
          .where(eq(insights.id, id))
          .for("update");
        guard(existing);
        const refs = await resolveReferences(tx, input, validate);
        const [row] = await tx
          .update(insights)
          .set({
            body: input.body,
            title: input.title,
            sourceUrl: input.sourceUrl,
            updatedAt: new Date(),
          })
          .where(eq(insights.id, id))
          .returning();
        await replaceAssociations(tx, id, viewerId, input, refs);
        return (await hydrate(tx, [row!], viewerId))[0]!;
      });
    },
    async delete(id: string, guard: WriteGuard) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(insights)
          .where(eq(insights.id, id))
          .for("update");
        guard(row);
        await tx.delete(insights).where(eq(insights.id, id));
      });
    },
    async vote(id: string, viewerId: string, add: boolean, guard: WriteGuard) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(insights)
          .where(eq(insights.id, id))
          .for("update");
        guard(row);
        const changed = add
          ? await tx
              .insert(insightVotes)
              .values({ insightId: id, userId: viewerId })
              .onConflictDoNothing()
              .returning()
          : await tx
              .delete(insightVotes)
              .where(
                and(
                  eq(insightVotes.insightId, id),
                  eq(insightVotes.userId, viewerId),
                ),
              )
              .returning();
        const upvoteCount =
          row!.upvoteCount + (changed.length ? (add ? 1 : -1) : 0);
        if (changed.length)
          await tx
            .update(insights)
            .set({ upvoteCount })
            .where(eq(insights.id, id));
        return { upvoteCount, viewerHasUpvoted: add };
      });
    },
    async list(viewerId: string, query: FeedQuery, validate: ReferenceGuard) {
      return db.transaction(
        async (tx) => {
          await resolveReferences(
            tx,
            {
              ...(query.city && query.city !== "general"
                ? { citySlugs: [query.city] }
                : {}),
              ...(query.category ? { categorySlugs: [query.category] } : {}),
            },
            validate,
          );
          const filters: SQL[] = [];
          const general = sql`NOT EXISTS (SELECT 1 FROM ${insightCities} WHERE ${insightCities.insightId} = ${insights.id})`;
          if (query.city === "general") filters.push(general);
          else if (query.city) {
            const cityMatch = sql`EXISTS (SELECT 1 FROM ${insightCities} JOIN ${cities} ON ${cities.id} = ${insightCities.cityId} WHERE ${insightCities.insightId} = ${insights.id} AND ${cities.slug} = ${query.city})`;
            filters.push(
              query.q ? sql`(${cityMatch} OR ${general})` : cityMatch,
            );
          }
          if (query.author) filters.push(eq(insights.authorId, viewerId));
          if (query.category)
            filters.push(
              sql`EXISTS (SELECT 1 FROM ${insightCategories} JOIN ${categories} ON ${categories.id} = ${insightCategories.categoryId} WHERE ${insightCategories.insightId} = ${insights.id} AND ${categories.slug} = ${query.category})`,
            );
          const search = sql`websearch_to_tsquery('public.atlas_search', ${query.q ?? ""})`;
          if (query.q) filters.push(sql`${insights.searchVector} @@ ${search}`);
          const where = and(...filters);
          const order =
            query.sort === "top"
              ? [desc(insights.upvoteCount)]
              : query.sort === "relevance"
                ? [sql`ts_rank(${insights.searchVector}, ${search}) DESC`]
                : [];
          const [total] = await tx
            .select({ value: count() })
            .from(insights)
            .where(where);
          // An out-of-range page needs no OFFSET (which could exceed a JS safe integer).
          const offset = (query.page - 1) * query.limit;
          const rows =
            offset >= total!.value
              ? []
              : await tx
                  .select()
                  .from(insights)
                  .where(where)
                  .orderBy(
                    ...order,
                    desc(insights.createdAt),
                    desc(insights.id),
                  )
                  .limit(query.limit)
                  .offset(offset);
          return {
            rows: await hydrate(tx, rows, viewerId),
            total: total!.value,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
