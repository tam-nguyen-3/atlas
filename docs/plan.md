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

### Agreed behavior

- **Visuals:** polished, light-theme screens that preserve the wireframes' sparse layout and hierarchy, with desktop and mobile layouts. The Phase 0 wireframe differences still apply.
- **Accent:** use `#F0B91E` as the brand accent, with dark text on gold-filled controls. Build a restrained supporting palette around white/light neutral surfaces and charcoal text; use an accessible darker gold for text links and indicators where the accent lacks contrast. Keep warning and error states distinct from the brand accent. Review the supporting palette in the first shell/feed review before applying it across the remaining screens.
- **City selection:** remember the last explicitly selected city, including General, in `localStorage`. An explicit URL city takes precedence; otherwise restore a valid saved city or fall back to San Francisco. Storage failures must not block browsing. Cookies are unnecessary because the server does not use this preference.
- **Feed:** numbered pagination, 20 insights per page. Keep city, committed search, category, sort, and page in validated URL parameters. Reset pagination when filters change.
- **Details:** shareable modal URLs preserve the underlying feed. Refresh and direct links reopen the insight; Back closes a modal opened from the feed. Narrow screens use a full-height dialog.
- **Insight actions:** every insight has a visible horizontal three-dot menu in its header, consistently across feed rows, insight details, and My insights. Everyone signed in sees "Copy link"; the logged-in author sees "Copy link", "Edit", and "Delete", in that order. Copy link uses a shareable insight-detail URL and does not change sign-in requirements. Edit opens the shared form; Delete opens the permanent-delete confirmation. Opening or using the menu must not activate the underlying insight row.
- **Forms:** create and edit use the same responsive modal form. Successful creation returns to the originating feed with its filters preserved, refreshes results, and shows a success message with a "View insight" link. Successful editing returns to the updated detail view.
- **Deletion:** confirm permanent deletion in an accessible dialog, then return to the originating list and correct pagination if needed.
- **Places boundary:** Google autocomplete and live place cards remain in Phase 6. Phase 5 needs no Google key, shows existing place counts, and preserves saved place associations during editing.
- **Defaults:** English UI, no dark mode, no persistent drafts or offline writes. No API contract or database changes are required for Phase 5.

Foundation/design, API/authentication, Browse/details, and Contribution/profile are implemented. Development and production use live feed/search, shareable insight dialogs, synchronized upvotes, insight action menus and CRUD, and profile editing with all-city My insights. See [foundation verification](design/foundation-verification.md), [authentication verification](design/authentication-verification.md), [browse verification](design/browse-verification.md), and [contribution verification](design/contribution-verification.md) for checks and design-audit limitations. Google Places stays in Phase 6; user visual review remains pending.

### Agent

#### Foundation and design

- [x] Configure Vite, React, TanStack Router and Query, Tailwind, shadcn/ui, React Hook Form, and development scripts
- [x] Use the frontend design skills to establish shared visual tokens and reusable controls around the agreed gold accent; record the visual and interaction conventions during implementation and verify contrast for text, controls, and focus states
- [x] Build the responsive app shell, city switcher with General and remembered selection, and navigation, with "Agent" and "Discover" linking to empty placeholders

#### API and authentication

Completed locally on 2026-11-06: 209 tests and 46 browser checks passed (23 each against development and production preview), along with formatting, lint, type checks, and build. See [verification notes](design/authentication-verification.md) for design-audit limitations.

This slice ends with working authentication and a live shell using real cities/categories. Feed browsing, insight details, contribution, and profile editing stay in the following slices. Preserve the existing foundation and its visual conventions.

