# Plan - Minerva Atlas

Tracks everything needed to take Minerva Atlas from specs to pilot. Scope and behaviour live in [product.md](product.md), [architecture.md](architecture.md), [api.md](api.md), and [schema.md](schema.md); this file only tracks the work.

- **Claude**: steps Claude can do in this repo.
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
- [x] Sign-up, sign-in, profile, "my insights", edit, and delete have no wireframes: Claude follows the existing style, and you review them in Phase 5

Wireframe differences Claude will handle this way unless you say otherwise:
- The form's "tags (optional)" becomes a required category picker
- Cities and source URL go under the form's "more details"
- Sort options go behind the search bar's filter icon
- Authors show a placeholder avatar, since there's no avatar source yet
- "create insight" and the floating button both open the same form
- Insight details open in a modal, without the reply box
- The feed shows a place count, and place cards appear only in insight details, to limit Google lookup costs

### You: set up accounts
- [x] Create accounts: GitHub, Vercel, Render, Supabase, Google Cloud (for Places)

### Claude
- [x] Compare all wireframes with the specs and add any other conflicts to the list above
- [x] Read Google's current terms and summarise: storing `display_name`, attribution without a map (see [architecture.md](architecture.md))
- [x] Confirm current free-tier limits on Vercel, Render, Supabase, and Google Maps (see [architecture.md](architecture.md))

### You: after Claude's review
- [x] Show place names and addresses by live lookup: store only the place ID and fetch details when shown

## Phase 1: Repo foundation

### Claude
- [x] Initialise git and add `.gitignore`
- [x] Set up the pnpm workspace: `apps/web`, `apps/api`, `packages/shared`
- [x] Configure TypeScript, a linter and formatter, and Vitest
- [x] Add local Postgres for development and tests
- [x] Add `.env.example` listing every variable, with no real values
- [x] Add a GitHub Actions workflow: lint, type checks, tests, build, Postgres service container
- [x] Add a README with setup steps

### You
- [ ] Create the GitHub repo and give Claude the remote to push to
- [ ] Review the first PR and confirm CI passes on GitHub

## Phase 2: Database

### Claude
- [ ] Define the Drizzle schema and first migration from `schema.md`, aligned with Better Auth's tables
- [ ] Add the generated `search_vector` column and GIN index
- [ ] Check accent handling and the text search configuration early
- [ ] Add idempotent seed scripts for the cities and categories in `schema.md`, and choose category icons
- [ ] Add a seeded test user with a password, for test environments only

## Phase 3: Authentication

### Claude
- [ ] Set up Fastify with `fastify-type-provider-zod`, the shared error shape, and `GET /api/health`
- [ ] Integrate Better Auth with email and password, the Drizzle adapter, and Postgres sessions
- [ ] Enforce allowed domains on the server at sign-up: `minerva.edu`, `uni.minerva.edu`
- [ ] Rate limit sign-up and sign-in
- [ ] Require a session on all content routes and check `Origin` on state-changing routes
- [ ] Add `GET` and `PATCH /api/me`, validating the cohort format

### You
- [ ] Sign up with an allowed address and confirm a personal Gmail address is rejected

## Phase 4: Core API

### Claude
- [ ] Add Zod request and response schemas in `packages/shared`
- [ ] Add `GET /api/cities` and `GET /api/categories`
- [ ] Add insight create, read, edit, and hard delete, with several categories and author-only checks
- [ ] Add `GET /api/insights`: city and General rules, category, `q`, sorting, `author=me`, pagination
- [ ] Add the idempotent vote routes, updating the vote row and `upvote_count` in one transaction
- [ ] Save places through the insight routes, reused by `googlePlaceId`
- [ ] Add integration tests against real Postgres

## Phase 5: Frontend

### Claude
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

### Claude
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

### Claude
- [ ] Add the API Dockerfile and Render health check configuration
- [ ] Add the Vercel rewrite from `/api/*` to Render, and send `Cache-Control: no-store` on API responses
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

### Claude
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
