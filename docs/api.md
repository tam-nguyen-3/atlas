# REST APIs for Minerva Atlas

## Conventions
- Base path is `/api`, with JSON requests and responses and ISO 8601 UTC timestamps.
- Authentication uses the Better Auth session cookie. Every route requires a session unless marked public.
- Atlas request and response schemas are Zod schemas in `packages/shared`; Better Auth owns the schemas under `/api/auth/*`.
- State-changing routes, including sign-up and sign-in, require `Origin` to exactly match `WEB_ORIGIN`. Missing, `null`, or mismatched origins return 403. CORS preflights do not require a session.
- Atlas errors use `{ "error": { "code", "message", "details"? } }`. Exception: `/api/auth/*` preserves Better Auth's native responses for client compatibility (usually `{ "code", "message" }`; its rate-limit response contains `message`).
- All responses, including errors, send `Cache-Control: no-store`.

| Status | Meaning |
|---|---|
| 400 | Invalid input, including an unknown city or category |
| 401 | No valid session |
| 403 | Forbidden origin, rejected sign-up domain, or signed in but not the author |
| 404 | Resource not found |
| 422 | Better Auth duplicate email or credential validation failure |
| 429 | Auth rate limit exceeded; Better Auth returns `X-Retry-After` in seconds |
| 500 | Unexpected failure; internal details are not returned |

