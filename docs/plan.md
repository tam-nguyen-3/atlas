# Plan - Minerva Atlas

Tracks everything needed to take Minerva Atlas from specs to pilot. Scope and behaviour live in [product.md](product.md), [architecture.md](architecture.md), [api.md](api.md), and [schema.md](schema.md); this file only tracks the work.

- **Agent**: steps the coding agent can do in this repo.
- **You**: steps only you can do, such as accounts, secrets, decisions, content, and people.
- Tick a box when the step is done. If a decision changes the scope, update the spec it affects too.

## Phase 0: Decisions and accounts

### You: decide
Written specs currently win where the wireframes differ.
- [x] Keep the "Agent" and "Discover" nav items, linking to empty placeholders
- [x] Leave out comments, replies, and media for now
- [x] Upvotes only, no downvotes
- [x] An insight can have several categories
- [x] Launch cities, in order: San Francisco, Tokyo, Buenos Aires (see [schema.md](schema.md))
- [x] Launch categories: Food, Transportation, Living, Health & Fitness, Shopping, Travel, Study & Work, Activities (see [schema.md](schema.md))
- [x] Cohort format: `M27` for graduating in 2027, `M28`, and so on
- [x] MVP sign-in uses email and password; Google sign-in comes later
- [x] MVP sign-up doesn't verify that an email address is real, and there's no self-serve password reset
- [x] Check whether Minerva needs to approve a pilot or use of its name
- [x] Sign-up, sign-in, profile, "my insights", edit, and delete have no wireframes: the agent follows the existing style, and you review them in Phase 5

Wireframe differences the agent will handle this way unless you say otherwise:
- The form's "tags (optional)" becomes a required category picker
- Cities and source URL go under the form's "more details"
- Sort options go behind the search bar's filter icon
- Authors show a placeholder avatar, since there's no avatar source yet
- "create insight" and the floating button both open the same form
- Insight details open in a modal, without the reply box
- The feed shows a place count, and place cards appear only in insight details, to limit Google lookup costs

### You: set up accounts
- [x] Create accounts: GitHub, Vercel, Render, Supabase, Google Cloud (for Places)

### Agent
- [x] Compare all wireframes with the specs and add any other conflicts to the list above
- [x] Read Google's current terms and summarise: storing `display_name`, attribution without a map (see [architecture.md](architecture.md))
- [x] Confirm current free-tier limits on Vercel, Render, Supabase, and Google Maps (see [architecture.md](architecture.md))

### You: after the agent's review
- [x] Show place names and addresses by live lookup: store only the place ID and fetch details when shown

## Phase 1: Repo foundation

### Agent
- [x] Initialise git and add `.gitignore`
- [x] Set up the pnpm workspace: `apps/web`, `apps/api`, `packages/shared`
- [x] Configure TypeScript, a linter and formatter, and Vitest
- [x] Add local Postgres for development and tests
- [x] Add `.env.example` listing every variable, with no real values
- [x] Add a GitHub Actions workflow: lint, type checks, tests, build, Postgres service container
- [x] Add a README with setup steps

### You
- [x] Create the GitHub repo and give the agent the remote to push to
- [x] Review the first PR and confirm CI passes on GitHub

## Phase 2: Database

Completed locally on `main` in commit `1278be6`.

### Agent
- [x] Define the Drizzle schema and first migration from `schema.md`, aligned with Better Auth's tables
- [x] Add the generated `search_vector` column and GIN index
- [x] Check accent handling and the text search configuration early
- [x] Add idempotent seed scripts for the cities and categories in `schema.md`, and choose category icons
- [x] Add a seeded test user with a password, for test environments only
- [x] Verify migrations against a fresh Postgres database and rerun them to check migration tracking
- [x] Verify seeds, Better Auth credential sign-in, constraints, deletion cascades, and accent-folding search with distinct word endings
- [x] Pass all 46 tests, formatting checks, lint, type checks, and build locally

## Phase 3: Authentication

Completed locally, with manual Postman verification confirmed on 2026-11-06. Better Auth keeps its native error format under `/api/auth/*`; Atlas routes use the shared error envelope. The frontend remains in Phase 5.

### Agent
- [x] Set up Fastify with `fastify-type-provider-zod`, the shared error shape, and `GET /api/health`
- [x] Integrate Better Auth with email and password, the Drizzle adapter, and Postgres sessions
- [x] Enforce allowed domains on the server at sign-up: `minerva.edu`, `uni.minerva.edu`
- [x] Rate limit sign-up and sign-in with shared Postgres counters and a Drizzle migration
- [x] Require a session on all content routes and check `Origin` on state-changing routes
- [x] Add `GET` and `PATCH /api/me`, validating the cohort format
- [x] Add shared health/profile/error contracts, validated startup configuration, API scripts, and uncached responses
- [x] Document the native auth error exception and local cookie-jar smoke test
- [x] Pass all 96 tests, formatting checks, lint, type checks, and build; verify compiled-server health and graceful shutdown

### You
- [x] Sign up with an allowed address and confirm a personal Gmail address is rejected

## Phase 4: Core API

Completed locally on 2026-11-06. All 168 tests, formatting, lint, type checks, and build passed, along with the two-user HTTP sequence documented in the README (`pnpm smoke:api`). No schema migration or API scope change was needed. Next up is Phase 5: Frontend.

### Agent

#### Contracts and reference data

