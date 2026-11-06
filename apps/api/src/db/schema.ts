import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  bigint,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

// Set updated_at explicitly rather than with $onUpdate, which would also fire
// on the upvote_count update and make every vote look like an edit.
const createdAt = () => timestamptz("created_at").notNull().defaultNow();
const updatedAt = () => timestamptz("updated_at").notNull().defaultNow();

// Better Auth maps its `name` to displayName and `image` to avatarUrl. Its
// other tables below use its standard columns.
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    displayName: text("display_name").notNull(),
    cohort: text("cohort"),
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_lower_uq").on(sql`lower(${table.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

// Stores password hashes, in the row whose providerId is "credential".
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("accounts_user_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_uq").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: id(),
    key: text("key").notNull().unique(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (table) => [index("rate_limits_last_request_idx").on(table.lastRequest)],
);

export const cities = pgTable("cities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  timezone: text("timezone").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const places = pgTable("places", {
  id: id(),
  googlePlaceId: text("google_place_id").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

// public.atlas_search is created in the first migration. It ignores accents,
// which a generated column can't do by calling unaccent() directly.
const searchVectorSql: SQL = sql`
  setweight(to_tsvector('public.atlas_search'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('public.atlas_search'::regconfig, body), 'B')
`;

export const insights = pgTable(
  "insights",
  {
    id: id(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title"),
    body: text("body").notNull(),
    sourceUrl: text("source_url"),
    upvoteCount: integer("upvote_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(searchVectorSql),
  },
  (table) => [
    index("insights_search_vector_idx").using("gin", table.searchVector),
  ],
);

export const insightCategories = pgTable(
  "insight_categories",
  {
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (table) => [
    primaryKey({ columns: [table.insightId, table.categoryId] }),
    index("insight_categories_category_idx").on(table.categoryId),
  ],
);

export const insightCities = pgTable(
  "insight_cities",
  {
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
  },
  (table) => [
    primaryKey({ columns: [table.insightId, table.cityId] }),
    index("insight_cities_city_idx").on(table.cityId),
  ],
);

export const insightPlaces = pgTable(
  "insight_places",
  {
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.insightId, table.placeId] })],
);

// user_id blocks deleting a user who has voted. Cascading would remove votes
// without lowering upvote_count.
export const insightVotes = pgTable(
  "insight_votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.insightId] })],
);
