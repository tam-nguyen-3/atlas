# Data schema
- users: id, email, email_verified, display_name, cohort (optional), avatar_url (optional), created_at, updated_at
  - CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
  - Align this table with Better Auth's user model. Better Auth also adds its own session, account, and verification tables, and stores password hashes in its account table.
  - `cohort` is `M` plus the two-digit graduation year, such as `M27` for 2027.
  - `avatar_url` stays empty until Google sign-in is added.
- cities: id, slug, name, country, timezone, sort_order
- categories: id, slug, name (display name), icon, sort_order
- places: id, google_place_id, created_by (ref to users(id)), created_at
  - UNIQUE (google_place_id)
  - No city link, so any insight can tag any place.
  - Store only the place ID. Google allows storing `google_place_id` indefinitely, but its Maps JavaScript policies treat keeping a place name beyond the user session as scraping. The browser fetches names and addresses when it shows them.
- insights: id, author_id (users(id)), title (optional), body (required), source_url (optional), upvote_count, created_at, updated_at, search_vector (for tsvector)
- insight_categories: insight_id (insights(id)), category_id (categories(id))
  - PRIMARY KEY (insight_id, category_id)
  - CREATE INDEX insight_categories_category_idx ON insight_categories (category_id);
  - Every insight needs at least one row, enforced by the API.
- insight_cities: insight_id (insights(id)), city_id (cities(id))
  - PRIMARY KEY (insight_id, city_id)
  - CREATE INDEX insight_cities_city_idx ON insight_cities (city_id);
  - Zero rows means the insight is General.
- insight_places: insight_id (insights(id)), place_id (places(id)), position
  - PRIMARY KEY (insight_id, place_id)
- insight_votes: user_id (users(id)), insight_id (insights(id)), created_at
  - PRIMARY KEY (user_id, insight_id)

Deleting an insight cascades to its insight_categories, insight_cities, insight_places, and insight_votes rows.

## Seed data
General is not a city row; it means an insight has no cities.

| sort_order | City | Slug | Country | Timezone |
|---|---|---|---|---|
| 1 | San Francisco | `san-francisco` | United States | `America/Los_Angeles` |
| 2 | Tokyo | `tokyo` | Japan | `Asia/Tokyo` |
| 3 | Buenos Aires | `buenos-aires` | Argentina | `America/Argentina/Buenos_Aires` |

| sort_order | Category | Slug |
|---|---|---|
| 1 | Food | `food` |
| 2 | Transportation | `transportation` |
| 3 | Living | `living` |
| 4 | Health & Fitness | `health-fitness` |
| 5 | Shopping | `shopping` |
| 6 | Travel | `travel` |
| 7 | Study & Work | `study-work` |
| 8 | Activities | `activities` |