- [x] Install and read the relevant official [Better Auth skills](https://github.com/better-auth/skills): best practices, create-auth, and email/password guidance (local Codex installation; other contributors install separately). Atlas specs take precedence over generic skill defaults such as email verification and password reset.
- [x] Add a same-origin `/api` client for Atlas endpoints, using cookie credentials, shared Zod contracts for runtime response validation, and request cancellation; start with profile, cities, and categories, adding insight methods with their UI slices
- [x] Add Better Auth's official client behind a dedicated auth adapter for `signUp.email`, `signIn.email`, and `signOut`, matching the backend's resolved package version and checking version-matched types/source alongside the official client documentation; keep auth calls on same-origin `/api/auth` and do not import server implementation into the browser
- [x] Normalize Atlas errors separately from Better Auth's native errors, including message-only rate limits and `X-Retry-After`; distinguish network/server failures from invalid sessions, and do not automatically retry credential submissions or sign-out
- [x] Use the shared-contract `GET /api/me` query as the authoritative frontend session/profile state; refresh it after authentication and on protected navigation, focus, and reconnect, without a competing `useSession` cache
- [x] Build custom `/sign-in` and `/sign-up` screens using the existing Atlas controls and design tokens, rather than adding Better Auth UI; sign-up collects name, university email, password, and confirmation, sending only `name`, `email`, and `password`
- [x] Match the existing name/domain/password rules, preserve entered values in memory after failures, prevent duplicate submissions, and support inline errors, first-invalid-field focus, password visibility, autofill, and paste; keep the default seven-day session with no Remember me option
- [x] Protect Browse, Discover, Agent, and Profile before rendering content; preserve the requested internal path, query, and hash through sign-in/sign-up, reject external return destinations and auth loops, and default to `/browse`
- [x] Add signed-in identity and sign-out to desktop/mobile navigation; report sign-out success only after server confirmation, and offer retry on failure
- [x] On protected-request 401 or successful sign-out, cancel requests and clear query/mutation data, preventing late responses from restoring the previous user's data; retain the city preference, and do not treat credential rejection, 403, or server unavailability as session loss
- [x] Replace the runtime static preview with an authenticated live shell in development and production; fetch real cities/categories, add client-only General, preserve agreed city precedence/storage behavior, and show loading/retry states plus an honest browse placeholder until the feed slice
- [x] Cover rejected domains, duplicate accounts, invalid credentials, rate-limit recovery, session expiry, unavailable-server recovery, safe return destinations, and user-to-user cache isolation with focused frontend tests
- [x] Extend Playwright to use a dedicated test API and freshly rebuilt/migrated/seeded `atlas_test`, sequentially after API tests; sign in through the normal form and adapt existing shell/city tests to real reference data, including production fixture exclusion
- [x] Verify desktop/mobile keyboard and focus behavior, accessibility, auth success/failure/refresh/sign-out/session-revocation flows, and network recovery; run formatting checks, lint, type checks, tests, browser tests, and build
- [x] Update `DESIGN.md` with auth/error conventions and README with the real-API browser-test workflow; mark this slice complete only after verification, leaving user visual review unchecked

#### Browse and details

Completed locally on 2026-11-07: all 233 tests and 68 browser checks passed (34 each against development and production preview), along with formatting, lint, type checks, and build. See [verification notes](design/browse-verification.md) for behavior, checks, and design-audit limits. Contribution/profile work and Google lookups remain in their following slices; user visual review stays pending.

- [x] Extend the API client with shared-schema feed, detail, and vote methods, cancellation, and existing session/error handling
- [x] Validate city, search, category, sort, page, and insight URL state; preserve city precedence/storage and normalize invalid values
- [x] Enable 300 ms debounced search with immediate Enter/clear, IME safety, literal query text, superseded-request cancellation, and Back/Forward synchronization
- [x] Add single-category filtering and sort controls behind the filter icon; use relevance with search and newest without it, removing relevance when search clears
- [x] Render responsive feed rows with optional titles, previews, author/cohort, categories, cities/General, dates, place counts, and voting
- [x] Add numbered pagination at 20 items per page, totals/current-page feedback, filter-change resets, and out-of-range correction
- [x] Follow API scope: city browsing excludes General, city search includes General, and General always includes only cityless insights
- [x] Open shareable `/browse?...&insight=<id>` dialogs with preserved feed filters/scroll, refresh/direct-entry support, safe close, and Back/Forward behavior
- [x] Build accessible desktop/mobile dialogs with full body formatting, metadata, safe source links, loading/retry/not-found states, and focus trapping/restoration
- [x] Synchronize server-confirmed votes across feed/detail caches, prevent overlapping submissions, refresh affected lists, and offer retry after failures
- [x] Verify loading, empty/no-results, long-content, keyboard/focus, mobile, and accessibility states with focused tests and real-API Playwright flows
- [x] Run formatting, lint, type checks, tests, browser checks, and build; update verification notes and DESIGN.md while leaving user visual review unchecked

#### Contribution and profile

Completed locally on 2026-11-07: all 241 tests and 94 browser checks passed (47 each against development and production preview), along with formatting, lint, type checks, and build. My insights appears below profile editing, across all cities and General by default. See [verification notes](design/contribution-verification.md) for behavior, checks, and design-audit limits. Google Places stays in Phase 6; user visual review remains unchecked.

- [x] Add the shared shadcn/Radix insight dropdown menu to feed rows, insight details, and My insights: Copy link for everyone, with Edit and Delete only for the logged-in author; include clipboard success/failure feedback and desktop/mobile keyboard/focus behavior
- [x] Build the shared create/edit form with validation, required multi-category selection, multi-city selection, optional-field clearing, and preservation of saved place associations
- [x] Implement the agreed create/edit success destinations and feedback, plus accessible permanent-delete confirmation and list pagination correction
- [x] Warn before discarding unsaved changes, preserve entered values after failures, and prevent duplicate submissions
- [x] Build profile editing (display name and cohort) and "my insights" across all cities by default

#### Verification

- [x] Add focused frontend tests and Playwright flows against the real test API and Postgres, signing in through the normal form with the seeded test user
- [x] Run browser tests sequentially after API tests; rebuild and seed the test database before browser tests so they cannot overlap API tests that rebuild the shared database
- [x] Cover authentication, remembered city and URL precedence, search scope, pagination, modal refresh/Back, CRUD, ownership, voting, profile, and session expiry
- [x] Verify insight-menu actions for authors and other signed-in users, copied-link direct entry through sign-in, clipboard success/failure feedback, and menu interaction without activating the underlying row
- [x] Verify loading, empty, no-results, retry, keyboard/focus, long-content, and mobile states; target WCAG 2.2 AA
- [x] Run formatting checks, lint, type checks, tests, and build

### You
- [ ] Review the app shell and feed early against the wireframes, including the gold accent, supporting palette, typography, and responsive layout
- [ ] Review all completed flows on desktop and mobile, including screens without wireframes, and give feedback

## Local walkthrough seed

### Agent
- [x] Add a separate local-only, repeatable 60-insight demo seed with fictional authors, valid votes, and eight contributions for an existing owner
- [x] Test preservation, database guards, transaction rollback, and authenticated browsing/search/ownership behavior
- [x] Run local seed, verify walkthrough API flows, and record results in [verification notes](design/walkthrough-seed-verification.md)

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
