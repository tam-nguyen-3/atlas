# Architecture - Minerva Atlas

## Layers
React never talks directly to PostgreSQL.

```
UI
 ↓
API client
 ↓
HTTP API
 ↓
service/domain logic
 ↓
repository/database
```

## Tech stack
| Area | Choice |
|---|---|
| Frontend | React, Vite, TypeScript |
| Routing | TanStack Router, with search params validated by Zod |
| Server state | TanStack Query |
| UI and forms | Tailwind, shadcn/ui, React Hook Form |
| Backend | Fastify, Node, TypeScript, `fastify-type-provider-zod` |
| API style | REST + JSON |
| Validation | Zod, with schemas shared by frontend and API |
| Database | PostgreSQL, Drizzle ORM, `drizzle-kit` migrations |
| Auth | Better Auth with email and password and its Drizzle adapter; sessions stored in Postgres |
| Search | Postgres full-text search with a `tsvector` column and GIN index, queried with `websearch_to_tsquery` |
| Places | Places API (New) autocomplete (`AutocompleteSuggestion`), loaded through `@vis.gl/react-google-maps` (`useMapsLibrary`), with a shadcn combobox |
| Testing | Vitest, Playwright, and a real Postgres for tests |
| Lint and format | ESLint with `typescript-eslint`, and Prettier |
| CI | GitHub Actions: lint, type checks, tests, build, with Postgres as a service container |

TypeScript is pinned to `~6.0` because `typescript-eslint` 8.72 doesn't support TypeScript 7 (checked on 2026-11-04). Upgrade once it does.

## Repository structure
pnpm workspace:

- `apps/web`
- `apps/api`
- `packages/shared`

## Authentication
- The MVP uses email and password through Better Auth.
- Allow only `minerva.edu` and `uni.minerva.edu` addresses, enforced on the server with an exact, case-insensitive match on the email domain.
- The MVP sends no email, so it doesn't verify addresses or offer self-serve password reset. The domain check alone doesn't prove someone owns the address.
- Rate limit sign-up and sign-in to three attempts per client IP and route in ten seconds, using Better Auth's database-backed limiter in every environment. Other auth routes use 100 attempts per ten seconds. Add `rate_limits` through the normal Drizzle migrations; Better Auth handles atomic consumption and opportunistic expiry cleanup.
- The Fastify bridge overwrites `x-atlas-client-ip` with the connection IP. Better Auth trusts only that header. Fastify proxy trust is disabled; Phase 7 must configure and verify the actual Vercel/Render proxy chain before enabling client-IP forwarding. Do not enable unrestricted proxy trust or accept arbitrary forwarded headers.
- All content routes share a session-protected Fastify route group. Sessions live in Postgres, last seven days by default, and renew daily; cookie caching is disabled. Renewal cookies are forwarded to the browser.
- State-changing HTTP requests require an exact `WEB_ORIGIN` match, even when signed out. Credentialed CORS permits that origin; preflights are public. Production origins must use HTTPS and cookies are Secure, HttpOnly, and SameSite=Lax.
- Only email sign-up, email sign-in, sign-out, and session lookup are exposed under `/api/auth/*`. Better Auth retains its native response/error shapes; Atlas endpoints use the shared error envelope. Profile updates go through `/api/me` so other auth routes cannot bypass validation.
- Sign-up validates the domain and trimmed 1–100 character name before creating a user; user/account/session creation uses a transaction. Cohort and avatar start null, and sign-up cannot set them.
- Keep the API stateless so it can scale horizontally.

### API runtime
- The application factory accepts a database and configuration without opening a listening socket. The executable validates environment variables, starts Fastify, and closes requests and the Postgres pool on SIGINT/SIGTERM.
- Auth secrets must contain at least 32 characters and must not be placeholder values. `BETTER_AUTH_URL` and `WEB_ORIGIN` are exact HTTP(S) origins without paths or trailing slashes. For the production rewrite, both use the public website origin.
- All API responses send `Cache-Control: no-store`, including auth and errors. `GET /api/health` is a public process health check and does not query the database.
- Profile, reference-data, and insight requests follow route → service → repository. Shared Zod schemas define request and response contracts. Insight writes are transactional; edits, deletes, and votes lock the insight row. Feed/detail reads use repeatable-read snapshots, and association filters use EXISTS to avoid duplicate insights and totals.

### Automated tests
- Playwright signs in through the normal form with a seeded test user.
- Seed that user only in test environments, never in production.

