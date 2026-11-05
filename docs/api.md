# REST APIs for Minerva Atlas

## Conventions
- Base path is `/api`, with JSON requests and responses and ISO 8601 UTC timestamps.
- Authentication uses the Better Auth session cookie. Every route requires a session unless marked public.
- Request and response schemas are Zod schemas in `packages/shared`.
- State-changing routes check the request's `Origin`, since authentication relies on cookies.
- Errors use one shape: `{ "error": { "code", "message", "details"? } }`.

| Status | Meaning |
|---|---|
| 400 | Invalid input, including an unknown city or category |
| 401 | No valid session |
| 403 | Signed in, but not the author |
| 404 | Resource not found |

## Endpoint summary
| Method | Path | Purpose |
|---|---|---|
| `*` | `/api/auth/*` | Better Auth routes for email sign-up, sign-in, and sign-out, public |
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

## Insights

### `GET /api/insights`
| Param | Values | Notes |
|---|---|---|
| `city` | City slug or `general` | Required unless `author=me` |
| `category` | Category slug | Optional, returns insights that include this category |
| `q` | Search text | Optional, parsed with `websearch_to_tsquery` |
| `sort` | `newest`, `top`, `relevance` | `relevance` requires `q` |
| `author` | `me` | Optional, lists your own insights |
| `page` | Integer from 1 | Default 1 |
| `limit` | 1-50 | Default 20 |

- **Default sort:** `relevance` when `q` is present, otherwise `newest`.
- **City slug:** returns that city's insights. With `q`, it also includes insights with no city.
- **`general`:** returns only insights with no city, with or without `q`.
- **`author=me` without `city`:** returns all your insights, whatever their cities.
- **Stable order:** every sort breaks ties by `created_at`, then `id`.
- **Response:** `{ items, page, limit, total }`.
- **Each item:** id, title, bodyPreview, categories, cities, placeCount, author, upvoteCount, viewerHasUpvoted, createdAt, updatedAt.
- **Offset limitation:** items can repeat or be skipped between pages when insights are added or removed.

### `GET /api/insights/:id`
Returns id, title, body, sourceUrl, categories, cities, places (each with `googlePlaceId`, in `position` order), author (id, displayName, cohort, avatarUrl), upvoteCount, viewerHasUpvoted, isAuthor, createdAt, and updatedAt.

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

- `body`, `categorySlugs`, and `citySlugs` are required. `categorySlugs` needs at least one category. An empty `citySlugs` means General.
- The client prefills `citySlugs` with the selected city, so the API doesn't track selection.
- `places` array order sets `position`. Places are created or reused by `googlePlaceId` when the insight is saved.
- `sourceUrl` accepts only `http` and `https`.
- Returns 201 with the insight details.

Suggested limits: body 5,000 characters, title 120, up to 10 cities, up to 5 places.

### `PATCH /api/insights/:id`
- Accepts any subset of the `POST` fields.
- `categorySlugs`, `citySlugs`, and `places` replace the whole list. `categorySlugs` can't be empty.
- `title` and `sourceUrl` can be `null` to clear them.
- Returns 403 for non-authors.

### `DELETE /api/insights/:id`
Permanently deletes the insight. Returns 204, or 403 for non-authors.

## Places
There are no place endpoints. Autocomplete calls Google directly from the browser, as in `docs/architecture.md`, and the selected places are saved through the insight routes. The API stores and returns only place IDs; the browser fetches names and addresses from Google when it shows them.

## Voting
`PUT` and `DELETE` on `/api/insights/:id/vote` can be safely repeated and return `{ upvoteCount, viewerHasUpvoted }`. The vote row and `upvote_count` change in one transaction. Authors can upvote their own insights.

## Profile
`GET /api/me` returns id, email, displayName, cohort, and avatarUrl.

`PATCH /api/me` accepts `displayName` and `cohort`. `cohort` uses the format `M27` and can be `null`. Email can't be edited. `avatarUrl` is `null` until Google sign-in is added.