- [x] Add core-content Zod request and response schemas in `packages/shared`, following [reference data](api.md#reference-data), [insight response shapes](api.md#insight-response-shapes), and [write validation](api.md#insight-write-validation) (health/profile/error schemas are in place)
- [x] Add shared-schema tests for required fields, limits, trimming, nullability, duplicate selections, unknown fields, empty patches, UUID parameters, and feed query validation
- [x] Add authenticated `GET /api/cities` and `GET /api/categories` with the specified response shapes and ordering

#### Insight writes and details

- [x] Add insight creation and detail retrieval through route → service → repository, following the [insight contract](api.md#insights)
- [x] Add author-only editing, including omitted-field preservation, optional-value clearing, and whole-list association replacement
- [x] Save and reuse ordered place IDs through insight writes, following [Places](api.md#places)
- [x] Make insight writes atomic and verify rollback leaves no partial insight, association, or place changes
- [x] Add author-only hard deletion and verify join-table/vote cascades, retained place records, and missing-resource behavior
- [x] Add real-Postgres tests for CRUD validation, ownership, association replacement, response shapes, and place ordering/reuse

#### Feed and search

- [x] Add feed filtering for city/General, category, and `author=me`, including their combinations, following [list and search](api.md#get-apiinsights)
- [x] Add full-text search with the existing search configuration, query normalization, and specified default/explicit sorting
- [x] Add stable pagination, distinct matching totals, empty out-of-range pages, and viewer-specific vote state
- [x] Verify feed previews/counts and detail-only fields against the [response shapes](api.md#insight-response-shapes)
- [x] Add real-Postgres tests for city versus General browsing/search, combined filters, accent handling, sort ties, duplicate-free items/totals, and pagination

#### Voting

- [x] Add idempotent vote add/remove routes with transactional vote rows and counts, following [Voting](api.md#voting)
- [x] Add real-Postgres tests for repeated and concurrent vote requests, count consistency, self-voting, missing insights, and unchanged insight edit timestamps

#### Verification

- [x] Verify sessions, mutation Origin checks, shared errors, and `Cache-Control: no-store` across all new endpoints, including failure responses
- [x] Run all tests, formatting checks, lint, type checks, and build
- [x] Document and run a local API smoke-test sequence covering reference data, create, browse/search, details, edit, voting, ownership rejection, and delete
- [x] Reconcile the implemented behavior with the API spec and mark completed Phase 4 steps

## Phase 5: Frontend

### Agent
- [ ] Set up Vite, React, TanStack Router and Query, Tailwind, and shadcn/ui
- [ ] Add the API client and app shell, with "Agent" and "Discover" nav items linking to empty placeholders
- [ ] Build sign-up and sign-in, including the rejected-domain state
- [ ] Build city selection, including General
- [ ] Build the feed: browse, search, category filter, sort, pagination
- [ ] Build insight details with upvoting
- [ ] Build create and edit with React Hook Form and multi-select categories, plus delete confirmation
- [ ] Build the profile (display name, cohort) and "my insights" views
- [ ] Add Playwright tests for the core flows, signing in with the seeded test user

### You
- [ ] Review the screens against your wireframes and give feedback

## Phase 6: Google Places

### You
- [ ] Add a billing account to Google Cloud and enable Places API (New) and the Maps JavaScript API
- [ ] Create the browser key, restricted by site and to those two APIs
- [ ] Set quotas and budget alerts

### Agent
- [ ] Build the places combobox with Places API (New) and `@vis.gl/react-google-maps`, using session tokens
- [ ] Fetch place names and addresses live in insight details, with Google Maps attribution, a link to each place, and a fallback link if the lookup fails
- [ ] Make place tagging optional, so insights still work without it

## Phase 7: Deployment

### You
- [ ] Create the Supabase project, disable the Data API, and enter its session pooler connection details
- [ ] Create the Render service and set its secrets
- [ ] Create the Vercel project and set its environment variables
- [ ] Add production URLs to the Maps key restrictions
- [ ] Approve and run production migrations and seeds as a deliberate step, from your machine or CI
  - The first migration creates the `unaccent` extension, which hasn't been run on Supabase yet, so check that it succeeds there.

### Agent
- [ ] Add the API Dockerfile and Render health check configuration
- [ ] Add the Vercel rewrite from `/api/*` to Render, and send `Cache-Control: no-store` on API responses
  - API cache headers are in place from Phase 3; verify they survive the rewrite.
- [ ] Configure and verify trusted proxy handling for the Vercel/Render chain so auth rate limits use the real client IP without trusting client-supplied headers
- [ ] Connect the API to Supabase through the shared pooler in session mode, with a small connection pool
- [ ] Document the deploy and migration steps in the README

### You: production smoke test
- [ ] Sign up, sign in, create, search, upvote, tag a place, edit, and delete on the live site
- [ ] Sign in again after Render has slept for 15+ minutes, to confirm the wake-up delay doesn't break the request

## Phase 8: Pilot

### You
- [ ] Set the pilot's goal, participants, and dates
- [ ] Add starter insights so the feed isn't empty on day one
- [ ] Invite participants and collect feedback
- [ ] Wake Render and check Supabase hasn't paused before demos and test sessions
- [ ] Handle removal requests directly in the database
- [ ] Take regular database backups, since Supabase's free plan has no automatic ones
- [ ] Review the feedback and choose what comes next

### Agent
- [ ] Fix bugs found in the pilot
- [ ] Add `pg_trgm` only if testing shows typos are a real problem
- [ ] Write the removal steps for handling requests in the database
- [ ] Write the backup and restore steps

## Later iterations
Not planned yet. Revisit after the pilot.
- Google sign-in (you create the Google OAuth client and consent screen)
- 2-step verification for `uni.minerva.edu` accounts that use email and password
- Password reset, which needs an email provider
- Media uploads (Cloudflare R2)
- Comments
- Interactive map and custom map pins
- Official vs. student content labels
- AI features
