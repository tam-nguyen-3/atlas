# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Minerva Atlas is a sign-in-only knowledge-sharing platform for Minerva University students, organised around rotation cities. Phase 1 of `docs/plan.md` is in place: the workspace packages are stubs, and the API and web app arrive in later phases.

## Commands

Run from the repo root. Tests need Postgres running.

```bash
pnpm db:up                                # Start local Postgres (atlas_dev, atlas_test)
pnpm db:down                              # Stop it and keep its data
pnpm lint                                 # Builds declarations, then runs type-aware ESLint
pnpm format                               # Prettier (skips docs/ and CLAUDE.md); format:check only checks
pnpm typecheck                            # Type checks all packages and tests
pnpm test                                 # All tests
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

- Written specs win where the wireframes differ. Some wireframes show features that are out of scope, such as media, replies, and the Discover map.
- Screens with no wireframe (sign-up, sign-in, profile, "my insights", edit, delete) follow the existing wireframe style.
- `docs/plan.md` splits each phase into **Claude** and **You** steps. Do only the Claude steps, and ask the user for the rest (accounts, secrets, production migrations).
- Tick a plan box when its step is done. If a decision changes the scope, update the affected spec too.
- Free-tier limits and Google terms in `docs/architecture.md` were checked on 2026-11-04 and can change. Check them again before relying on them.

## Planned architecture

A pnpm workspace: `apps/web` (React, Vite), `apps/api` (Fastify), and `packages/shared` (Zod request and response schemas used by both).

Requests flow UI → API client → HTTP API → service/domain logic → repository/database. React never talks directly to PostgreSQL. Tests run against a real Postgres.

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
