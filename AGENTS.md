# AGENTS.md

This file provides project guidance to Codex and other coding agents working in this repository.

## Current state

Minerva Atlas is a sign-in-only knowledge-sharing platform for Minerva University students, organised around rotation cities. The database and core APIs are implemented, along with frontend authentication, protected navigation, browsing/search, insight details and upvotes, contribution/action menus, and profile editing with My insights. See [docs/plan.md](docs/plan.md) for current progress and remaining work. The [contribution review map](docs/design/contribution-verification.md#review-map) identifies the key files, core changes, and review priorities for the latest slice. The [walkthrough seed review map](docs/design/walkthrough-seed-verification.md#review-map) covers the local demo dataset. Google Places remains in Phase 6; user visual review is pending.

## Navigation

Before editing `apps/api` or `apps/web`, read the relevant package guide: [API](apps/api/AGENTS.md) or [web](apps/web/AGENTS.md). These supplement the repository-wide rules below.

| Working on | Start with |
|---|---|
| Browse filters and URL state | `apps/web/src/lib/browse-state.ts` |
| Feed/detail queries and voting | `apps/web/src/lib/insights.ts` |
| Insight creation, editing, deletion, and action menus | `apps/web/src/components/contribution.tsx` and `apps/web/src/components/insight-menu.tsx` |
| Profile editing and My insights | `apps/web/src/profile.tsx` |
| Frontend session handling | `apps/web/src/lib/session.ts` |
| API insight behavior | `apps/api/src/insights/` |
| Request/response contracts | `packages/shared/src/` |
| Database changes | `apps/api/src/db/schema.ts` and `apps/api/drizzle/` |
| Visual and interaction conventions | [DESIGN.md](DESIGN.md) |

## Commands

Run from the repo root. API and browser tests need Postgres running. Run API tests, `pnpm smoke:api`, and browser tests sequentially: they share `atlas_test`, and both test suites rebuild its schema.

```bash
pnpm db:up                                # Start local Postgres (atlas_dev, atlas_test)
pnpm db:down                              # Stop it and keep its data
pnpm db:generate                          # Generate a migration from apps/api/src/db/schema.ts
pnpm db:migrate                           # Apply migrations to DATABASE_URL
pnpm db:seed                              # Seed cities and categories in DATABASE_URL; safe to re-run
pnpm db:seed:test                         # Seed the test user; requires NODE_ENV=test and atlas_test
pnpm dev:api                              # Build shared contracts and start the API watcher
pnpm start:api                            # Run the compiled API after pnpm build
pnpm dev:web                              # Build shared contracts and start Vite
pnpm preview:web                          # Serve the web production bundle after pnpm build
pnpm lint                                 # Builds declarations, then runs type-aware ESLint
pnpm format                               # Prettier (skips docs/, AGENTS.md, and CLAUDE.md); format:check only checks
pnpm typecheck                            # Type checks all packages and tests
pnpm test                                 # All Vitest tests (browser tests are separate)
pnpm test:web:browser                     # Build, then run development and production-preview browser tests
pnpm smoke:api                            # Two-user HTTP smoke test against atlas_test; cleans up its content
pnpm test --project api                   # One project: shared, api, or web
pnpm test apps/api/src/database.test.ts   # One test file
pnpm build                                # Builds all packages
```

## Specs

| File | Owns |
|---|---|
| `docs/product.md` | Scope, user flows, browsing and ownership rules |
| `docs/architecture.md` | Tech stack, layers, auth, search, Places, deployment and free-tier limits |
| `docs/api.md` | REST contract and error shape |
| `docs/schema.md` | Tables, indexes, seed cities and categories |
| `docs/plan.md` | Phased work tracker, including the wireframe differences already decided |
| `docs/design/` | Wireframes (PNG) |
| [DESIGN.md](DESIGN.md) | Visual tokens, shared components, and interaction conventions |

- Written specs win where the wireframes differ. Some wireframes show features that are out of scope, such as media, replies, and the Discover map.
- Screens with no wireframe (sign-up, sign-in, profile, "my insights", edit, delete) follow the existing wireframe style.
- `docs/plan.md` splits each phase into **Agent** and **You** steps. Do only the Agent steps, and ask the user for the rest (accounts, secrets, production migrations).
- Tick a plan box when its step is done. If a decision changes the scope, update the affected spec too.
- When completing a feature slice, add a concise review map to its verification notes: key files, core behavior changes, and what reviewers should check. Link it from this guide's Current state section, and include the review starting points and verification results in the handoff. Keep detailed implementation summaries out of this guide.
- Free-tier limits and Google terms in `docs/architecture.md` were checked on 2026-11-04 and can change. Check them again before relying on them.

## Architecture

A pnpm workspace: `apps/web` (React, Vite), `apps/api` (Fastify), and `packages/shared` (Zod request and response schemas used by both).

Requests flow UI → API client → HTTP API → service/domain logic → repository/database. React never talks directly to PostgreSQL. Tests run against a real Postgres: each API test run drops and rebuilds the `*_test` database's schema through the real migrations, and API test files run one at a time because they share it.

## Rules that span several specs

**General and search**
- General is not a city row. It means an insight has zero `insight_cities` rows. The `general` value exists only as an API param.
- Search scope is asymmetric. `city=<slug>` with `q` also includes insights with no city, but without `q` it returns only that city's insights. `city=general` returns only insights with no city, with or without `q`.
- A generated `search_vector` can't read other tables, so tagged place names aren't searchable.

**Google Places**
- Store and return only `google_place_id`. Google's policies don't allow keeping place names beyond the user session, so never persist names or addresses.
- The browser calls Google directly for autocomplete and details. There are no place endpoints in the API.
- To control cost, the feed shows a place count, and place cards appear only in insight details. Use one session token per autocomplete session, and end it with a call using Essentials fields only.

**Auth**
- Allow only `minerva.edu` and `uni.minerva.edu`, enforced on the server with an exact, case-insensitive match on the email domain.
- All content routes require a session, and state-changing routes check `Origin`.
- The MVP sends no email, so there is no address verification or password reset.
- Seed the test user with a password only in test environments, never in production.

**Data integrity**
- The vote row and `upvote_count` change in one transaction, and the vote routes are idempotent.
- The API, not the database, enforces that every insight has at least one category.
- Deletes are hard deletes that cascade to the join tables. There is no admin role or UI.

**Deployment (Vercel, Render, Supabase free tiers)**
- A Vercel rewrite sends `/api/*` to Render so that login cookies work without a custom domain. API responses must send `Cache-Control: no-store`, or one user's data could be cached for others.
- Connect to Supabase through the shared pooler in session mode (port 5432), because Render has no outbound IPv6 and the direct connection is IPv6.
- Keep the API stateless. Render's local files don't persist and its SMTP ports are blocked, so a later email provider must use an HTTP API.
- Migrations are a deliberate step run from a local machine or CI, because Render's free tier has no shell or one-off jobs.