## Search notes
- A generated `search_vector` can't read from another table, so tagged place names aren't searchable by default.
- Search uses the `public.atlas_search` text search configuration: a copy of `simple` that also runs `unaccent`, so `cafe` finds `café` and the reverse. Query it with `websearch_to_tsquery('public.atlas_search', q)`.
- A generated column can't call `unaccent()` directly because it isn't immutable, but it can use this configuration through two-argument `to_tsvector`. The first migration creates it, which needs the `unaccent` extension.
- Known limits, covered by `apps/api/src/db/search.test.ts`:
  - Word endings stay distinct in every language and common words remain searchable.
  - Postgres doesn't segment Japanese, so a run of Japanese text is one token and part of a run won't match. Romanised text works.
- Add `pg_trgm` only if testing shows typos are a real problem.

## Places notes
Checked against Google's docs on 2026-11-04.

- Use Places API (New). Google's docs say the legacy API can no longer be enabled for new projects as of October 2026.
- Restrict the browser key by site and API.
- Use one session token per autocomplete session and end the session with a Place Details call. Otherwise each autocomplete request is billed individually.
- Showing Places content without a Google map is allowed, but it needs visible attribution: the Google Maps logo, or the text "Google Maps" where space is limited. Follow Google's size and contrast rules.
- Don't show Places content on a non-Google map.
- Store only place IDs, and fetch names and addresses in the browser when an insight's details are shown. Keep them in memory for the session only, so repeat views don't cost another call.
- To limit cost, the feed shows a place count rather than place cards. If a lookup fails or the quota runs out, show a "View on Google Maps" link instead.
- End the autocomplete session with Essentials fields only, because Google bills a session-ending call with Pro fields at a higher tier.
- Place IDs can be stored indefinitely. Google recommends refreshing any older than 12 months, and a `NOT_FOUND` response means the ID is obsolete.
- Link to a place with a Maps URL, which needs no API key: `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<id>`.

## Deployment (free tiers)
| Layer | Service |
|---|---|
| Frontend | Vercel Hobby |
| API | Docker container on Render's free tier |
| Database | Supabase free tier, used only as Postgres |
| CI | GitHub Actions |

- **Cookies:** a Vercel rewrite sends `/api/*` to Render, so the browser sees one site and login cookies work without a custom domain.
- **Caching:** new Vercel projects honour cache headers on rewrites, so API responses must send `Cache-Control: no-store`. Otherwise one user's data could be cached for others.
- **Supabase:** disable the Data API, and connect through the shared pooler in session mode (port 5432). Render has no outbound IPv6 and Supabase's free direct connection is IPv6, so the direct connection won't work.
- **Migrations:** run them as a deliberate deployment step from your machine or CI, because Render's free tier has no shell or one-off jobs.

### Known free-tier limits
Checked against each provider's docs on 2026-11-04. Limits change, so check again before the pilot.

- **Render:**
  - The free service sleeps after 15 minutes idle and takes about a minute to wake. Open the app to wake it before demos and test sessions. Pilot users may still hit this delay.
  - It includes 750 instance hours a month, enough for one service. If they run out, or bandwidth does with no payment method on file, services are suspended until next month.
  - Local files don't persist, and SMTP ports are blocked, so a later email provider must use an HTTP API.
- **Supabase:**
  - The free plan includes 500 MB of database, 5 GB of egress, and 2 active projects.
  - Projects pause after 1 week of inactivity, so check the project before demos and during the pilot.
  - There are no automatic backups on the free plan.
- **Vercel Hobby:**
  - Non-commercial use only.
  - It includes 100 GB of data transfer, 10 GB of origin transfer, and 1 million CDN requests. Going over can mean waiting up to 30 days.
- **Google:**
  - Google requires a billing account for its Maps APIs, even when usage stays within free allowances. Set quotas and budget alerts.
  - Free monthly caps: Autocomplete Requests 10,000, Place Details Essentials 10,000, Place Details Pro 5,000.
  - `displayName` is a Pro field, at $17 per 1,000 calls after the free cap. `formattedAddress` is Essentials.

## Later iterations
- Google sign-in through Better Auth
- 2-step verification for `uni.minerva.edu` accounts that use email and password
- An email provider for verification and password reset
- Cloudflare R2 for media uploads
- The Google Maps map view through `@vis.gl/react-google-maps`
- `pg_trgm`, if needed