## Endpoint summary
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/sign-up/email` | Register and create a session, public |
| POST | `/api/auth/sign-in/email` | Sign in, public |
| POST | `/api/auth/sign-out` | Revoke the current session |
| GET | `/api/auth/get-session` | Better Auth session lookup; returns `null` when signed out |
| GET | `/api/health` | Health check for Render, public |
| GET | `/api/me` | Current user |
| PATCH | `/api/me` | Update display name or cohort |
| GET | `/api/cities` | Cities in `sort_order` |
| GET | `/api/categories` | Categories in `sort_order` |
| GET | `/api/insights` | List and search insights |
| POST | `/api/insights` | Create an insight |
| GET | `/api/insights/:id` | Insight details |
| PATCH | `/api/insights/:id` | Edit own insight |
| DELETE | `/api/insights/:id` | Permanently delete own insight |
| PUT | `/api/insights/:id/vote` | Add upvote |
| DELETE | `/api/insights/:id/vote` | Remove upvote |

## Authentication and health
- Sign-up accepts Better Auth's `name`, `email`, and `password` fields. Names are trimmed and must contain 1–100 characters. Only exact, case-insensitive `minerva.edu` and `uni.minerva.edu` email domains are accepted; rejection returns 403 with `EMAIL_DOMAIN_NOT_ALLOWED`.
- Passwords use Better Auth's 8–128 character limits. Sign-up signs the user in immediately; email verification and password reset are not available.
- Initial cohort and avatar are null. Sign-up rejects `cohort`, `image`, and `avatarUrl`; use `PATCH /api/me` for cohort changes.
- Sign-in accepts `email` and `password`. Auth responses retain Better Auth's `name`/`image` field names; `/api/me` uses `displayName`/`avatarUrl`.
- Both credential routes accept the optional Better Auth `rememberMe` flag. The default persistent session lasts seven days and renews after a day of activity. Session data is read from Postgres, without cookie caching.
- Each credential route permits three attempts per client IP in a ten-second rolling inactivity window; other exposed auth routes permit 100. Counters are shared in Postgres, and rejected input also counts. A successful attempt moves the window forward; blocked attempts do not.
- Only the auth routes listed above are exposed. Other Better Auth endpoints return 404.
- `GET /api/health` returns `200 { "status": "ok" }`. It checks that the server is running, without querying Postgres.

## Reference data

Both endpoints require a session and return 200 with a JSON array, without an envelope:

| Endpoint | Object fields |
|---|---|
| `GET /api/cities` | `{ id, slug, name, country, timezone, sortOrder }` |
| `GET /api/categories` | `{ id, slug, name, icon, sortOrder }` |

- `id` is a UUID string; `sortOrder` is an integer; all other fields are non-null strings. `icon` is the seeded Lucide icon name.
- Arrays are ordered by `sortOrder` ascending, then `slug` ascending. Insight responses reuse these exact objects and ordering for their `cities` and `categories` arrays.
- General is not a city object and is never returned by `/api/cities`. An insight with `cities: []` is General.

## Insights

### Insight response shapes

All listed fields are present. Fields are non-null unless explicitly marked nullable. Atlas `id` fields are UUID strings; `googlePlaceId` is an opaque string. Timestamps are ISO 8601 UTC strings.

The shared author object is `{ id, displayName, cohort, avatarUrl }`: `displayName` is a string, `cohort` is a string matching `^M[0-9]{2}$` or `null`, and `avatarUrl` is always `null` until Google sign-in is added. Author objects never expose email.

| Field | Type / meaning | Included in |
|---|---|---|
| `id` | Insight UUID | Feed and details |
| `title` | String or `null` | Feed and details |
| `categories` | Array of category objects; at least one | Feed and details |
| `cities` | Array of city objects; empty means General | Feed and details |
| `author` | Author object defined above | Feed and details |
| `upvoteCount` | Nonnegative integer | Feed and details |
| `viewerHasUpvoted` | Boolean for the signed-in viewer | Feed and details |
| `createdAt`, `updatedAt` | Timestamps | Feed and details |
| `bodyPreview` | First 280 Unicode code points of the stored body, or the whole body if shorter; no added ellipsis | Feed only |
| `placeCount` | Nonnegative integer count of tagged places | Feed only |
| `body` | Full stored body string | Details only |
| `sourceUrl` | Absolute HTTP(S) URL string or `null` | Details only |
| `places` | Array of `{ googlePlaceId: string }`, in saved `position` order; empty when none | Details only |
| `isAuthor` | Whether the signed-in viewer is the author | Details only |

Create and edit responses use the details shape. Feed items do not expose place IDs or full detail-only fields.

### Insight write validation

These rules apply to POST and PATCH insight bodies:

- Trim surrounding whitespace from all string inputs, including slugs and place IDs, before validation and duplicate checks. Preserve internal body formatting, including line breaks.
- Reject blank strings, unknown fields (including inside place objects), duplicate category/city slugs or place IDs, and unknown city/category slugs with 400. Do not silently remove duplicates or convert blank strings to `null`.
- Reject malformed UUID path parameters with 400 on all insight and vote routes. A well-formed UUID that does not identify an insight returns 404.

| Field | Validation | POST requirement/default |
|---|---|---|
| `body` | String, 1–5,000 characters after trimming | Required |
| `categorySlugs` | Nonempty array of distinct existing category slugs | Required |
| `citySlugs` | Array of at most 10 distinct existing city slugs; `[]` means General; `general` is not a stored city slug | Required |
| `title` | String, 1–120 characters after trimming, or `null` | Optional; defaults to `null` |
| `sourceUrl` | Absolute URL using only `http` or `https`, or `null` | Optional; defaults to `null` |
| `places` | Array of at most 5 `{ googlePlaceId }` objects, each containing a distinct nonempty string ID | Optional; defaults to `[]` |

Only `title` and `sourceUrl` accept `null`. Every create or edit is atomic: the insight, association changes, and any new reusable place records all succeed together or are rolled back. Successful edits set `updatedAt`; votes do not.

### `GET /api/insights`
| Param | Values | Notes |
|---|---|---|
| `city` | City slug or `general` | Required unless `author=me` |
| `category` | Category slug | Optional, returns insights that include this category |
| `q` | Search text | Optional; trim whitespace and treat blank text as absent |
| `sort` | `newest`, `top`, `relevance` | `relevance` requires a nonempty `q` |
| `author` | `me` | Optional, lists your own insights |
| `page` | Integer from 1 | Default 1 |
| `limit` | 1-50 | Default 20 |

- **Default sort:** `relevance` when `q` is present, otherwise `newest`.
- **City slug:** returns that city's insights. With `q`, it also includes insights with no city.
- **`general`:** returns only insights with no city, with or without `q`.
- **`author=me` without `city`:** returns all your insights, whatever their cities.
- **Combined filters:** category and author constraints are applied together with city/search scope. For example, `author=me&city=tokyo&q=cafe` searches only your Tokyo and General insights; adding `category=food` requires those insights to include Food too.
- **Search:** match title/body using `websearch_to_tsquery('public.atlas_search', q)` against the existing weighted search vector (title weight A, body weight B). Search is accent-insensitive, keeps word endings distinct, and does not search tagged place names; see [search notes](architecture.md#search-notes) for language limitations.
- **Validation:** reject unknown query parameters, unknown city/category slugs, invalid enum values, missing required city scope, and invalid page/limit integers with 400. Explicit `sort=relevance` without a nonempty query also returns 400.
- **Order:** `newest` uses `created_at` descending; `top` uses `upvote_count` descending; `relevance` uses weighted full-text rank descending. Ties use `created_at` descending, then `id` descending (for newest, creation time is already the primary sort key).
- **Response:** 200 with `{ items, page, limit, total }`. `items` contains the [feed shape](#insight-response-shapes); `page` and `limit` are the effective integer values after defaults; `total` is the nonnegative integer count of distinct matching insights before pagination.
- **Pagination:** each insight appears at most once in a response, regardless of how many categories/cities it has. Pages beyond the result set return `items: []` with the matching `total`; no matches return `total: 0`.
- **Offset limitation:** stable ordering applies to unchanged data. Items can repeat or be skipped between requests when insights are added, removed, edited, or reordered by votes.

### `GET /api/insights/:id`
Returns 200 with the [details shape](#insight-response-shapes), or 404 if the insight does not exist. Any signed-in user may read an insight.

### `POST /api/insights`
```json
{
  "body": "Required text",
  "categorySlugs": ["food", "travel"],
  "citySlugs": ["buenos-aires"],
  "title": "Optional",
  "sourceUrl": "https://example.com",
  "places": [{ "googlePlaceId": "..." }]
}
```

- Apply the [write validation and defaults](#insight-write-validation). The signed-in user becomes the author; clients cannot supply an author ID.
- The client prefills `citySlugs` with the selected city, so the API doesn't track selection.
- `places` array order sets `position`. Places are created or reused by `googlePlaceId` when the insight is saved.
- Returns 201 with the insight details.

### `PATCH /api/insights/:id`

- Accepts a nonempty subset of the POST fields under the same write validation. An empty object returns 400. Omitted fields remain unchanged; POST defaults are not applied to PATCH.
- `categorySlugs`, `citySlugs`, and `places` replace the whole list. `categorySlugs` cannot be empty; `citySlugs: []` makes the insight General; `places: []` removes all place associations.
- `title` and `sourceUrl` can be `null` to clear them; blank strings are rejected.
- Returns 200 with the updated insight details, 403 for a non-author, or 404 if the insight does not exist.

### `DELETE /api/insights/:id`
Permanently deletes the insight and cascades to its category, city, place, and vote associations. Reusable place records remain. Returns 204 without a body, 403 for a non-author, or 404 if the insight does not exist. Repeating a successful deletion returns 404.

## Places
There are no place endpoints. Autocomplete calls Google directly from the browser, as in `docs/architecture.md`, and the selected places are saved through the insight routes. The API stores and returns only place IDs; the browser fetches names and addresses from Google when it shows them.

- Create or reuse a place by its unique `googlePlaceId`, including when simultaneous saves reference the same ID. Place IDs are opaque nonempty strings; the API does not call Google to verify them.
- Save insight-place associations in the supplied array order and return them in that order in details. Reordering an edited array changes that order.
- Names, addresses, and other Google detail fields are not accepted in insight requests. The feed returns only a place count; details return only the ordered place IDs.

## Voting
`PUT` and `DELETE` on `/api/insights/:id/vote` require a session and the mutation Origin check. Authors can upvote their own insights.

- Both return 200 with `{ upvoteCount, viewerHasUpvoted }`: a nonnegative integer count and a boolean reflecting the viewer's vote after the operation (`true` for PUT, `false` for DELETE).
- Adding an existing vote or removing an absent vote is a successful no-op and returns the same response shape. Missing insights return 404 for either method.
- The vote row and `upvote_count` change in one transaction. Repeated and concurrent requests must preserve one vote per user/insight and keep the count equal to the number of stored votes, without negative counts or lost updates.
- Voting never changes the insight's `updatedAt`.

## Profile
`GET /api/me` returns id, email, displayName, cohort, and avatarUrl.

`PATCH /api/me` accepts a nonempty subset of `displayName` and `cohort`, and returns the updated profile with status 200. Names are trimmed and must contain 1–100 characters. Cohort must match `^M[0-9]{2}$` (for example `M27`) or be `null` to clear it. Unknown fields, including email and avatar changes, are rejected with 400. Successful changes update `updated_at`; omitted fields are unchanged. `avatarUrl` is always `null` until Google sign-in is added.
