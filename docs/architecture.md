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
- Rate limit sign-up and sign-in.
- All content routes require a session.
- Keep the API stateless so it can scale horizontally.

### Automated tests
- Playwright signs in through the normal form with a seeded test user.
- Seed that user only in test environments, never in production.

## Search notes
- A generated `search_vector` can't read from another table, so tagged place names aren't searchable by default.
- Check accent handling and the text search configuration early.
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
